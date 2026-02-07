import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LOGO_BASE64 } from "@/lib/logoBase64";

export const PDF_BRAND = {
  primary: [208, 89, 55] as [number, number, number],
  secondaryText: [100, 100, 100] as [number, number, number],
  headerBg: [245, 245, 245] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
};

export function addGrupoCajuHeader(
  doc: jsPDF,
  params: {
    title: string;
    subtitle?: string;
    rightTag?: string;
    unitName?: string;
  }
) {
  const { title, subtitle, rightTag, unitName } = params;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // Header container
  doc.setFillColor(...PDF_BRAND.headerBg);
  doc.roundedRect(margin, 8, pageWidth - margin * 2, 26, 3, 3, "F");

  // Logo
  try {
    doc.addImage(LOGO_BASE64, "JPEG", margin + 4, 11, 28, 17);
  } catch {
    // ignore
  }

  // Title
  doc.setTextColor(...PDF_BRAND.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, margin + 36, 17);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_BRAND.secondaryText);

  const metaLine = [
    unitName ? unitName.toUpperCase() : null,
    `Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
  ]
    .filter(Boolean)
    .join(" • ");

  if (subtitle) doc.text(subtitle, margin + 36, 22);
  doc.text(metaLine, margin + 36, 28);

  // Right tag
  if (rightTag) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_BRAND.primary);
    doc.setFontSize(9);
    doc.text(rightTag, pageWidth - margin - 4, 17, { align: "right" });
  }

  // Divider
  doc.setDrawColor(...PDF_BRAND.primary);
  doc.setLineWidth(0.6);
  doc.line(margin, 36, pageWidth - margin, 36);
}

export function addGrupoCajuFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Documento gerado automaticamente pelo Portal da Liderança", margin, pageHeight - 9);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: "right" });
}

export function addSectionHeader(doc: jsPDF, label: string, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  doc.setFillColor(...PDF_BRAND.primary);
  doc.rect(margin, y, pageWidth - margin * 2, 7, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label.toUpperCase(), margin + 3, y + 5);
}
