import { useState } from "react";
import { Download, FileDown, FileText, Loader2 } from "lucide-react";
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
import { LOGO_BASE64 } from "@/lib/logoBase64";

interface ExportReportButtonProps {
  entries: FreelancerEntry[];
  variant?: "dropdown" | "button";
  customTitle?: string;
  dateRange?: { start: string | null; end: string | null };
}

// Colors for PDF styling - Using CajuPAR brand colors (Coral/Terracotta: HSL 14, 70%, 48%)
// Converted to RGB: hsl(14, 70%, 48%) ≈ rgb(208, 89, 55)
const PRIMARY_COLOR: [number, number, number] = [208, 89, 55]; // Coral/Terracotta brand color
const SECONDARY_COLOR: [number, number, number] = [100, 100, 100]; // Gray
const ACCENT_COLOR: [number, number, number] = [180, 70, 45]; // Darker coral accent

// Utility functions
const sanitizeFilename = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toUpperCase();
};

const getPopDateString = (entries: FreelancerEntry[]): string => {
  if (entries.length === 0) return new Date().toISOString().split("T")[0];
  
  // Get the most common POP date or the most recent one
  const dateCounts: Record<string, number> = {};
  entries.forEach((entry) => {
    dateCounts[entry.data_pop] = (dateCounts[entry.data_pop] || 0) + 1;
  });
  
  const sortedDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]);
  return sortedDates[0]?.[0] || new Date().toISOString().split("T")[0];
};

export function ExportReportButton({ 
  entries, 
  variant = "dropdown",
  customTitle,
  dateRange,
}: ExportReportButtonProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleExportExcel = () => {
    if (entries.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    exportToExcel(entries, "relatorio_freelancers");
    toast.success("Relatório exportado com sucesso!");
  };

  const generatePDF = async () => {
    if (entries.length === 0) {
      toast.error("Nenhum registro para gerar PDF");
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

      // Calculate totals
      const totalGeral = entries.reduce((sum, e) => sum + e.valor, 0);
      const totalColaboradores = new Set(entries.map((e) => e.cpf)).size;

      // Get unique store/unidade - use most common if multiple OR use customTitle
      const lojaCounts: Record<string, number> = {};
      entries.forEach((entry) => {
        lojaCounts[entry.loja] = (lojaCounts[entry.loja] || 0) + 1;
      });
      const sortedLojas = Object.entries(lojaCounts).sort((a, b) => b[1] - a[1]);
      const unidadeName = customTitle || sortedLojas[0]?.[0] || "TODAS";

      // Get date range for filename
      let formattedDateForFilename: string;
      if (dateRange?.start && dateRange?.end) {
        const [sYear, sMonth, sDay] = dateRange.start.split("-");
        const [eYear, eMonth, eDay] = dateRange.end.split("-");
        formattedDateForFilename = `${sDay}-${sMonth}-${sYear}_A_${eDay}-${eMonth}-${eYear}`;
      } else {
        const popDateStr = getPopDateString(entries);
        const [year, month, day] = popDateStr.split("-");
        formattedDateForFilename = `${day}-${month}-${year}`;
      }

      // Helper function to add clean background
      const addBackground = () => {
        // Clean white background
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
      };

      // Helper function to add header with logo
      const addHeader = (pageNum: number, totalPages: number) => {
        // Header background
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, 45, "F");
        
        // Add logo - Draw it at the left
        try {
          doc.addImage(LOGO_BASE64, "JPEG", margin, 8, 30, 25);
        } catch (error) {
          console.error("Error adding logo:", error);
        }

        // Title next to logo
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`GRUPO CAJU - ${unidadeName.toUpperCase()}`, margin + 35, 18);

        // Subtitle
        doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text("ORDEM DE PAGAMENTO - FREELANCERS", margin + 35, 26);

        // Date and page info
        doc.setFontSize(9);
        const dateDisplayText = dateRange?.start && dateRange?.end
          ? `Período: ${formatDate(dateRange.start)} a ${formatDate(dateRange.end)}`
          : `Data do POP: ${formatDate(getPopDateString(entries))}`;
        doc.text(dateDisplayText, margin + 35, 33);
        doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, 33, { align: "right" });

        // Divider line
        doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.setLineWidth(0.8);
        doc.line(margin, 42, pageWidth - margin, 42);
      };

      // Calculate pagination
      const headerHeight = 48;
      const entryHeight = 26;
      const entriesPerPage = Math.floor((pageHeight - headerHeight - margin) / entryHeight);
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

      // Generate filename with sanitized store name and POP date
      const sanitizedUnidade = sanitizeFilename(unidadeName);
      const filename = `ORDEM_DE_PAGAMENTO_${sanitizedUnidade}_${formattedDateForFilename}.pdf`;

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

  // Simple button variant for prominent placement
  if (variant === "button") {
    return (
      <Button 
        onClick={generatePDF} 
        disabled={isGeneratingPDF}
        className="gap-2"
      >
        {isGeneratingPDF ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando PDF...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Gerar Ordem de Pagamento (PDF)
          </>
        )}
      </Button>
    );
  }

  // Dropdown variant (default)
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
