import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CalendarIcon,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Trash2,
  FileDown,
  BarChart3,
  Package,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useCMVClosingReport } from "@/hooks/useCMVClosingReport";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "@/lib/logoBase64";

export function CMVClosingReport() {
  const { effectiveUnidadeId } = useUnidade();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const startStr = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
  const endStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined;

  const { summary, isLoading } = useCMVClosingReport(
    effectiveUnidadeId || undefined,
    startStr,
    endStr
  );

  const fmtCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const exportPDF = () => {
    if (!summary) return;
    const doc = new jsPDF();

    try {
      doc.addImage(LOGO_BASE64, "PNG", 14, 10, 30, 15);
    } catch {}

    doc.setFontSize(16);
    doc.text("Relatório de Fechamento CMV", 50, 18);
    doc.setFontSize(10);
    doc.text(
      `Período: ${startDate ? format(startDate, "dd/MM/yyyy") : "-"} a ${endDate ? format(endDate, "dd/MM/yyyy") : "-"}`,
      50,
      25
    );
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 50, 30);

    // KPIs
    const kpiData = [
      ["Faturamento", fmtCurrency(summary.faturamento)],
      ["Estoque Inicial (R$)", fmtCurrency(summary.estoqueInicialValue)],
      ["(+) Compras (R$)", fmtCurrency(summary.comprasValue)],
      ["(-) Estoque Final (R$)", fmtCurrency(summary.estoqueFinalValue)],
      ["CMV Financeiro (R$)", fmtCurrency(summary.cmvFinanceiroValue)],
      ["CMV Financeiro (%)", `${summary.cmvFinanceiroPercent.toFixed(2)}%`],
      ["CMV Teórico (R$)", fmtCurrency(summary.cmvTeoricoValue)],
      ["CMV Teórico (%)", `${summary.cmvTeoricoPercent.toFixed(2)}%`],
      ["Gap CMV (R$)", fmtCurrency(summary.gapValue)],
      ["Gap CMV (pp)", `${summary.gapPercent.toFixed(2)} pp`],
      ["Total Desperdício (R$)", fmtCurrency(summary.totalWasteValue)],
    ];

    autoTable(doc, {
      startY: 38,
      head: [["Indicador", "Valor"]],
      body: kpiData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14, right: 14 },
    });

    // Waste table
    if (summary.wasteRanking.length > 0) {
      const wasteY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text("Lista Negra de Desperdício", 14, wasteY);

      autoTable(doc, {
        startY: wasteY + 5,
        head: [["Ingrediente", "Categoria", "Qtd Total", "Custo Total", "Motivo Principal"]],
        body: summary.wasteRanking.map((w) => [
          w.ingredientName,
          w.categoria,
          w.totalQuantity.toFixed(2),
          fmtCurrency(w.totalCost),
          w.mainReason,
        ]),
        theme: "striped",
        headStyles: { fillColor: [192, 57, 43] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(
      `fechamento-cmv-${startDate ? format(startDate, "yyyy-MM-dd") : "inicio"}-a-${endDate ? format(endDate, "yyyy-MM-dd") : "fim"}.pdf`
    );
  };

  const gapColor =
    summary && summary.gapPercent > 2
      ? "text-destructive"
      : summary && summary.gapPercent > 0
        ? "text-yellow-600"
        : "text-green-600";

  const wasteChartData =
    summary?.wasteRanking.slice(0, 8).map((w) => ({
      name: w.ingredientName.length > 12 ? w.ingredientName.slice(0, 12) + "…" : w.ingredientName,
      custo: w.totalCost,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatório de Fechamento CMV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium">Data Inicial</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(d) => d > new Date() || (endDate ? d > endDate : false)}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Data Final</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(d) => d > new Date() || (startDate ? d < startDate : false)}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {summary && (
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculando relatório…
            </div>
          )}
        </CardContent>
      </Card>

      {!effectiveUnidadeId && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Selecione uma unidade acima</p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {summary && (
        <>
          {/* CMV Formula */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
                Cálculo do CMV Financeiro
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Estoque Inicial</p>
                  <p className="text-lg font-bold">{fmtCurrency(summary.estoqueInicialValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">(+) Compras</p>
                  <p className="text-lg font-bold text-blue-600">{fmtCurrency(summary.comprasValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">(-) Estoque Final</p>
                  <p className="text-lg font-bold text-orange-600">{fmtCurrency(summary.estoqueFinalValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">= CMV Financeiro</p>
                  <p className="text-lg font-bold">{fmtCurrency(summary.cmvFinanceiroValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">/ Faturamento</p>
                  <p className="text-lg font-bold">{fmtCurrency(summary.faturamento)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CMV Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Financial CMV */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">CMV Financeiro</span>
                </div>
                <p className="text-3xl font-bold">{summary.cmvFinanceiroPercent.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtCurrency(summary.cmvFinanceiroValue)}
                </p>
              </CardContent>
            </Card>

            {/* Theoretical CMV */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">CMV Teórico</span>
                </div>
                <p className="text-3xl font-bold">{summary.cmvTeoricoPercent.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtCurrency(summary.cmvTeoricoValue)}
                </p>
              </CardContent>
            </Card>

            {/* Gap */}
            <Card className={cn(
              "border-2",
              summary.gapPercent > 2 ? "border-destructive/50 bg-destructive/5" :
              summary.gapPercent > 0 ? "border-yellow-400/50 bg-yellow-50" :
              "border-green-400/50 bg-green-50"
            )}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  {summary.gapPercent > 0 ? (
                    <TrendingDown className={cn("h-5 w-5", gapColor)} />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  )}
                  <span className="text-sm text-muted-foreground">Gap de CMV</span>
                </div>
                <p className={cn("text-3xl font-bold", gapColor)}>
                  {summary.gapPercent > 0 ? "+" : ""}{summary.gapPercent.toFixed(2)} pp
                </p>
                <p className={cn("text-xs mt-1", gapColor)}>
                  {fmtCurrency(summary.gapValue)} acima do ideal
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gap Alert */}
          {summary.gapPercent > 2 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                O Gap de CMV está em <strong>{summary.gapPercent.toFixed(2)} pp</strong> — acima do
                limite aceitável de 2pp. Verifique a Lista Negra de Desperdícios abaixo para
                identificar as causas.
              </AlertDescription>
            </Alert>
          )}

          {/* Waste Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                Lista Negra de Desperdício
                {summary.wasteRanking.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {fmtCurrency(summary.totalWasteValue)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {summary.wasteRanking.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Nenhum desperdício registrado no período.</p>
                  <p className="text-sm">
                    Lance desperdícios via Kardex → Transações para que apareçam aqui.
                  </p>
                </div>
              ) : (
                <>
                  {/* Waste Chart */}
                  {wasteChartData.length > 0 && (
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={wasteChartData} layout="vertical" margin={{ left: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value: number) => [fmtCurrency(value), "Prejuízo"]}
                          />
                          <Bar dataKey="custo" radius={[0, 4, 4, 0]}>
                            {wasteChartData.map((_, idx) => (
                              <Cell
                                key={idx}
                                fill={idx === 0 ? "hsl(var(--destructive))" : idx < 3 ? "#f97316" : "#94a3b8"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Waste Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Ingrediente</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Qtd Total</TableHead>
                          <TableHead className="text-right">Custo Total (R$)</TableHead>
                          <TableHead>Motivo Principal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.wasteRanking.map((w, idx) => (
                          <TableRow key={w.ingredientId}>
                            <TableCell>
                              <Badge
                                variant={idx === 0 ? "destructive" : "secondary"}
                                className="w-7 justify-center"
                              >
                                {idx + 1}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{w.ingredientName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{w.categoria}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {w.totalQuantity.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-destructive">
                              {fmtCurrency(w.totalCost)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-muted">
                                {w.mainReason}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
