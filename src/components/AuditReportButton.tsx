import { useState } from "react";
import { FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LOGO_BASE64 } from "@/lib/logoBase64";

interface AuditReportButtonProps {
  brandFilter?: string;
}

const BRAND_PATTERNS: Record<string, string[]> = {
  caminito: ["CAMINITO", "MULT"],
  nazo: ["NAZO", "NFE"],
  frangobrasil: ["FB", "FRANGO"],
  caju: ["CAJU"],
};

export function AuditReportButton({ brandFilter = "all" }: AuditReportButtonProps) {
  const { toast } = useToast();
  const { options: lojas } = useConfigLojas();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    try {
      // Get store IDs based on brand filter
      let storeIds: string[] = [];
      if (brandFilter === "all") {
        storeIds = lojas.map((l) => l.id);
      } else {
        const patterns = BRAND_PATTERNS[brandFilter] || [];
        storeIds = lojas
          .filter((l) => patterns.some((p) => l.nome.toUpperCase().includes(p)))
          .map((l) => l.id);
      }

      if (storeIds.length === 0) {
        toast({
          title: "Nenhuma unidade encontrada",
          description: "Não há unidades para o filtro selecionado.",
          variant: "destructive",
        });
        return;
      }

      // Fetch failures for these stores
      const { data: failures, error } = await supabase
        .from("supervision_failures")
        .select("*")
        .in("loja_id", storeIds)
        .order("item_name");

      if (error) throw error;

      if (!failures || failures.length === 0) {
        toast({
          title: "Sem dados",
          description: "Não há falhas registradas para gerar o relatório.",
          variant: "destructive",
        });
        return;
      }

      // Count failure occurrences
      const failureCounts: Record<string, { count: number; category: string | null; stores: Set<string> }> = {};
      
      failures.forEach((f) => {
        if (!failureCounts[f.item_name]) {
          failureCounts[f.item_name] = { count: 0, category: f.category, stores: new Set() };
        }
        failureCounts[f.item_name].count++;
        failureCounts[f.item_name].stores.add(f.loja_id);
      });

      // Sort by count descending
      const sortedFailures = Object.entries(failureCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20); // Top 20

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header with logo
      try {
        doc.addImage(LOGO_BASE64, "PNG", 14, 10, 40, 15);
      } catch {
        // Logo failed, continue without it
      }

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      const brandName = brandFilter === "all" ? "TODAS AS MARCAS" : brandFilter.toUpperCase();
      doc.text(`RELATÓRIO DE AUDITORIA - ${brandName}`, pageWidth / 2, 35, { align: "center" });

      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 42, {
        align: "center",
      });

      // Summary
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("FALHAS MAIS FREQUENTES", 14, 55);

      // Table with failures
      const tableData = sortedFailures.map(([itemName, data], idx) => [
        (idx + 1).toString(),
        itemName.length > 50 ? itemName.substring(0, 47) + "..." : itemName,
        data.category || "-",
        data.count.toString(),
        data.stores.size.toString(),
      ]);

      autoTable(doc, {
        startY: 60,
        head: [["#", "Item", "Categoria", "Ocorrências", "Unidades"]],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [208, 89, 55], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 90 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
        },
      });

      // Status summary
      const pendingCount = failures.filter((f) => f.status === "pending").length;
      const resolvedCount = failures.filter((f) => f.status === "resolved").length;
      const validatedCount = failures.filter((f) => f.status === "validated").length;

      const finalY = (doc as any).lastAutoTable?.finalY || 150;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Falhas: ${failures.length}`, 14, finalY + 15);
      doc.text(`Pendentes: ${pendingCount} | Corrigidas: ${resolvedCount} | Validadas: ${validatedCount}`, 14, finalY + 22);

      // Save PDF
      const fileName = `Relatorio_Auditoria_${brandName}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(fileName);

      toast({
        title: "Relatório gerado",
        description: `${fileName} foi baixado com sucesso.`,
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Erro ao gerar relatório",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button onClick={handleGenerateReport} disabled={isGenerating} variant="outline">
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 mr-2" />
          Gerar Relatório de Auditoria
        </>
      )}
    </Button>
  );
}
