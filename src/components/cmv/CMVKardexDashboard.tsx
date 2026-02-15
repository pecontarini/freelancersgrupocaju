import { useState, useMemo } from "react";
import { format, subDays, parseISO, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Activity, TrendingDown, TrendingUp, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useCMVItems } from "@/hooks/useCMV";
import { useInventoryKardex } from "@/hooks/useInventoryKardex";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "custom", label: "Período customizado" },
];

export function CMVKardexDashboard() {
  const { effectiveUnidadeId } = useUnidade();
  const { items: cmvItems, isLoading: isLoadingItems } = useCMVItems();

  const [selectedIngredient, setSelectedIngredient] = useState<string>("");
  const [periodOption, setPeriodOption] = useState("7");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();

  const { startDate, endDate } = useMemo(() => {
    if (periodOption === "custom" && customStart && customEnd) {
      return {
        startDate: format(customStart, "yyyy-MM-dd"),
        endDate: format(customEnd, "yyyy-MM-dd"),
      };
    }
    const days = parseInt(periodOption) || 7;
    const end = new Date();
    const start = subDays(end, days - 1);
    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    };
  }, [periodOption, customStart, customEnd]);

  const { positions, transactions, isLoading } = useInventoryKardex(
    effectiveUnidadeId || undefined,
    selectedIngredient || undefined,
    startDate,
    endDate
  );

  const selectedItemName = cmvItems.find(i => i.id === selectedIngredient)?.nome || "";
  const selectedItemUnit = cmvItems.find(i => i.id === selectedIngredient)?.unidade || "un";

  // Build chart data
  const chartData = useMemo(() => {
    return positions.map(pos => {
      const d = parseISO(pos.date);
      return {
        label: format(d, "dd/MM", { locale: ptBR }),
        date: pos.date,
        vendas: Number(pos.total_sales),
        estoqueReal: pos.physical_count != null ? Number(pos.physical_count) : null,
        saldoTeorico: Number(pos.theoretical_balance),
        divergencia: pos.divergence != null ? Number(pos.divergence) : 0,
      };
    });
  }, [positions]);

  // Summary stats
  const totalEntries = positions.reduce((s, p) => s + Number(p.total_entry), 0);
  const totalSales = positions.reduce((s, p) => s + Number(p.total_sales), 0);
  const totalWaste = positions.reduce((s, p) => s + Number(p.total_waste), 0);
  const lastDivergence = positions.length > 0 ? positions[positions.length - 1].divergence : null;

  const formatDayLabel = (dateStr: string) => {
    const d = parseISO(dateStr);
    const dayName = format(d, "EEE", { locale: ptBR });
    return `${format(d, "dd/MM")} - ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}`;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Kardex Diário — Movimentação de Estoque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Ingredient Selector */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Ingrediente</label>
              <Select value={selectedIngredient} onValueChange={setSelectedIngredient}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ingrediente" />
                </SelectTrigger>
                <SelectContent>
                  {cmvItems.filter(i => i.ativo).map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nome} ({item.unidade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period Selector */}
            <div className="min-w-[180px]">
              <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Período</label>
              <Select value={periodOption} onValueChange={setPeriodOption}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom date pickers */}
            {periodOption === "custom" && (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Início</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customStart && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customStart ? format(customStart, "dd/MM/yyyy") : "Data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Fim</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !customEnd && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customEnd ? format(customEnd, "dd/MM/yyyy") : "Data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedIngredient && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Selecione um ingrediente acima</p>
            <p className="text-sm">Para visualizar a movimentação dia a dia</p>
          </CardContent>
        </Card>
      )}

      {selectedIngredient && isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando movimentação...</p>
          </CardContent>
        </Card>
      )}

      {selectedIngredient && !isLoading && positions.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum dado encontrado</p>
            <p className="text-sm">Não há registros de movimentação para {selectedItemName} no período selecionado.</p>
            <p className="text-xs mt-2">Dica: Execute a função de snapshot diário para popular os dados.</p>
          </CardContent>
        </Card>
      )}

      {selectedIngredient && !isLoading && positions.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Entradas</p>
                <p className="text-2xl font-bold text-green-600">+{totalEntries.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{selectedItemUnit}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Vendas (Consumo)</p>
                <p className="text-2xl font-bold text-blue-600">-{totalSales.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{selectedItemUnit}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Desperdício</p>
                <p className="text-2xl font-bold text-orange-600">-{totalWaste.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">{selectedItemUnit}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Última Divergência</p>
                <p className={cn("text-2xl font-bold", lastDivergence != null && lastDivergence < 0 ? "text-destructive" : "text-green-600")}>
                  {lastDivergence != null ? `${lastDivergence > 0 ? "+" : ""}${lastDivergence.toFixed(1)}` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{selectedItemUnit}</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tendência — {selectedItemName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="divergencia" name="Divergência" fill="hsl(0, 84%, 60%)" opacity={0.4} />
                    <Line type="monotone" dataKey="vendas" name="Vendas (Consumo)" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="saldoTeorico" name="Saldo Teórico" stroke="hsl(142, 71%, 45%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="estoqueReal" name="Contagem Real" stroke="hsl(142, 71%, 35%)" strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Ledger Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Movimentação Dia a Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px]">Data</TableHead>
                      <TableHead className="text-right">Saldo Inicial</TableHead>
                      <TableHead className="text-right text-green-700">Entradas (+)</TableHead>
                      <TableHead className="text-right text-blue-700">Vendas (-)</TableHead>
                      <TableHead className="text-right text-orange-700">Desperdício (-)</TableHead>
                      <TableHead className="text-right">Saldo Teórico</TableHead>
                      <TableHead className="text-right">Contagem Real</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((pos) => {
                      const div = pos.divergence != null ? Number(pos.divergence) : null;
                      return (
                        <TableRow key={pos.date}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatDayLabel(pos.date)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{Number(pos.opening_balance).toFixed(1)}</TableCell>
                          <TableCell className="text-right tabular-nums text-green-700 font-medium">
                            {Number(pos.total_entry) > 0 ? `+${Number(pos.total_entry).toFixed(1)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-blue-700 font-medium">
                            {Number(pos.total_sales) > 0 ? `-${Number(pos.total_sales).toFixed(1)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-orange-700 font-medium">
                            {Number(pos.total_waste) > 0 ? `-${Number(pos.total_waste).toFixed(1)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {Number(pos.theoretical_balance).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {pos.physical_count != null ? (
                              <span className="font-semibold">{Number(pos.physical_count).toFixed(1)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {div != null ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "tabular-nums font-semibold",
                                  div < 0
                                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                                    : div === 0
                                    ? "border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950/30"
                                    : "border-yellow-500/50 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30"
                                )}
                              >
                                {div > 0 ? "+" : ""}{div.toFixed(1)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
