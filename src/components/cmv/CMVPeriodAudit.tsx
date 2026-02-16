import { useState, useMemo } from "react";
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
  CheckCircle,
  Calculator,
  Package,
  ShoppingCart,
  Loader2,
  FileDown,
  Award,
  Medal,
  Trophy,
  AlertCircle,
  PackagePlus,
  MousePointerClick,
  DollarSign
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { useCMVAuditPeriod, type AuditPeriodRow } from "@/hooks/useCMVContagens";
import { useUnidade } from "@/contexts/UnidadeContext";
import { AuditEntriesModal } from "./AuditEntriesModal";
import { AuditSalesModal } from "./AuditSalesModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "@/lib/logoBase64";

// AuditItem is now derived from AuditPeriodRow (DB function)
interface AuditItem {
  itemId: string;
  itemName: string;
  initialCount: number;
  initialCost: number;
  entries: number;
  sales: number;
  waste: number;
  transfers: number;
  totalExits: number;
  expectedFinal: number;
  actualFinal: number;
  finalCost: number;
  divergence: number;
  divergenceValue: number;
  divergencePercent: number;
  hasInitialCount: boolean;
  hasFinalCount: boolean;
}

type PerformanceTier = "ouro" | "prata" | "bronze" | "critico";

interface PerformanceSeal {
  tier: PerformanceTier;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const PERFORMANCE_SEALS: Record<PerformanceTier, PerformanceSeal> = {
  ouro: {
    tier: "ouro",
    label: "OURO",
    emoji: "🥇",
    color: "text-yellow-700",
    bgColor: "bg-gradient-to-br from-yellow-100 to-amber-200",
    borderColor: "border-yellow-400",
    icon: Trophy,
    description: "Divergência < 1,5%",
  },
  prata: {
    tier: "prata",
    label: "PRATA",
    emoji: "🥈",
    color: "text-slate-600",
    bgColor: "bg-gradient-to-br from-slate-100 to-slate-200",
    borderColor: "border-slate-400",
    icon: Medal,
    description: "Divergência 1,51% - 4%",
  },
  bronze: {
    tier: "bronze",
    label: "BRONZE",
    emoji: "🥉",
    color: "text-orange-700",
    bgColor: "bg-gradient-to-br from-orange-100 to-orange-200",
    borderColor: "border-orange-400",
    icon: Award,
    description: "Divergência 4,1% - 5%",
  },
  critico: {
    tier: "critico",
    label: "CRÍTICO",
    emoji: "🚨",
    color: "text-red-700",
    bgColor: "bg-gradient-to-br from-red-100 to-red-200",
    borderColor: "border-red-500",
    icon: AlertCircle,
    description: "Divergência > 5%",
  },
};

function getPerformanceTier(divergencePercent: number): PerformanceTier {
  if (divergencePercent <= 1.5) return "ouro";
  if (divergencePercent <= 4) return "prata";
  if (divergencePercent <= 5) return "bronze";
  return "critico";
}

export function CMVPeriodAudit() {
  const { effectiveUnidadeId } = useUnidade();
  
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const [drilldown, setDrilldown] = useState<{
    type: "entries" | "sales";
    itemId: string;
    itemName: string;
  } | null>(null);

  const startDateStr = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
  const endDateStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined;

  const { auditData: dbAuditData, hasInitialCounts, hasFinalCounts, isLoading } = useCMVAuditPeriod(
    effectiveUnidadeId || undefined,
    startDateStr,
    endDateStr
  );

  const auditData = useMemo((): AuditItem[] => {
    if (!startDate || !endDate || dbAuditData.length === 0) return [];

    return dbAuditData.map((row: AuditPeriodRow) => {
      const divergence = Number(row.divergence);
      const theoreticalFinal = Number(row.theoretical_final);
      const divergencePercent = theoreticalFinal > 0 ? (Math.abs(divergence) / theoreticalFinal) * 100 : 0;
      const sales = Number(row.sales_consumption);
      const waste = Number(row.waste_qty);
      const transfers = Number(row.transfers_qty);

      return {
        itemId: row.item_id,
        itemName: row.item_name,
        initialCount: Number(row.initial_stock),
        initialCost: Number(row.initial_cost),
        entries: Number(row.purchases_qty),
        sales,
        waste,
        transfers,
        totalExits: sales + waste + transfers,
        expectedFinal: Number(row.theoretical_final),
        actualFinal: Number(row.real_final_stock),
        finalCost: Number(row.final_cost),
        divergence,
        divergenceValue: Number(row.financial_loss),
        divergencePercent,
        hasInitialCount: row.has_initial_count,
        hasFinalCount: row.has_final_count,
      };
    });
  }, [dbAuditData, startDate, endDate]);

  // Calculate summary with performance tier
  const summary = useMemo(() => {
    const totalExpected = auditData.reduce((sum, item) => sum + Math.max(0, item.expectedFinal), 0);
    const totalDivergence = auditData.reduce((sum, item) => sum + Math.abs(item.divergence), 0);
    const totalLoss = auditData.reduce((sum, item) => sum + Math.max(0, item.divergenceValue), 0);
    const totalGain = auditData.reduce((sum, item) => sum + Math.min(0, item.divergenceValue), 0);
    const itemsWithDivergence = auditData.filter(item => item.divergence !== 0).length;
    const accuracy = auditData.length > 0 
      ? ((auditData.length - itemsWithDivergence) / auditData.length) * 100 
      : 100;
    
    const overallDivergencePercent = totalExpected > 0 
      ? (totalDivergence / totalExpected) * 100 
      : 0;
    const performanceTier = getPerformanceTier(overallDivergencePercent);

    // Period financial totals
    const totalPurchasesValue = auditData.reduce((sum, item) => sum + item.entries * item.initialCost, 0);
    const totalSalesValue = auditData.reduce((sum, item) => sum + item.sales * item.initialCost, 0);
    const totalInitialValue = auditData.reduce((sum, item) => sum + item.initialCount * item.initialCost, 0);
    const totalFinalValue = auditData.reduce((sum, item) => sum + item.actualFinal * item.finalCost, 0);
    const cmvTeoricoPercent = totalSalesValue > 0 && totalInitialValue > 0
      ? ((totalInitialValue + totalPurchasesValue - totalFinalValue) / (totalSalesValue || 1)) * 100
      : 0;

    return {
      totalDivergence,
      totalLoss,
      totalGain: Math.abs(totalGain),
      itemsWithDivergence,
      accuracy,
      periodDays: startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0,
      overallDivergencePercent,
      performanceTier,
      totalPurchasesValue,
      totalSalesValue,
      cmvTeoricoPercent,
    };
  }, [auditData, startDate, endDate]);

  // Ranking of items with highest loss (top 5)
  const lossRanking = useMemo(() => {
    return [...auditData]
      .filter(item => item.divergenceValue > 0)
      .sort((a, b) => b.divergenceValue - a.divergenceValue)
      .slice(0, 5)
      .map(item => ({
        name: item.itemName.length > 15 ? item.itemName.slice(0, 15) + "..." : item.itemName,
        fullName: item.itemName,
        prejuizo: item.divergenceValue,
        unidades: item.divergence,
      }));
  }, [auditData]);

  // Daily divergence evolution (mock based on period)
  const dailyEvolution = useMemo(() => {
    if (!startDate || !endDate) return [];
    
    const days = summary.periodDays;
    const data = [];
    
    // Generate evolution data - in a real scenario this would come from daily counts
    // For now, we show a simplified view based on start/end dates
    const startDateFormatted = format(startDate, "dd/MM");
    const endDateFormatted = format(endDate, "dd/MM");
    
    if (days <= 7) {
      // Show individual days
      for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        const dateLabel = format(currentDate, "dd/MM");
        
        // Calculate progressive divergence (simplified)
        const progressFactor = i / Math.max(1, days - 1);
        const dailyDivergence = summary.totalLoss * progressFactor;
        
        data.push({
          date: dateLabel,
          divergencia: Math.round(dailyDivergence * 100) / 100,
        });
      }
    } else {
      // Show summary points
      data.push({ date: startDateFormatted, divergencia: 0 });
      data.push({ date: "Meio", divergencia: summary.totalLoss * 0.4 });
      data.push({ date: endDateFormatted, divergencia: summary.totalLoss });
    }
    
    return data;
  }, [startDate, endDate, summary]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const storeName = "Unidade";
    const seal = PERFORMANCE_SEALS[summary.performanceTier];

    // Header
    try {
      doc.addImage(LOGO_BASE64, "PNG", 14, 10, 30, 15);
    } catch (e) {
      console.warn("Logo not available");
    }

    doc.setFontSize(16);
    doc.text("Relatório de Auditoria CMV", 50, 18);
    doc.setFontSize(10);
    doc.text(`Unidade: ${storeName}`, 50, 25);
    doc.text(`Período: ${startDate ? format(startDate, "dd/MM/yyyy") : "-"} a ${endDate ? format(endDate, "dd/MM/yyyy") : "-"}`, 50, 30);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 50, 35);

    // Performance Seal
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${seal.emoji} Selo: ${seal.label}`, 14, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Divergência: ${summary.overallDivergencePercent.toFixed(2)}%`, 14, 56);

    // Summary
    doc.setFontSize(12);
    doc.text("Resumo do Período", 14, 68);
    
    const summaryData = [
      ["Dias no Período", String(summary.periodDays)],
      ["Itens Auditados", String(auditData.length)],
      ["Itens com Divergência", String(summary.itemsWithDivergence)],
      ["Divergência Total %", `${summary.overallDivergencePercent.toFixed(2)}%`],
      ["Prejuízo Total", `R$ ${summary.totalLoss.toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 72,
      head: [["Métrica", "Valor"]],
      body: summaryData,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 14, right: 14 },
    });

    // Detailed data
    const detailY = (doc as any).lastAutoTable.finalY + 15;
    doc.text("Detalhamento por Item", 14, detailY);

    const tableData = auditData.map(item => [
      item.itemName,
      String(item.initialCount),
      String(item.entries),
      String(item.sales),
      String(item.waste),
      String(item.transfers),
      item.expectedFinal.toFixed(2),
      String(item.actualFinal),
      item.divergence.toFixed(2),
      `R$ ${item.divergenceValue.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: detailY + 5,
      head: [["Item", "Inicial", "(+)Entr.", "(-)Venda", "(-)Desp.", "(-)Transf.", "Esperado", "Real", "Dif.", "Valor"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185], fontSize: 7 },
      styles: { fontSize: 7 },
      columnStyles: {
        8: { halign: "center" },
        9: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`auditoria-cmv-${storeName}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const canAudit = startDate && endDate && hasInitialCounts && hasFinalCounts;
  const seal = canAudit ? PERFORMANCE_SEALS[summary.performanceTier] : null;
  const SealIcon = seal?.icon;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Auditoria por Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Data Inicial (Estoque Inicial)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
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
                    disabled={(date) => date > new Date() || (endDate ? date > endDate : false)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Data Final (Contagem de Apuração)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
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
                    disabled={(date) => date > new Date() || (startDate ? date < startDate : false)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {startDate && endDate && (
              <div className="flex items-end">
                <Badge variant="secondary">
                  {summary.periodDays} dias
                </Badge>
              </div>
            )}
          </div>

          {startDate && endDate && !isLoading && !hasInitialCounts && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Falta contagem no dia {format(startDate, "dd/MM/yyyy")}. 
                Registre uma contagem física nesta data para iniciar a auditoria.
              </AlertDescription>
            </Alert>
          )}

          {startDate && endDate && !isLoading && hasInitialCounts && !hasFinalCounts && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Falta contagem no dia {format(endDate, "dd/MM/yyyy")}. 
                Registre uma contagem física nesta data para concluir a auditoria.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Performance Seal - KPI Badge */}
      {canAudit && seal && SealIcon && (
        <Card className={cn("border-2", seal.borderColor, seal.bgColor)}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("p-4 rounded-full bg-white/80 shadow-md")}>
                  <SealIcon className={cn("h-10 w-10", seal.color)} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{seal.emoji}</span>
                    <h3 className={cn("text-2xl font-bold", seal.color)}>
                      Selo {seal.label}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {seal.description}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Divergência do Período</p>
                <p className={cn("text-3xl font-bold", seal.color)}>
                  {summary.overallDivergencePercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Summary Header */}
      {canAudit && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">
                Período Auditado: {startDate ? format(startDate, "dd/MM/yyyy") : ""} a {endDate ? format(endDate, "dd/MM/yyyy") : ""}
              </h3>
              <Badge variant="secondary">{summary.periodDays} dias</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total de Compras</p>
                <p className="text-xl font-bold font-mono">R$ {summary.totalPurchasesValue.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Vendas (Carnes)</p>
                <p className="text-xl font-bold font-mono">R$ {summary.totalSalesValue.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Prejuízo Total</p>
                <p className="text-xl font-bold font-mono text-destructive">R$ {summary.totalLoss.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Divergência Geral</p>
                <p className={cn(
                  "text-xl font-bold font-mono",
                  summary.overallDivergencePercent <= 1.5 ? "text-green-600" :
                  summary.overallDivergencePercent <= 4 ? "text-yellow-600" : "text-destructive"
                )}>
                  {summary.overallDivergencePercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      {canAudit && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Loss Ranking Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Ranking de Prejuízo (Top 5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lossRanking.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
                  <p>Nenhuma divergência detectada!</p>
                </div>
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lossRanking}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={100} 
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-lg p-3 shadow-lg">
                                <p className="font-semibold">{data.fullName}</p>
                                <p className="text-destructive">
                                  Prejuízo: R$ {data.prejuizo.toFixed(2)}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                  {data.unidades} unidades faltantes
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="prejuizo" radius={[0, 4, 4, 0]}>
                        {lossRanking.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? "#ef4444" : index === 1 ? "#f97316" : "#eab308"} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Divergence Evolution Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Evolução de Divergência (R$)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyEvolution.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Calculator className="h-12 w-12 mb-2 opacity-50" />
                  <p>Selecione um período para visualizar</p>
                </div>
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={dailyEvolution}
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                      <Tooltip
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Divergência Acumulada"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="divergencia"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Results with Drill-down */}
      {canAudit && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Conciliação Detalhada
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MousePointerClick className="h-3 w-3" />
                Clique nos valores de Entradas ou Vendas para ver os detalhes
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Saldo Inicial</TableHead>
                      <TableHead className="text-center">(+) Entradas</TableHead>
                      <TableHead className="text-center">(-) Vendas</TableHead>
                      <TableHead className="text-center">(-) Desperdício</TableHead>
                      <TableHead className="text-center">(-) Transf.</TableHead>
                      <TableHead className="text-center">(=) Esperado</TableHead>
                      <TableHead className="text-center">Contagem Final</TableHead>
                      <TableHead className="text-center">Diferença</TableHead>
                      <TableHead className="text-right">Prejuízo R$</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.map(item => (
                      <TableRow key={item.itemId}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell className="text-center font-mono">{item.initialCount}</TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => setDrilldown({ type: "entries", itemId: item.itemId, itemName: item.itemName })}
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 hover:underline cursor-pointer font-mono transition-colors"
                          >
                            +{item.entries}
                            <PackagePlus className="h-3 w-3 opacity-50" />
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => setDrilldown({ type: "sales", itemId: item.itemId, itemName: item.itemName })}
                            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 hover:underline cursor-pointer font-mono transition-colors"
                          >
                            -{item.sales}
                            <ShoppingCart className="h-3 w-3 opacity-50" />
                          </button>
                        </TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {item.waste > 0 ? `-${item.waste}` : "—"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">
                          {item.transfers > 0 ? `-${item.transfers}` : "—"}
                        </TableCell>
                        <TableCell className="text-center font-bold font-mono">{item.expectedFinal.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono">{item.actualFinal}</TableCell>
                        <TableCell className="text-center">
                          {item.divergence !== 0 ? (
                            <Badge variant={item.divergence < 0 ? "destructive" : "default"} className={cn(
                              item.divergence > 0 && "bg-green-500"
                            )}>
                              {item.divergence < 0 ? (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              )}
                              {item.divergence > 0 ? "+" : ""}{item.divergence.toFixed(2)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono",
                          item.divergenceValue > 0 ? "text-destructive font-bold" : ""
                        )}>
                          {item.divergenceValue > 0 ? `R$ ${item.divergenceValue.toFixed(2)}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {auditData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Nenhum item com movimentação no período
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drill-down Modals */}
      {drilldown?.type === "entries" && startDateStr && endDateStr && effectiveUnidadeId && (
        <AuditEntriesModal
          open={true}
          onOpenChange={(open) => !open && setDrilldown(null)}
          itemId={drilldown.itemId}
          itemName={drilldown.itemName}
          lojaId={effectiveUnidadeId}
          startDate={startDateStr}
          endDate={endDateStr}
        />
      )}
      {drilldown?.type === "sales" && startDateStr && endDateStr && effectiveUnidadeId && (
        <AuditSalesModal
          open={true}
          onOpenChange={(open) => !open && setDrilldown(null)}
          itemId={drilldown.itemId}
          itemName={drilldown.itemName}
          lojaId={effectiveUnidadeId}
          startDate={startDateStr}
          endDate={endDateStr}
        />
      )}
    </div>
  );
}
