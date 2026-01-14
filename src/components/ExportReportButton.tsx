import { useState } from "react";
import { Download, FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { jsPDF } from "jspdf";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import { exportToExcel } from "@/lib/excelUtils";
import { FreelancerEntry } from "@/types/freelancer";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface ExportReportButtonProps {
  entries: FreelancerEntry[];
}

// Colors for PDF styling
const PRIMARY_COLOR: [number, number, number] = [0, 82, 147]; // Dark blue
const SECONDARY_COLOR: [number, number, number] = [100, 100, 100]; // Gray
const ACCENT_COLOR: [number, number, number] = [0, 120, 180]; // Light blue

// Placeholder for letterhead background - can be replaced with actual base64 image
// The image should be a full-page background (A4: 210mm x 297mm)
const BACKGROUND_IMAGE_BASE64 = ""; // To be configured with actual letterhead

export function ExportReportButton({ entries }: ExportReportButtonProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleExportExcel = () => {
    if (entries.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }

    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm");
    const filename = `relatorio_pagamentos_${timestamp}`;

    try {
      exportToExcel(entries, filename);
      toast.success(`Relatório exportado com ${entries.length} registros.`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar relatório.");
    }
  };

  const generatePDF = async () => {
    if (entries.length === 0) {
      toast.error("Não há lançamentos para exportar.");
      return;
    }

    setIsGeneratingPDF(true);

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      // Group entries by function for summary
      const funcaoSummary: Record<string, { total: number; count: number }> = {};
      entries.forEach((entry) => {
        if (!funcaoSummary[entry.funcao]) {
          funcaoSummary[entry.funcao] = { total: 0, count: 0 };
        }
        funcaoSummary[entry.funcao].total += entry.valor;
        funcaoSummary[entry.funcao].count += 1;
      });

      const totalGeral = entries.reduce((sum, e) => sum + e.valor, 0);
      const totalColaboradores = new Set(entries.map((e) => e.cpf)).size;

      // Get unique loja for filename
      const lojas = [...new Set(entries.map((e) => e.loja))];
      const unidadeName = lojas.length === 1 ? lojas[0] : "MULTIPLAS";

      // Current date for filename
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

      // Function to add background to each page
      const addBackground = () => {
        if (BACKGROUND_IMAGE_BASE64) {
          try {
            doc.addImage(
              BACKGROUND_IMAGE_BASE64,
              "PNG",
              0,
              0,
              pageWidth,
              pageHeight,
              undefined,
              "FAST"
            );
          } catch (e) {
            console.warn("Could not add background image:", e);
          }
        }
      };

      // Function to add header to each page
      const addHeader = (pageNumber: number, totalPages: number) => {
        // Header background bar
        doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.rect(0, 0, pageWidth, 35, "F");

        // Company name
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Empresas Mult", margin, 18);

        // Document title
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("REQUISIÇÃO DE PAGAMENTO", margin, 28);

        // Page number
        doc.setFontSize(9);
        doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, 28, {
          align: "right",
        });

        // Decorative line
        doc.setDrawColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, 40, pageWidth - margin, 40);

        // Reset text color
        doc.setTextColor(0, 0, 0);
      };

      // Calculate how many entries fit per page
      const headerHeight = 50;
      const entryHeight = 32;
      const availableHeight = pageHeight - headerHeight - margin;
      const entriesPerPage = Math.floor((availableHeight - 10) / entryHeight);

      // Calculate total pages needed
      const totalDataPages = Math.ceil(entries.length / entriesPerPage);
      
      // Check if summary fits on last data page
      const entriesOnLastPage = entries.length % entriesPerPage || entriesPerPage;
      const spaceUsedOnLastPage = headerHeight + entriesOnLastPage * entryHeight;
      const summaryHeight = 60 + Object.keys(funcaoSummary).length * 6;
      const summaryFitsOnLastPage = spaceUsedOnLastPage + summaryHeight < pageHeight - margin;
      
      const totalPages = summaryFitsOnLastPage ? totalDataPages : totalDataPages + 1;

      let currentPage = 1;
      let yPos = headerHeight;

      // Add first page background and header
      addBackground();
      addHeader(currentPage, totalPages);

      // Render entries
      entries.forEach((entry, index) => {
        // Check if we need a new page
        if (yPos + entryHeight > pageHeight - margin) {
          doc.addPage();
          currentPage++;
          addBackground();
          addHeader(currentPage, totalPages);
          yPos = headerHeight;
        }

        // Entry card background
        const isEven = index % 2 === 0;
        if (isEven) {
          doc.setFillColor(245, 247, 250);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.roundedRect(margin, yPos, contentWidth, entryHeight - 2, 2, 2, "F");

        // Entry number badge
        doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.circle(margin + 8, yPos + 8, 5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(String(index + 1), margin + 8, yPos + 9.5, { align: "center" });

        // Reset text color
        doc.setTextColor(0, 0, 0);

        // Name (bold)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(entry.nome_completo.toUpperCase(), margin + 18, yPos + 8);

        // Function and Date
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        doc.text(`Função: ${entry.funcao}`, margin + 18, yPos + 14);
        doc.text(`Data: ${formatDate(entry.data_pop)}`, margin + 80, yPos + 14);

        // CPF and PIX
        doc.text(`CPF: ${entry.cpf}`, margin + 18, yPos + 20);
        doc.text(`PIX: ${entry.chave_pix}`, margin + 80, yPos + 20);

        // Value (highlighted)
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(formatCurrency(entry.valor), pageWidth - margin - 5, yPos + 14, {
          align: "right",
        });

        // Store name (small)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        doc.text(entry.loja, pageWidth - margin - 5, yPos + 22, { align: "right" });

        // Reset text color
        doc.setTextColor(0, 0, 0);

        yPos += entryHeight;
      });

      // Add summary section
      // Check if we need a new page for summary
      if (yPos + summaryHeight > pageHeight - margin) {
        doc.addPage();
        currentPage++;
        addBackground();
        addHeader(currentPage, totalPages);
        yPos = headerHeight;
      }

      yPos += 10;

      // Summary header
      doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.roundedRect(margin, yPos, contentWidth, 12, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RESUMO FINANCEIRO", margin + 5, yPos + 8);
      yPos += 18;

      // Summary by function
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Subtotal por Função:", margin, yPos);
      yPos += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      Object.entries(funcaoSummary)
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([funcao, data]) => {
          doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
          doc.text(`• ${funcao}:`, margin + 5, yPos);
          doc.setTextColor(0, 0, 0);
          doc.text(
            `${formatCurrency(data.total)} (${data.count} lançamento${data.count > 1 ? "s" : ""})`,
            margin + 50,
            yPos
          );
          yPos += 5;
        });

      yPos += 5;

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      // Total count
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      doc.text(`Total de Colaboradores: ${totalColaboradores}`, margin, yPos);
      doc.text(`Total de Lançamentos: ${entries.length}`, margin + 60, yPos);
      yPos += 10;

      // Grand total box
      doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.roundedRect(margin, yPos, contentWidth, 14, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("TOTAL GERAL:", margin + 5, yPos + 10);
      doc.text(formatCurrency(totalGeral), pageWidth - margin - 5, yPos + 10, {
        align: "right",
      });

      // Footer with generation info
      yPos = pageHeight - 10;
      doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text(
        `Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
        pageWidth / 2,
        yPos,
        { align: "center" }
      );

      // Generate filename
      const sanitizedUnidade = unidadeName
        .replace(/[^a-zA-Z0-9]/g, "_")
        .toUpperCase();
      const filename = `ORDEM_DE_PAGAMENTO_${sanitizedUnidade}_${dateStr}.pdf`;

      // Download PDF
      doc.save(filename);

      toast.success("PDF gerado com sucesso!", {
        description: filename,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={isGeneratingPDF}>
          {isGeneratingPDF ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Exportar
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={generatePDF} className="gap-2 cursor-pointer">
          <FileDown className="h-4 w-4" />
          Gerar Ordem de Pagamento (PDF)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
          <Download className="h-4 w-4" />
          Exportar Relatório (Excel)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
