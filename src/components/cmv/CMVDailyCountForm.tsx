import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, ClipboardCheck, Loader2, Save, CheckCircle, FileSpreadsheet, FileText } from "lucide-react";
import { CMVChecklistFacilImporter } from "./CMVChecklistFacilImporter";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { downloadWorkbook } from "@/lib/excelUtils";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCMVItems } from "@/hooks/useCMV";
import { useCMVContagens } from "@/hooks/useCMVContagens";
import { useUnidade } from "@/contexts/UnidadeContext";

interface ItemCount {
  cmv_item_id: string;
  quantidade: string;
  preco_custo_snapshot: number;
}

export function CMVDailyCountForm() {
  const { effectiveUnidadeId } = useUnidade();
  const { items: cmvItems } = useCMVItems();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateString = format(selectedDate, "yyyy-MM-dd");
  
  const { contagensByDate, isLoadingByDate, bulkUpsertContagens } = useCMVContagens(
    effectiveUnidadeId || undefined,
    dateString
  );
  
  const [counts, setCounts] = useState<Record<string, ItemCount>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeItems = useMemo(() => 
    cmvItems.filter(item => item.ativo),
    [cmvItems]
  );

  // Initialize counts from existing data - use JSON key to avoid infinite loops
  const contagensKey = JSON.stringify(contagensByDate.map(c => `${c.cmv_item_id}:${c.quantidade}`));
  useEffect(() => {
    if (contagensByDate.length > 0) {
      const existingCounts: Record<string, ItemCount> = {};
      contagensByDate.forEach(c => {
        existingCounts[c.cmv_item_id] = {
          cmv_item_id: c.cmv_item_id,
          quantidade: String(c.quantidade),
          preco_custo_snapshot: c.preco_custo_snapshot,
        };
      });
      setCounts(existingCounts);
    } else {
      setCounts({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contagensKey, dateString]);

  const handleCountChange = (itemId: string, value: string, currentCost: number) => {
    setCounts(prev => ({
      ...prev,
      [itemId]: {
        cmv_item_id: itemId,
        quantidade: value,
        preco_custo_snapshot: currentCost,
      },
    }));
  };

  const handleSubmit = async () => {
    if (!effectiveUnidadeId) {
      toast.error("Selecione uma unidade");
      return;
    }

    const validCounts = Object.values(counts).filter(c => c.quantidade !== "");
    if (validCounts.length === 0) {
      toast.error("Preencha pelo menos uma contagem");
      return;
    }

    setIsSubmitting(true);
    try {
      const contagensToSave = validCounts.map(c => ({
        cmv_item_id: c.cmv_item_id,
        loja_id: effectiveUnidadeId,
        data_contagem: dateString,
        quantidade: parseFloat(c.quantidade) || 0,
        preco_custo_snapshot: c.preco_custo_snapshot,
      }));

      await bulkUpsertContagens.mutateAsync(contagensToSave);
    } catch (error) {
      console.error("Error saving counts:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const countedItems = Object.keys(counts).filter(k => counts[k].quantidade !== "").length;
  const totalItems = activeItems.length;
  const progress = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  // Get items with counts for export
  const getExportData = () => {
    return activeItems
      .filter(item => {
        const count = counts[item.id];
        return count?.quantidade !== undefined && count?.quantidade !== "";
      })
      .map(item => {
        const count = counts[item.id];
        const qty = parseInt(count.quantidade) || 0;
        const cost = count.preco_custo_snapshot || item.preco_custo_atual;
        return {
          nome: item.nome,
          categoria: item.categoria || "-",
          unidade: item.unidade,
          quantidade: qty,
          custo_unitario: cost,
          valor_total: qty * cost,
          peso_padrao_g: item.peso_padrao_g,
        };
      });
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error("Nenhuma contagem para exportar");
      return;
    }

    const worksheetData = [
      ["CONTAGEM FÍSICA - CMV CARNES"],
      [`Data: ${format(selectedDate, "dd/MM/yyyy")}`],
      [""],
      ["Item", "Categoria", "Unidade", "Quantidade", "Custo Unit. (R$)", "Valor Total (R$)"],
      ...data.map(item => [
        item.nome,
        item.categoria,
        item.unidade,
        item.quantidade,
        item.custo_unitario.toFixed(2),
        item.valor_total.toFixed(2),
      ]),
      [""],
      ["TOTAL", "", "", data.reduce((sum, i) => sum + i.quantidade, 0), "", 
        data.reduce((sum, i) => sum + i.valor_total, 0).toFixed(2)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contagem");
    
    const fileName = `Contagem_CMV_${format(selectedDate, "yyyy-MM-dd")}.xlsx`;
    downloadWorkbook(wb, fileName);
    toast.success("Excel exportado com sucesso!");
  };

  const handleExportPDF = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error("Nenhuma contagem para exportar");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logo
    try {
      doc.addImage(LOGO_BASE64, "PNG", 14, 10, 30, 15);
    } catch (e) {
      console.log("Logo not available");
    }

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CONTAGEM FÍSICA - CMV CARNES", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${format(selectedDate, "dd/MM/yyyy")}`, pageWidth / 2, 28, { align: "center" });

    // Summary
    const totalQty = data.reduce((sum, i) => sum + i.quantidade, 0);
    const totalValue = data.reduce((sum, i) => sum + i.valor_total, 0);

    doc.setFontSize(10);
    doc.text(`Total de Itens: ${data.length}`, 14, 40);
    doc.text(`Quantidade Total: ${totalQty} unidades`, 14, 46);
    doc.text(`Valor Total em Estoque: R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 14, 52);

    // Table
    autoTable(doc, {
      startY: 60,
      head: [["Item", "Categoria", "Un.", "Qtd", "Custo (R$)", "Total (R$)"]],
      body: data.map(item => [
        item.nome,
        item.categoria,
        item.unidade,
        item.quantidade.toString(),
        item.custo_unitario.toFixed(2),
        item.valor_total.toFixed(2),
      ]),
      foot: [["TOTAL", "", "", totalQty.toString(), "", `R$ ${totalValue.toFixed(2)}`]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [229, 231, 235], textColor: [0, 0, 0], fontStyle: "bold" },
    });

    const fileName = `Contagem_CMV_${format(selectedDate, "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);
    toast.success("PDF exportado com sucesso!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Contagem Física Diária
            </div>
            <Badge variant={isToday ? "default" : "secondary"}>
              {isToday ? "Hoje" : format(selectedDate, "dd/MM/yyyy")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Selector */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <Label>Data da Contagem</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <div className="text-sm text-muted-foreground">
                Progresso: {countedItems}/{totalItems} itens
              </div>
              <Badge variant={progress === 100 ? "default" : "outline"} className={cn(
                progress === 100 && "bg-green-500"
              )}>
                {progress}%
              </Badge>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                progress === 100 ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Items Table */}
          {isLoadingByDate ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-[100px]">Unidade</TableHead>
                    <TableHead className="w-[120px]">Custo Atual</TableHead>
                    <TableHead className="w-[120px]">Quantidade</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeItems.map(item => {
                    const currentCount = counts[item.id];
                    const hasCount = currentCount?.quantidade !== undefined && currentCount?.quantidade !== "";
                    const existingCount = contagensByDate.find(c => c.cmv_item_id === item.id);
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div>
                            {item.nome}
                            {item.peso_padrao_g && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({item.peso_padrao_g}g)
                              </span>
                            )}
                          </div>
                          {item.categoria && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {item.categoria}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{item.unidade}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            R$ {item.preco_custo_atual.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={currentCount?.quantidade || ""}
                            onChange={(e) => handleCountChange(
                              item.id, 
                              e.target.value, 
                              item.preco_custo_atual
                            )}
                            className="w-24 text-center"
                          />
                        </TableCell>
                        <TableCell>
                          {existingCount ? (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Salvo
                            </Badge>
                          ) : hasCount ? (
                            <Badge variant="outline" className="text-blue-600">
                              Pendente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              —
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <CMVChecklistFacilImporter />
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={countedItems === 0}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={countedItems === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || countedItems === 0}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Contagens ({countedItems})
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
