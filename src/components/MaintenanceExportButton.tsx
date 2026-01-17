import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { MaintenanceSelectionModal } from "@/components/MaintenanceSelectionModal";
import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";
import { LOGO_BASE64 } from "@/lib/logoBase64";

// Brand colors
const PRIMARY_COLOR: [number, number, number] = [208, 89, 55]; // Coral/Terracotta
const SECONDARY_COLOR: [number, number, number] = [100, 100, 100]; // Gray

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

  const generatePDF = async (selectedEntries: MaintenanceEntry[]) => {
    if (selectedEntries.length === 0) return;

    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Clean background - no watermark
      const addCleanBackground = () => {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      // Add clean background to first page
      addCleanBackground();

      // Header with logo
      try {
        doc.addImage(LOGO_BASE64, "JPEG", 14, 10, 40, 25);
      } catch (e) {
        console.error("Error adding logo:", e);
      }

      // Title
      const displayLoja = lojaNome || selectedEntries[0]?.loja || "TODAS AS LOJAS";
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`GRUPO CAJU - ${displayLoja.toUpperCase()}`, 60, 20);

      doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      doc.setFontSize(12);
      doc.text("ORDEM DE PAGAMENTO - MANUTENÇÃO", 60, 28);

      const today = new Date();
      doc.setFontSize(10);
      doc.text(`Data: ${today.toLocaleDateString("pt-BR")}`, 60, 35);

      // Table with entries
      const tableData = selectedEntries.map((entry) => [
        formatDate(entry.data_servico),
        entry.fornecedor,
        entry.cpf_cnpj || "-",
        entry.numero_nf,
        entry.descricao || "-",
        formatCurrency(entry.valor),
      ]);

      autoTable(doc, {
        startY: 45,
        head: [["Data", "Fornecedor", "CPF/CNPJ", "NF", "Descrição", "Valor"]],
        body: tableData,
        headStyles: {
          fillColor: [PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 35 },
          2: { cellWidth: 32 },
          3: { cellWidth: 22 },
          4: { cellWidth: 40 },
          5: { cellWidth: 28, halign: "right" },
        },
        didDrawPage: (data) => {
          // Add clean background on new pages
          if (data.pageNumber > 1) {
            addCleanBackground();
          }
        },
      });

      // Summary after table
      let summaryY = (doc as any).lastAutoTable.finalY + 10;
      const totalValue = selectedEntries.reduce((sum, e) => sum + e.valor, 0);

      doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.setLineWidth(0.5);
      doc.line(14, summaryY, pageWidth - 14, summaryY);

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Total de Registros: ${selectedEntries.length}`, 14, summaryY + 8);
      doc.text(`VALOR TOTAL: ${formatCurrency(totalValue)}`, 14, summaryY + 16);

      // Payment Details Section - Chave PIX
      const entriesWithPix = selectedEntries.filter((e) => e.chave_pix);
      if (entriesWithPix.length > 0) {
        let pixY = summaryY + 30;
        
        if (pixY > pageHeight - 60) {
          doc.addPage();
          addCleanBackground();
          pixY = 20;
        }
        
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("DADOS PARA PAGAMENTO (PIX)", 14, pixY);
        
        pixY += 8;
        
        entriesWithPix.forEach((entry) => {
          if (pixY > pageHeight - 40) {
            doc.addPage();
            addCleanBackground();
            pixY = 20;
          }
          
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(60, 60, 60);
          doc.text(`${entry.fornecedor}`, 14, pixY);
          
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 80, 80);
          
          const cpfCnpjText = entry.cpf_cnpj ? `CPF/CNPJ: ${entry.cpf_cnpj} | ` : "";
          doc.text(`${cpfCnpjText}Chave PIX: ${entry.chave_pix} | Valor: ${formatCurrency(entry.valor)}`, 14, pixY + 5);
          
          pixY += 14;
        });
      }

      // Attachments note
      const entriesWithAttachments = selectedEntries.filter((e) => e.anexo_url);
      if (entriesWithAttachments.length > 0) {
        let attachmentY = entriesWithPix.length > 0 
          ? summaryY + 30 + (entriesWithPix.length * 14) + 10
          : summaryY + 26;
        
        if (attachmentY > pageHeight - 40) {
          doc.addPage();
          addCleanBackground();
          attachmentY = 20;
        }
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        doc.text(`* ${entriesWithAttachments.length} anexo(s) disponível(is) para conferência`, 14, attachmentY);
        
        // List attachment URLs
        attachmentY += 8;
        entriesWithAttachments.forEach((entry, index) => {
          if (attachmentY > pageHeight - 20) {
            doc.addPage();
            addCleanBackground();
            attachmentY = 20;
          }
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(`${index + 1}. ${entry.fornecedor} (NF: ${entry.numero_nf}):`, 14, attachmentY);
          doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
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
    <MaintenanceSelectionModal
      entries={entries}
      lojaNome={lojaNome}
      onGenerate={generatePDF}
      isGenerating={isGenerating}
    />
  );
}
