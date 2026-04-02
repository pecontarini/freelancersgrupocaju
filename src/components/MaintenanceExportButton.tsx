import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { MaintenanceSelectionModal } from "@/components/MaintenanceSelectionModal";
import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";
import { LOGO_BASE64 } from "@/lib/logoBase64";

// Brand colors (CajuPAR)
const PRIMARY_COLOR: [number, number, number] = [208, 89, 55]; // Coral/Terracotta
const SECONDARY_COLOR: [number, number, number] = [100, 100, 100]; // Gray
const HEADER_BG: [number, number, number] = [245, 245, 245]; // Light gray background

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

  const formatCpfCnpj = (value: string | null) => {
    if (!value) return "-";
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return value;
  };

  const generatePDF = async (selectedEntries: MaintenanceEntry[]) => {
    if (selectedEntries.length === 0) return;

    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      // Clean background
      const addCleanBackground = () => {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      // Add footer on each page
      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
        
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text("Documento gerado automaticamente pelo Sistema CajuPAR", margin, pageHeight - 12);
        doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: "right" });
      };

      addCleanBackground();

      // ========== HEADER SECTION ==========
      // Header background
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.roundedRect(margin, 8, pageWidth - margin * 2, 38, 3, 3, "F");

      // Logo
      try {
        doc.addImage(LOGO_BASE64, "JPEG", margin + 4, 12, 36, 22);
      } catch (e) {
        console.error("Error adding logo:", e);
      }

      // Title and info
      const displayLoja = lojaNome || selectedEntries[0]?.loja || "TODAS AS LOJAS";
      const today = new Date();
      
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("ORDEM DE PAGAMENTO DE SERVIÇOS", margin + 48, 18);

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`GRUPO CAJU - ${displayLoja.toUpperCase()}`, margin + 48, 26);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      doc.text(`Emitido em: ${today.toLocaleDateString("pt-BR")} às ${today.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, margin + 48, 33);
      
      // Document number (protocol)
      const docNumber = `MNT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text(`Nº ${docNumber}`, pageWidth - margin - 4, 18, { align: "right" });

      // ========== SUMMARY BOX ==========
      const totalValue = selectedEntries.reduce((sum, e) => sum + e.valor, 0);
      
      doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin, 50, pageWidth - margin * 2, 18, 2, 2, "S");
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(`Total de Serviços: ${selectedEntries.length}`, margin + 6, 58);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text(`VALOR TOTAL: ${formatCurrency(totalValue)}`, margin + 6, 64);

      // Period info
      const dates = selectedEntries.map(e => e.data_servico).sort();
      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      doc.text(`Período: ${formatDate(firstDate)} a ${formatDate(lastDate)}`, pageWidth - margin - 6, 58, { align: "right" });

      // ========== TABLE SECTION ==========
      const tableData = selectedEntries.map((entry, index) => [
        String(index + 1),
        formatDate(entry.data_servico),
        entry.fornecedor.length > 25 ? entry.fornecedor.substring(0, 25) + "..." : entry.fornecedor,
        formatCpfCnpj(entry.cpf_cnpj),
        entry.numero_nf,
        entry.descricao ? (entry.descricao.length > 30 ? entry.descricao.substring(0, 30) + "..." : entry.descricao) : "-",
        formatCurrency(entry.valor),
      ]);

      autoTable(doc, {
        startY: 74,
        head: [["#", "Data", "Fornecedor", "CPF/CNPJ", "NF", "Descrição", "Valor (R$)"]],
        body: tableData,
        headStyles: {
          fillColor: [PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        alternateRowStyles: {
          fillColor: [252, 252, 252],
        },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          lineColor: [230, 230, 230],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 38 },
          3: { cellWidth: 32, halign: "center" },
          4: { cellWidth: 18, halign: "center" },
          5: { cellWidth: 38 },
          6: { cellWidth: 26, halign: "right", fontStyle: "bold" },
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addCleanBackground();
          }
        },
      });

      let currentY = (doc as any).lastAutoTable.finalY + 8;

      // ========== PAYMENT DETAILS SECTION ==========
      const entriesWithPix = selectedEntries.filter((e) => e.chave_pix);
      
      if (entriesWithPix.length > 0) {
        if (currentY > pageHeight - 80) {
          doc.addPage();
          addCleanBackground();
          currentY = 20;
        }

        // Section header
        doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.rect(margin, currentY, pageWidth - margin * 2, 8, "F");
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("DADOS PARA PAGAMENTO (PIX)", margin + 4, currentY + 5.5);
        
        currentY += 14;

        // Payment table
        const pixData = entriesWithPix.map((entry) => [
          entry.fornecedor.length > 25 ? entry.fornecedor.substring(0, 25) + "..." : entry.fornecedor,
          formatCpfCnpj(entry.cpf_cnpj),
          entry.chave_pix || "-",
          formatCurrency(entry.valor),
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [["Beneficiário", "CPF/CNPJ", "Chave PIX", "Valor"]],
          body: pixData,
          headStyles: {
            fillColor: [80, 80, 80],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8,
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 40, halign: "center" },
            2: { cellWidth: 55 },
            3: { cellWidth: 35, halign: "right", fontStyle: "bold" },
          },
          didDrawPage: (data) => {
            if (data.pageNumber > 1) {
              addCleanBackground();
            }
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // ========== ATTACHMENTS SECTION ==========
      const entriesWithAttachments = selectedEntries.filter((e) => e.anexo_url);
      
      if (entriesWithAttachments.length > 0) {
        if (currentY > pageHeight - 60) {
          doc.addPage();
          addCleanBackground();
          currentY = 20;
        }

        doc.setFillColor(100, 100, 100);
        doc.rect(margin, currentY, pageWidth - margin * 2, 8, "F");
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`ANEXOS (${entriesWithAttachments.length} documento(s))`, margin + 4, currentY + 5.5);
        
        currentY += 14;

        entriesWithAttachments.forEach((entry, index) => {
          if (currentY > pageHeight - 30) {
            doc.addPage();
            addCleanBackground();
            currentY = 20;
          }
          
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(60, 60, 60);
          doc.text(`${index + 1}. ${entry.fornecedor} (NF: ${entry.numero_nf})`, margin, currentY);
          
          doc.setFont("helvetica", "normal");
          doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
          const displayUrl = entry.anexo_url!.length > 80 ? entry.anexo_url!.substring(0, 80) + "..." : entry.anexo_url!;
          doc.textWithLink(displayUrl, margin + 4, currentY + 5, { url: entry.anexo_url! });
          
          currentY += 14;
        });
      }

      // ========== APPROVAL SECTION ==========
      if (currentY > pageHeight - 70) {
        doc.addPage();
        addCleanBackground();
        currentY = 20;
      } else {
        currentY += 10;
      }

      // Approval box
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 50, 2, 2, "S");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("APROVAÇÃO E AUTORIZAÇÃO DE PAGAMENTO", margin + 4, currentY + 7);

      // Signature lines
      const signatureY = currentY + 38;
      const signatureWidth = (pageWidth - margin * 2 - 20) / 3;

      // Solicitante
      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);
      doc.line(margin + 4, signatureY, margin + 4 + signatureWidth - 10, signatureY);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Solicitante", margin + 4 + (signatureWidth - 10) / 2, signatureY + 5, { align: "center" });

      // Gerente
      const gerente_x = margin + 4 + signatureWidth;
      doc.line(gerente_x, signatureY, gerente_x + signatureWidth - 10, signatureY);
      doc.text("Gerente da Unidade", gerente_x + (signatureWidth - 10) / 2, signatureY + 5, { align: "center" });

      // Financeiro
      const financeiro_x = margin + 4 + signatureWidth * 2;
      doc.line(financeiro_x, signatureY, financeiro_x + signatureWidth - 10, signatureY);
      doc.text("Financeiro / DP", financeiro_x + (signatureWidth - 10) / 2, signatureY + 5, { align: "center" });

      // Date field
      doc.setFontSize(8);
      doc.text("Data: ____/____/________", margin + 4, currentY + 18);

      // ========== ADD FOOTERS ==========
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }

      // ========== DOWNLOAD ==========
      const dateStr = today.toLocaleDateString("pt-BR").replace(/\//g, "-");
      const fileName = `ORDEM_PAGAMENTO_MANUTENCAO_${displayLoja.toUpperCase().replace(/\s+/g, "_")}_${dateStr}.pdf`;
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
