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

// Colors for PDF styling - Using Grupo Caju brand colors (Coral/Terracotta: HSL 14, 70%, 48%)
// Converted to RGB: hsl(14, 70%, 48%) ≈ rgb(208, 89, 55)
const PRIMARY_COLOR: [number, number, number] = [208, 89, 55]; // Coral/Terracotta brand color
const SECONDARY_COLOR: [number, number, number] = [100, 100, 100]; // Gray
const ACCENT_COLOR: [number, number, number] = [180, 70, 45]; // Darker coral accent

// Grupo Caju Logo Base64
const LOGO_BASE64 = "data:image/jpeg;base64,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iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9D5X3LTWPGRUO5vUU0uQK/IbH9UA7gj3qlI+Bg1K7DGRVGRs1SRhUtYglbvWVO+DxV6V+2ay5mznNdMFoedURnTMc1jXDHnmtSZqxbhhg13QWp5VVGZOeOaw5jkGta4YYxisSdgARXbBHjVDLnJrFnOTWvMwrGnPP0rvijx6plznismfvWnOwORWTLzk12RR5FQz5SaoS8k1dlqg/euyK0PMminJ0qofvfhVt/uiqbH5s+1b9TjaKrnNRt1p555pjda1RzyGN901BUrnjFRUzBhUdSVHWhLCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/R+V9y01jxkVDub1FNLkCvyGx/VAO4I96pSPgYNSuwxkVRkbNUkYVLWIJW71lTvg8VelftmlTtmumB59RGdMxzWNcMeea1JmrFuGGDXdBanlVUZk545rDmOQa1rhhjGKxJ2ABFdsEeNUMucmsWc5Na8zCsac8/Su+KPHqmXOeKyZ+9ac7A5FZMvOTXZFHkVDPlJqhLyTV2WqD967IrQ8yaKcnSqh+9+FW3+6Kpsf8AV81v1ONoqsB1prda0Kx7iQpJgVSkc8xvtTKWkqzNu4VHUlR1oSwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/0vlfctNY8ZFQ7m9RTS5Ar8hsf1QDuCPeqUj4GDUrsM4qjI2apIwqWsQSt3rKnfB4q9K/bNKnbNdMDz6iM6ZjmsW4Y481qTNWLcHGa7oLU8qqjMnPHNYcxyDWtcMMYxWJOwAIrtgjxqhlzk1iznJrXmYVjTnBxXfFHj1TLnPFZM/etOdgcisuXnJrsijyKhnyk1Ql5Jq7LVF+OtdkVoefNFKTpVQ/e/Crb/dFU3x/q+a36nG0VXHSmeaN2KvTLvcfJtxVIqofcepqihHYRu5PWmVZVozG+RyDxUe9fT9a0IKdFPJB6U2gQUUUUCCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA/9P5X3LTWPGRUO5vUU0uQK/IbH9UA7gj3qlI+Bg1K7DGRVGRs1SRhUtYglbvWVO+DxV6V+2ay5mznNdMFoedURnTMc1i3DHnmtSZqxbg4zXdBanlVUZk545rDmOQa1rhhjGKxJ2ABFdsEeNUMucmsWc5Na8zCsac4OK74o8eqZc54rJn71pzsDkVly85NdkUeRUM+UmqEvJNXZaov867IrQ8+aKUnSqh+9+FW3+6Kpv/AKvmt+pxtFVx0pjnay571oVgzyCS4OxduKpIJYtbmJEYs3B9qktbdHYiRsYNajLlT5IwoHQVDbQqszEnnGK1DtkbHdXCmhFcs16yCQzRHoq7awbnmTj0roLtyXI9hXP3Ryxrow62PKxL95kNFFFdB5gUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//1PlfctNY8ZFQ7m9RTS5Ar8hsf1QDuCPeqUj4GDUrsM4qjI2apIwqWsQSt3rKnfB4q9K/bNZczZzmumB59RGdMxzWLcHGa1JmrFuGAGK7oLU8qqjMnPHNYcxyDWtcMMYxWJOwAIrtgjxqhlzk1iznJrXmYVjTnBxXfFHj1TLnPFZM/etOdgcisuXnJrsijyKhnyk1Ql5Jq7LVF+OtdkVoefNFKTpVQ/e/Crb/AHRVNz+7/Gt+pxtFVx0prvxkVqxjzPlXArCldjckE4zUMJFqFQjd0FSVNbHdIMDJFTtbRLN5m04I6Uzc88muIZHbBGB1q0kiQnaT0qp5IMgc/Ma0ILcsxO0VYC2GbqvQVS+1Z7VPLCdp4ovT9jTjc0rqV1nZQeAapT9auzxmK4ctnGc1UnHJrsjsePX3K9FFFdB5gUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH/9X5X3LTWPGRUO5vUU0uQK/IbH9UA7gj3qlI+Bg1K7DGRVIS4PNVtBNFWaT1qhJJ6CrUvVqoSEVaYvsjHlyAR1rKnbB4pZ5DurPmkLdGNdCR51SehJM1Y0xz0NPMjf3jUDEk5JreB589SKVqpuzAnB5pzOW5Y5NQ10I5mxaKKKoQUUUUAFFFFABRRRQB9P/APBPz/k5/wALf9cb7/0nevoj9vL/AJLdN/2Drf8Amaq/sXaFq8P7Q/hXV5bOaOzVLsNOyEJnYeCTXU/8FFfD+sX3xks9RtLGeaD+z7dcojEdW5wK/Sss/wCRRW9Jf+kn4VnH/I/of9u/+lH51UUUV9gfFhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//9b5X3LTWPGRUO5vUU0uQK/IbH9UA7gj3qlI+Bg1K7DOKoyNmqSMKlrEErd6yp3weKvSv2zSpweTXTA8+ojOmY5rHmOQa1JmrFuGGMYrugtTyqqMycgYxWHMwAIrYnYAEVjT9a64R0PJqMqFjnOKjqQ/eNRmu1I8yTEooopiCiiigAooooAKKKKACiiigD9sP2U/+TdvA3/XjJ/6Mevlf/gol/ycNbf9g22/9CavsD9kq/s7f9nbwPDLPGkgtZchmAP+sbrXxP8A8FCdQsrv46W0VtPHI66VbAlGBI+Zug+tfpGV/wDIor+kv/ST8LzX/kfUf+3f/Sj89aKKK+wPigooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9f5X3LTWPGRUO5vUU0uQK/IbH9UA7gj3qlI+Bg1K7DOKoyNmqSMKlrEErd6yp3weKvSv2zSpxya6YHn1EZ0zHNY8xyDWnM1Y0/Wu6C1PLqozpyBjFYczAAitediARWNcMBmu2COGpLQrFjnOKjLHOc00uc5pDXakkeTKYtFFFWSFFFFABRRRQAUUUUAFFFFABRRRQB+yP7Iev6bqX7Ofg+2tZVeS1tpopADyGEhOD+dfHv/AAUB8Qadqfx0jtLKVZG0+whhm2nOHyWwfcA1ifs5/tLN8CvD+raJH4dXVjqcyzGQzGLb8uMfdrz34/fHC4+PfiqHxbc6UumPBbLbrGspmBCsWznA65r9JwuBrU8srUWveklfW3S+x+F43MMPWz6hWj8EJWaaa7r/ACPlmiiivoD4UKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0PlfctNY8ZFQ7m9RTS5Ar8hsf1QDuCPeqUj4GDUrsM4qjI2apIwqWsQSt3rKnfB4q9K/bNKnbNdMDz6iM6Zjmsaf71akzVi3BxXdBanlVUZ05AxisOZgARWxOwAIrGn613xR5FR2K5Y5zSUhODz3pK60jypMKKKKokKKKKACiiigAooooAKKKKACiiigAooooA+kP2QPHHhj4d/GjTPFXiy8+xaZBDOrzbGf5nUgDABr1L9r/wCOnw0+N+veH9T8BX/2yKwtWhmHluuxyc43ED/PWvi2iu6nj606MqDdk35HiVsprU8TDF2XNG6+8KKKK7DyQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//0flfctNY8ZFQ7m9RTS5Ar8hsf1QDuCPeqUj4GDUrsM4qjI2apIwqWsQSt3rKnfB4q9K/bNZczZzmumB59RGdMxzWPO2OlacxzxWNMcV3QWp5VV2IGPzH6ZpAc59aaelJyc121EebEKKKKgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/9L5X3LTWPGRUO5vUU0uQK/IbH9UA7gj3qlI+Bg1K7DOKoyNmqSMKlrEErd6yp3weKvSv2zWXMx5zXTA8+ojOmY5rHnbHStOY54rGmOK7oLU8qq7EDH5j9M0gOc+tNPSk5Odu6u2ojzYhRRRUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB/9P5X3LTWPGRUO5vUU0uQK/IbH9UA7gj3qlI+Bg1K7DOKoyNmqSMKlrEErd6yp3weKvSv2zWXMx5zXTA8+ojOmY5rHnbHStOY54rGmOK7oLU8qq7EDH5j9M0gOc+tNPSk5Odu6u2ojzYhRRRUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQ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";

// Placeholder for letterhead background - can be replaced with actual base64 image
// The image should be a full-page background (A4: 210mm x 297mm)
const BACKGROUND_IMAGE_BASE64 = ""; // To be configured with actual letterhead

// Helper to sanitize filename (remove special chars and spaces)
const sanitizeFilename = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-zA-Z0-9]/g, "_") // Replace special chars with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_|_$/g, "") // Remove leading/trailing underscores
    .toUpperCase();
};

// Helper to get POP date from entries (the date the payment refers to)
const getPopDateString = (entries: FreelancerEntry[]): string => {
  if (entries.length === 0) return format(new Date(), "dd-MM-yyyy");
  
  // Get unique dates from entries
  const uniqueDates = [...new Set(entries.map((e) => e.data_pop))];
  
  if (uniqueDates.length === 1) {
    // Single date - format as DD-MM-YYYY
    const [year, month, day] = uniqueDates[0].split("-");
    return `${day}-${month}-${year}`;
  } else {
    // Multiple dates - use range or first date
    const sortedDates = uniqueDates.sort();
    const [firstYear, firstMonth, firstDay] = sortedDates[0].split("-");
    const [lastYear, lastMonth, lastDay] = sortedDates[sortedDates.length - 1].split("-");
    return `${firstDay}-${firstMonth}-${firstYear}_a_${lastDay}-${lastMonth}-${lastYear}`;
  }
};

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

      // Get unique loja for filename and header
      const lojas = [...new Set(entries.map((e) => e.loja))];
      const unidadeName = lojas.length === 1 ? lojas[0] : "MÚLTIPLAS LOJAS";

      // Get POP date for filename (the date the payment refers to, not generation date)
      const popDateStr = getPopDateString(entries);

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
        doc.rect(0, 0, pageWidth, 40, "F");

        // Add logo
        try {
          doc.addImage(LOGO_BASE64, "JPEG", margin, 5, 30, 30);
        } catch (e) {
          console.warn("Could not add logo:", e);
        }

        // Company name and store - GRUPO CAJU - [LOJA]
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text(`GRUPO CAJU - ${unidadeName.toUpperCase()}`, margin + 35, 18);

        // Document title
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("ORDEM DE PAGAMENTO", margin + 35, 28);

        // Date reference
        doc.setFontSize(10);
        const displayDate = popDateStr.replace(/_a_/g, " a ").replace(/-/g, "/");
        doc.text(`Data: ${displayDate}`, margin + 35, 35);

        // Page number
        doc.setFontSize(9);
        doc.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, 35, {
          align: "right",
        });

        // Decorative line
        doc.setDrawColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, 45, pageWidth - margin, 45);

        // Reset text color
        doc.setTextColor(0, 0, 0);
      };

      // Calculate how many entries fit per page
      const headerHeight = 55; // Increased for logo
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

      // Generate filename with sanitized store name and POP date
      const sanitizedUnidade = sanitizeFilename(unidadeName);
      const filename = `ORDEM_DE_PAGAMENTO_${sanitizedUnidade}_${popDateStr}.pdf`;

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
