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
  AlertCircle
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { useCMVAuditPeriod, type AuditPeriodRow } from "@/hooks/useCMVContagens";
import { useUnidade } from "@/contexts/UnidadeContext";
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

      return {
        itemId: row.item_id,
        itemName: row.item_name,
        initialCount: Number(row.initial_stock),
        initialCost: Number(row.initial_cost),
        entries: Number(row.purchases_qty),
        sales: Number(row.sales_consumption),
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
    
    // Calculate overall divergence percentage for KPI seal
    const overallDivergencePercent = totalExpected > 0 
      ? (totalDivergence / totalExpected) * 100 
      : 0;
    const performanceTier = getPerformanceTier(overallDivergencePercent);

    return {
      totalDivergence,
      totalLoss,
      totalGain: Math.abs(totalGain),
      itemsWithDivergence,
      accuracy,
      periodDays: startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0,
      overallDivergencePercent,
      performanceTier,
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
      String(item.expectedFinal),
      String(item.actualFinal),
      String(item.divergence),
      `R$ ${item.divergenceValue.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: detailY + 5,
      head: [["Item", "Inicial", "Entradas", "Saídas", "Esperado", "Real", "Diverg.", "Valor"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        6: { halign: "center" },
        7: { halign: "right" },
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

      {/* Summary Cards */}
      {canAudit && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">Itens Auditados</span>
              </div>
              <p className="text-2xl font-bold mt-2">{auditData.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span className="text-sm text-muted-foreground">Com Divergência</span>
              </div>
              <p className="text-2xl font-bold mt-2">{summary.itemsWithDivergence}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                <span className="text-sm text-muted-foreground">Prejuízo Total</span>
              </div>
              <p className="text-2xl font-bold mt-2 text-destructive">
                R$ {summary.totalLoss.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Acuracidade</span>
              </div>
              <p className={cn(
                "text-2xl font-bold mt-2",
                summary.accuracy >= 95 ? "text-green-600" : 
                summary.accuracy >= 85 ? "text-yellow-600" : "text-destructive"
              )}>
                {summary.accuracy.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
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

      {/* Detailed Results */}
      {canAudit && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Conciliação Detalhada
            </CardTitle>
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
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Inicial</TableHead>
                      <TableHead className="text-center">+ Entradas</TableHead>
                      <TableHead className="text-center">- Saídas</TableHead>
                      <TableHead className="text-center">= Esperado</TableHead>
                      <TableHead className="text-center">Real</TableHead>
                      <TableHead className="text-center">Divergência</TableHead>
                      <TableHead className="text-right">Valor (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditData.map(item => (
                      <TableRow key={item.itemId}>
                        <TableCell className="font-medium">{item.itemName}</TableCell>
                        <TableCell className="text-center">{item.initialCount}</TableCell>
                        <TableCell className="text-center text-green-600">+{item.entries}</TableCell>
                        <TableCell className="text-center text-orange-600">-{item.sales}</TableCell>
                        <TableCell className="text-center font-medium">{item.expectedFinal}</TableCell>
                        <TableCell className="text-center">{item.actualFinal}</TableCell>
                        <TableCell className="text-center">
                          {item.divergence !== 0 ? (
                            <Badge variant={item.divergence > 0 ? "destructive" : "default"} className={cn(
                              item.divergence < 0 && "bg-green-500"
                            )}>
                              {item.divergence > 0 ? (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              )}
                              {item.divergence}
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
                          item.divergenceValue > 0 ? "text-destructive" : 
                          item.divergenceValue < 0 ? "text-green-600" : ""
                        )}>
                          {item.divergenceValue > 0 ? "-" : item.divergenceValue < 0 ? "+" : ""}
                          {Math.abs(item.divergenceValue).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {auditData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
    </div>
  );
}
