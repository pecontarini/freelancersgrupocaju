import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Button } from "@/components/ui/button";
import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";
import { LOGO_BASE64 } from "@/lib/logoBase64";

interface MaintenanceExportButtonProps {
  entries: MaintenanceEntry[];
  lojaNome?: string;
}

export function MaintenanceExportButton({ entries, lojaNome }: MaintenanceExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  const generatePDF = async () => {
    if (entries.length === 0) return;

    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Watermark function
      const addWatermark = () => {
        doc.setFillColor(252, 250, 245);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        doc.setTextColor(240, 230, 210);
        doc.setFontSize(60);
        doc.setFont("helvetica", "bold");
        const text = "GRUPO CAJU";
        const textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, pageHeight / 2, { angle: 45 });
      };

      // Add watermark to first page
      addWatermark();

      // Header with logo
      try {
        doc.addImage(LOGO_BASE64, "JPEG", 14, 10, 40, 25);
      } catch (e) {
        console.error("Error adding logo:", e);
      }

      // Title
      const displayLoja = lojaNome || entries[0]?.loja || "TODAS AS LOJAS";
      doc.setTextColor(200, 80, 50);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`GRUPO CAJU - ${displayLoja.toUpperCase()}`, 60, 20);

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(12);
      doc.text("ORDEM DE PAGAMENTO - MANUTENÇÃO", 60, 28);

      const today = new Date();
      doc.setFontSize(10);
      doc.text(`Data: ${today.toLocaleDateString("pt-BR")}`, 60, 35);

      // Table with entries
      const tableData = entries.map((entry) => [
        formatDate(entry.data_servico),
        entry.fornecedor,
        entry.numero_nf,
        entry.descricao || "-",
        formatCurrency(entry.valor),
      ]);

      autoTable(doc, {
        startY: 45,
        head: [["Data", "Fornecedor", "NF", "Descrição", "Valor"]],
        body: tableData,
        headStyles: {
          fillColor: [200, 80, 50],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [252, 248, 240],
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 45 },
          2: { cellWidth: 30 },
          3: { cellWidth: 50 },
          4: { cellWidth: 30, halign: "right" },
        },
        didDrawPage: (data) => {
          // Add watermark on new pages
          if (data.pageNumber > 1) {
            addWatermark();
          }
        },
      });

      // Summary
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      const totalValue = entries.reduce((sum, e) => sum + e.valor, 0);

      doc.setDrawColor(200, 80, 50);
      doc.setLineWidth(0.5);
      doc.line(14, finalY, pageWidth - 14, finalY);

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Total de Registros: ${entries.length}`, 14, finalY + 8);
      doc.text(`VALOR TOTAL: ${formatCurrency(totalValue)}`, 14, finalY + 16);

      // Attachments note
      const entriesWithAttachments = entries.filter((e) => e.anexo_url);
      if (entriesWithAttachments.length > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`* ${entriesWithAttachments.length} anexo(s) disponível(is) para conferência`, 14, finalY + 26);
        
        // List attachment URLs
        let attachmentY = finalY + 34;
        entriesWithAttachments.forEach((entry, index) => {
          if (attachmentY > pageHeight - 20) {
            doc.addPage();
            addWatermark();
            attachmentY = 20;
          }
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(`${index + 1}. ${entry.fornecedor} (NF: ${entry.numero_nf}):`, 14, attachmentY);
          doc.setTextColor(0, 100, 200);
          doc.textWithLink(entry.anexo_url!.substring(0, 70) + "...", 14, attachmentY + 4, {
            url: entry.anexo_url!,
          });
          attachmentY += 12;
        });
      }

      // Footer
      const footerY = pageHeight - 10;
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text("Documento gerado automaticamente pelo Sistema Grupo Caju", pageWidth / 2, footerY, {
        align: "center",
      });

      // Download
      const dateStr = today.toLocaleDateString("pt-BR").replace(/\//g, "-");
      const fileName = `ORDEM_DE_PAGAMENTO_MANUTENCAO_${displayLoja.toUpperCase().replace(/\s+/g, "_")}_${dateStr}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={entries.length === 0 || isGenerating}
      className="gap-2"
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      Gerar OP de Manutenção
    </Button>
  );
}
