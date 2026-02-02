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
  FileDown
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCMVItems } from "@/hooks/useCMV";
import { useCMVAuditPeriod } from "@/hooks/useCMVContagens";
import { useUnidade } from "@/contexts/UnidadeContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "@/lib/logoBase64";

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
}

export function CMVPeriodAudit() {
  const { effectiveUnidadeId } = useUnidade();
  const { items: cmvItems } = useCMVItems();
  
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const startDateStr = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
  const endDateStr = endDate ? format(endDate, "yyyy-MM-dd") : undefined;

  const { initialCounts, finalCounts, entries, sales, isLoading } = useCMVAuditPeriod(
    effectiveUnidadeId || undefined,
    startDateStr,
    endDateStr
  );

  const auditData = useMemo((): AuditItem[] => {
    if (!startDate || !endDate || initialCounts.length === 0) return [];

    const activeItems = cmvItems.filter(item => item.ativo);
    
    return activeItems.map(item => {
      const initial = initialCounts.find(c => c.cmv_item_id === item.id);
      const final = finalCounts.find(c => c.cmv_item_id === item.id);
      
      const itemEntries = entries.filter(e => e.cmv_item_id === item.id);
      const itemSales = sales.filter(s => s.cmv_item_id === item.id);
      
      const totalEntries = itemEntries.reduce((sum, e) => sum + Number(e.quantidade), 0);
      const totalSales = itemSales.reduce((sum, s) => sum + Number(s.quantidade), 0);
      
      const initialCount = initial?.quantidade || 0;
      const initialCost = initial?.preco_custo_snapshot || item.preco_custo_atual;
      const actualFinal = final?.quantidade || 0;
      const finalCost = final?.preco_custo_snapshot || item.preco_custo_atual;
      
      const expectedFinal = initialCount + totalEntries - totalSales;
      const divergence = expectedFinal - actualFinal;
      const divergenceValue = divergence * finalCost;

      return {
        itemId: item.id,
        itemName: item.nome,
        initialCount,
        initialCost,
        entries: totalEntries,
        sales: totalSales,
        expectedFinal,
        actualFinal,
        finalCost,
        divergence,
        divergenceValue,
      };
    }).filter(item => 
      item.initialCount > 0 || item.entries > 0 || item.actualFinal > 0
    );
  }, [cmvItems, initialCounts, finalCounts, entries, sales, startDate, endDate]);

  const summary = useMemo(() => {
    const totalDivergence = auditData.reduce((sum, item) => sum + item.divergence, 0);
    const totalLoss = auditData.reduce((sum, item) => sum + Math.max(0, item.divergenceValue), 0);
    const totalGain = auditData.reduce((sum, item) => sum + Math.min(0, item.divergenceValue), 0);
    const itemsWithDivergence = auditData.filter(item => item.divergence !== 0).length;
    const accuracy = auditData.length > 0 
      ? ((auditData.length - itemsWithDivergence) / auditData.length) * 100 
      : 100;

    return {
      totalDivergence,
      totalLoss,
      totalGain: Math.abs(totalGain),
      itemsWithDivergence,
      accuracy,
      periodDays: startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0,
    };
  }, [auditData, startDate, endDate]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const storeName = "Unidade";

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

    // Summary
    doc.setFontSize(12);
    doc.text("Resumo do Período", 14, 50);
    
    const summaryData = [
      ["Dias no Período", String(summary.periodDays)],
      ["Itens Auditados", String(auditData.length)],
      ["Itens com Divergência", String(summary.itemsWithDivergence)],
      ["Taxa de Acuracidade", `${summary.accuracy.toFixed(1)}%`],
      ["Prejuízo Total", `R$ ${summary.totalLoss.toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 55,
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

  const canAudit = startDate && endDate && initialCounts.length > 0;

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

          {startDate && endDate && initialCounts.length === 0 && !isLoading && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Não há contagem registrada na data inicial ({format(startDate, "dd/MM/yyyy")}). 
                Registre uma contagem física nesta data para iniciar a auditoria.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
                <span className="text-sm text-muted-foreground">Prejuízo</span>
              </div>
              <p className="text-2xl font-bold mt-2 text-red-600">
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
                summary.accuracy >= 85 ? "text-yellow-600" : "text-red-600"
              )}>
                {summary.accuracy.toFixed(1)}%
              </p>
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
                          item.divergenceValue > 0 ? "text-red-600" : 
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
