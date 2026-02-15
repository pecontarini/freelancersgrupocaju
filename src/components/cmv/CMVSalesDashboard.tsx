import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { BarChart3, AlertTriangle, Calendar, DollarSign, Package, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useDailySales, DailySale } from "@/hooks/useDailySales";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;
const ANOMALY_THRESHOLD = 100;

interface DaySummary {
  date: string;
  dateFormatted: string;
  totalItems: number;
  totalAmount: number;
  itemCount: number;
  items: DailySale[];
  isAnomaly: boolean;
}

export function CMVSalesDashboard() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, isPartner } = useUserProfile();
  const canReset = isAdmin || isPartner;
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState<"amount" | "quantity">("amount");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch unit name for confirmation
  const { data: unitName } = useQuery({
    queryKey: ["unit-name", effectiveUnidadeId],
    queryFn: async () => {
      if (!effectiveUnidadeId) return null;
      const { data } = await supabase
        .from("config_lojas")
        .select("nome")
        .eq("id", effectiveUnidadeId)
        .single();
      return data?.nome || null;
    },
    enabled: !!effectiveUnidadeId,
  });

  const { sales, isLoading } = useDailySales(effectiveUnidadeId || undefined, startDate, endDate);
  const queryClient = useQueryClient();

  const handleResetSales = async () => {
    if (!effectiveUnidadeId || !unitName) return;
    if (confirmText.trim().toUpperCase() !== unitName.trim().toUpperCase()) {
      toast.error("Nome da unidade não confere. Operação cancelada.");
      return;
    }
    setIsResetting(true);
    try {
      const { data, error } = await supabase.rpc("reset_unit_sales_data", {
        target_unit_id: effectiveUnidadeId,
      });
      if (error) throw error;
      const result = data as any;
      toast.success(
        `Limpeza concluída: ${result.daily_sales_deleted} vendas, ${result.transactions_deleted} transações e ${result.positions_deleted} posições removidas.`
      );
      setDialogOpen(false);
      setConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["daily-sales"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao resetar dados de vendas.");
    } finally {
      setIsResetting(false);
    }
  };

  const daySummaries = useMemo<DaySummary[]>(() => {
    if (!sales.length) return [];

    const byDate = new Map<string, DailySale[]>();
    for (const sale of sales) {
      const existing = byDate.get(sale.sale_date) || [];
      existing.push(sale);
      byDate.set(sale.sale_date, existing);
    }

    return Array.from(byDate.entries())
      .map(([date, items]) => {
        const totalItems = items.reduce((s, i) => s + i.quantity, 0);
        const totalAmount = items.reduce((s, i) => s + ((i as any).total_amount || 0), 0);
        const [y, m, d] = date.split("-");
        return {
          date,
          dateFormatted: `${d}/${m}/${y}`,
          totalItems,
          totalAmount,
          itemCount: items.length,
          items,
          isAnomaly: totalAmount < ANOMALY_THRESHOLD && totalAmount >= 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sales]);

  const chartData = useMemo(() => {
    return [...daySummaries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        name: d.dateFormatted,
        valor: d.totalAmount,
        itens: d.totalItems,
      }));
  }, [daySummaries]);

  const chartConfig = {
    valor: { label: "Valor (R$)", color: "hsl(var(--primary))" },
    itens: { label: "Qtd Itens", color: "hsl(var(--chart-2, 160 60% 45%))" },
  };

  const totalPages = Math.ceil(daySummaries.length / ITEMS_PER_PAGE);
  const paginatedDays = daySummaries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const grandTotalAmount = daySummaries.reduce((s, d) => s + d.totalAmount, 0);
  const grandTotalItems = daySummaries.reduce((s, d) => s + d.totalItems, 0);

  if (!effectiveUnidadeId) return null;

  return (
    <div className="space-y-6">
      {/* Filtros de Data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Filtros de Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="w-40"
              />
            </div>
            <div className="flex gap-2 ml-auto">
              <Badge variant="outline" className="gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(grandTotalAmount)}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Package className="h-3 w-3" />
                {grandTotalItems.toLocaleString("pt-BR")} itens
              </Badge>
              <Badge variant="outline">
                {daySummaries.length} dias
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Vendas por Dia
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "amount" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("amount")}
                  className="h-7 text-xs"
                >
                  Valor (R$)
                </Button>
                <Button
                  variant={viewMode === "quantity" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("quantity")}
                  className="h-7 text-xs"
                >
                  Qtd Itens
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    viewMode === "amount"
                      ? `R$${(v / 1000).toFixed(0)}k`
                      : String(v)
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === "valor") return formatCurrency(Number(value));
                        return `${Number(value).toLocaleString("pt-BR")} itens`;
                      }}
                    />
                  }
                />
                <Bar
                  dataKey={viewMode === "amount" ? "valor" : "itens"}
                  fill={viewMode === "amount" ? "hsl(var(--primary))" : "hsl(var(--chart-2, 160 60% 45%))"}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Lista por Dia (Accordion) */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Carregando vendas...
          </CardContent>
        </Card>
      ) : paginatedDays.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma venda importada no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalhamento por Dia</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Accordion type="multiple" className="w-full">
              {paginatedDays.map((day) => (
                <AccordionItem key={day.date} value={day.date}>
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3 w-full mr-4">
                      {day.isAnomaly && (
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="font-mono font-medium text-sm">{day.dateFormatted}</span>
                      <Badge variant="secondary" className="text-xs">
                        {day.itemCount} itens
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Qtd: {day.totalItems.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-sm font-medium ml-auto">
                        {formatCurrency(day.totalAmount)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Importado
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item Venda</TableHead>
                            <TableHead className="w-[100px] text-right">Qtd</TableHead>
                            <TableHead className="w-[130px] text-right">Valor Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {day.items
                            .sort((a, b) => ((b as any).total_amount || 0) - ((a as any).total_amount || 0))
                            .map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-sm">{item.item_name}</TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {item.quantity.toLocaleString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatCurrency((item as any).total_amount || 0)}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    {day.isAnomaly && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Valor total abaixo de R$ 100 — verifique se o arquivo importado está completo.
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const page = currentPage <= 3
                      ? i + 1
                      : currentPage >= totalPages - 2
                        ? totalPages - 4 + i
                        : currentPage - 2 + i;
                    if (page < 1 || page > totalPages) return null;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          isActive={page === currentPage}
                          onClick={() => setCurrentPage(page)}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>
      )}

      {/* Danger Zone - Reset Sales */}
      {canReset && effectiveUnidadeId && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Zona de Perigo
            </CardTitle>
            <CardDescription>
              Ações irreversíveis que afetam todo o histórico de vendas desta unidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setConfirmText(""); }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Zerar Vendas e Consumo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <ShieldAlert className="h-5 w-5" />
                    Confirmar Exclusão Total
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>Esta ação irá remover <strong>permanentemente</strong>:</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>Todo o histórico de vendas importadas (<code>daily_sales</code>)</li>
                        <li>Todas as baixas de estoque por venda (<code>sale_deduction</code>)</li>
                        <li>Todos os snapshots de posição diária de estoque</li>
                      </ul>
                      <p className="text-sm">
                        Os vínculos de produtos (De-Para), itens ignorados e cadastros <strong>não serão afetados</strong>.
                      </p>
                      <div className="space-y-2 pt-2">
                        <Label className="text-sm font-medium">
                          Digite o nome da unidade para confirmar: <strong className="text-destructive">{unitName}</strong>
                        </Label>
                        <Input
                          placeholder={unitName || "Nome da unidade"}
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          className="border-destructive/50 focus-visible:ring-destructive"
                        />
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isResetting}>Cancelar</AlertDialogCancel>
                  <Button
                    variant="destructive"
                    onClick={handleResetSales}
                    disabled={isResetting || confirmText.trim().toUpperCase() !== (unitName || "").trim().toUpperCase()}
                    className="gap-2"
                  >
                    {isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {isResetting ? "Removendo..." : "Confirmar Exclusão"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
