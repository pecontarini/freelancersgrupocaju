import { useState } from "react";
import jsPDF from "jspdf";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";
import { LOGO_BASE64 } from "@/lib/logoBase64";

// Brand colors (Grupo Caju)
const PRIMARY_COLOR: [number, number, number] = [208, 89, 55]; // Coral/Terracotta
const SECONDARY_COLOR: [number, number, number] = [100, 100, 100]; // Gray
const HEADER_BG: [number, number, number] = [245, 245, 245]; // Light gray background

interface MaintenanceSingleExportButtonProps {
  entry: MaintenanceEntry;
}

export function MaintenanceSingleExportButton({ entry }: MaintenanceSingleExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Check if required fields are present
  const canExport = entry.valor > 0 && entry.chave_pix && entry.descricao;

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

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const today = new Date();

      // Clean background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      // ========== HEADER SECTION ==========
      doc.setFillColor(HEADER_BG[0], HEADER_BG[1], HEADER_BG[2]);
      doc.roundedRect(margin, 8, pageWidth - margin * 2, 38, 3, 3, "F");

      // Logo
      try {
        doc.addImage(LOGO_BASE64, "JPEG", margin + 4, 12, 36, 22);
      } catch (e) {
        console.error("Error adding logo:", e);
      }

      // Title
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("REQUISIÇÃO DE PAGAMENTO", margin + 48, 18);

      doc.setFontSize(12);
      doc.text("MANUTENÇÃO", margin + 48, 26);

      // Document number
      const docNumber = `MNT-${entry.id.substring(0, 8).toUpperCase()}`;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Nº ${docNumber}`, pageWidth - margin - 4, 18, { align: "right" });

      // Emission date
      doc.setFont("helvetica", "normal");
      doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      doc.text(
        `Emitido em: ${today.toLocaleDateString("pt-BR")} às ${today.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
        margin + 48,
        33
      );

      let currentY = 56;

      // ========== DADOS DA UNIDADE ==========
      doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.rect(margin, currentY, pageWidth - margin * 2, 8, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("DADOS DA UNIDADE", margin + 4, currentY + 5.5);

      currentY += 14;

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Unidade: ${entry.loja.toUpperCase()}`, margin, currentY);

      currentY += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      doc.text(`Data do Serviço: ${formatDate(entry.data_servico)}`, margin, currentY);
      doc.text(`Nota Fiscal: ${entry.numero_nf}`, margin + 70, currentY);

      currentY += 16;

      // ========== DADOS DO PRESTADOR ==========
      doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.rect(margin, currentY, pageWidth - margin * 2, 8, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("DADOS DO PRESTADOR DE SERVIÇO", margin + 4, currentY + 5.5);

      currentY += 14;

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(entry.fornecedor, margin, currentY);

      currentY += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
      doc.text(`CPF/CNPJ: ${formatCpfCnpj(entry.cpf_cnpj)}`, margin, currentY);

      currentY += 16;

      // ========== DETALHAMENTO DO SERVIÇO ==========
      doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.rect(margin, currentY, pageWidth - margin * 2, 8, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("DETALHAMENTO DO SERVIÇO", margin + 4, currentY + 5.5);

      currentY += 14;

      // Service description box with special styling
      const descriptionBoxHeight = 40;
      doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.setLineWidth(1.5);
      doc.setFillColor(252, 250, 248);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, descriptionBoxHeight, 3, 3, "FD");

      doc.setTextColor(40, 40, 40);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");

      // Word wrap for description
      const maxWidth = pageWidth - margin * 2 - 10;
      const description = entry.descricao || "Sem descrição";
      const lines = doc.splitTextToSize(description, maxWidth);
      doc.text(lines, margin + 5, currentY + 10);

      currentY += descriptionBoxHeight + 10;

      // ========== INFORMAÇÕES FINANCEIRAS ==========
      doc.setFillColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.rect(margin, currentY, pageWidth - margin * 2, 8, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("INFORMAÇÕES FINANCEIRAS", margin + 4, currentY + 5.5);

      currentY += 14;

      // Value box
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 30, 2, 2, "S");

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Valor do Serviço:", margin + 5, currentY + 10);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text(formatCurrency(entry.valor), margin + 5, currentY + 22);

      // PIX info
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text("Forma de Pagamento:", pageWidth / 2, currentY + 10);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Chave PIX: ${entry.chave_pix || "-"}`, pageWidth / 2, currentY + 18);

      currentY += 40;

      // ========== APPROVAL SECTION ==========
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 50, 2, 2, "S");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("APROVAÇÃO E AUTORIZAÇÃO DE PAGAMENTO", margin + 4, currentY + 7);

      // Date field
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("Data: ____/____/________", margin + 4, currentY + 18);

      // Signature lines
      const signatureY = currentY + 38;
      const signatureWidth = (pageWidth - margin * 2 - 20) / 3;

      doc.setDrawColor(100, 100, 100);
      doc.setLineWidth(0.3);

      // Solicitante
      doc.line(margin + 4, signatureY, margin + 4 + signatureWidth - 10, signatureY);
      doc.setFontSize(7);
      doc.text("Solicitante", margin + 4 + (signatureWidth - 10) / 2, signatureY + 5, { align: "center" });

      // Gerente
      const gerente_x = margin + 4 + signatureWidth;
      doc.line(gerente_x, signatureY, gerente_x + signatureWidth - 10, signatureY);
      doc.text("Gerente da Unidade", gerente_x + (signatureWidth - 10) / 2, signatureY + 5, { align: "center" });

      // Financeiro
      const financeiro_x = margin + 4 + signatureWidth * 2;
      doc.line(financeiro_x, signatureY, financeiro_x + signatureWidth - 10, signatureY);
      doc.text("Financeiro / DP", financeiro_x + (signatureWidth - 10) / 2, signatureY + 5, { align: "center" });

      currentY += 60;

      // ========== ANEXO SECTION ==========
      if (entry.anexo_url) {
        if (currentY > pageHeight - 80) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFillColor(100, 100, 100);
        doc.rect(margin, currentY, pageWidth - margin * 2, 8, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("ANEXO - NOTA FISCAL / COMPROVANTE", margin + 4, currentY + 5.5);

        currentY += 14;

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);

        // Try to add the image if it's an image URL
        const isImageUrl = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(entry.anexo_url);

        if (isImageUrl) {
          try {
            // Create a new image and load it
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            await new Promise<void>((resolve, reject) => {
              img.onload = () => {
                try {
                  // Calculate dimensions to fit in page
                  const maxImgWidth = pageWidth - margin * 2;
                  const maxImgHeight = pageHeight - currentY - 30;
                  
                  let imgWidth = img.width;
                  let imgHeight = img.height;
                  
                  // Scale down if needed
                  if (imgWidth > maxImgWidth) {
                    const ratio = maxImgWidth / imgWidth;
                    imgWidth = maxImgWidth;
                    imgHeight = imgHeight * ratio;
                  }
                  
                  if (imgHeight > maxImgHeight) {
                    const ratio = maxImgHeight / imgHeight;
                    imgHeight = maxImgHeight;
                    imgWidth = imgWidth * ratio;
                  }
                  
                  // Center the image
                  const xOffset = (pageWidth - imgWidth) / 2;
                  
                  doc.addImage(img, "JPEG", xOffset, currentY, imgWidth, imgHeight);
                  resolve();
                } catch (e) {
                  reject(e);
                }
              };
              img.onerror = () => {
                reject(new Error("Failed to load image"));
              };
              img.src = entry.anexo_url!;
            });
          } catch (e) {
            console.error("Error adding attachment image:", e);
            // Fallback to link
            doc.text("Anexo disponível em:", margin, currentY);
            const displayUrl = entry.anexo_url.length > 80 
              ? entry.anexo_url.substring(0, 80) + "..." 
              : entry.anexo_url;
            doc.textWithLink(displayUrl, margin, currentY + 6, { url: entry.anexo_url });
          }
        } else {
          // For non-image files, just show the link
          doc.text("Anexo disponível em:", margin, currentY);
          const displayUrl = entry.anexo_url.length > 80 
            ? entry.anexo_url.substring(0, 80) + "..." 
            : entry.anexo_url;
          doc.textWithLink(displayUrl, margin, currentY + 6, { url: entry.anexo_url });
        }
      }

      // ========== FOOTER ==========
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

        doc.setTextColor(150, 150, 150);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text("Documento gerado automaticamente pelo Sistema Grupo Caju", margin, pageHeight - 12);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 12, { align: "right" });
      }

      // ========== DOWNLOAD ==========
      const dateStr = formatDate(entry.data_servico).replace(/\//g, "-");
      const fileName = `OP_Manutencao_${entry.loja.replace(/\s+/g, "_")}_${dateStr}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!canExport) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button variant="ghost" size="icon" disabled>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Preencha Valor, Chave PIX e Descrição para gerar PDF</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={generatePDF}
            disabled={isGenerating}
          >
            <FileText className={`h-4 w-4 ${isGenerating ? "animate-pulse" : "text-primary"}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Gerar Ordem de Pagamento (PDF)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
