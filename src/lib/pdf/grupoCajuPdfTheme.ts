import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LOGO_BASE64 } from "@/lib/logoBase64";

export const PDF_BRAND = {
  primary: [208, 89, 55] as [number, number, number],
  primaryLight: [251, 235, 230] as [number, number, number],
  secondaryText: [100, 116, 139] as [number, number, number],
  headerBg: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
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
  const margin = 12;

  // Header container with shadow effect
  doc.setFillColor(...PDF_BRAND.headerBg);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, 8, pageWidth - margin * 2, 28, 3, 3, "FD");

  // Logo
  try {
    doc.addImage(LOGO_BASE64, "JPEG", margin + 5, 10, 30, 22);
  } catch {
    // Fallback if logo fails
  }

  // Title
  doc.setTextColor(...PDF_BRAND.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, margin + 40, 18);

  // Subtitle
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_BRAND.secondaryText);
    doc.text(subtitle, margin + 40, 24);
  }

  // Meta line (unit + date)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  const metaLine = [
    unitName ? unitName.toUpperCase() : null,
    `Emitido: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
  ]
    .filter(Boolean)
    .join(" • ");
  doc.text(metaLine, margin + 40, 30);

  // Right tag (score badge)
  if (rightTag) {
    const tagWidth = 36;
    const tagX = pageWidth - margin - tagWidth - 4;
    doc.setFillColor(...PDF_BRAND.primary);
    doc.roundedRect(tagX, 12, tagWidth, 12, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(rightTag, tagX + tagWidth / 2, 20, { align: "center" });
  }

  // Bottom accent line
  doc.setDrawColor(...PDF_BRAND.primary);
  doc.setLineWidth(1);
  doc.line(margin, 38, pageWidth - margin, 38);
}

export function addGrupoCajuFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Footer line
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

  // Footer text
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Portal da Liderança • Grupo Caju", margin, pageHeight - 7);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
}

export function addSectionHeader(doc: jsPDF, label: string, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;

  // Section bar
  doc.setFillColor(...PDF_BRAND.primary);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 8, 1.5, 1.5, "F");

  // Section label
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label.toUpperCase(), margin + 4, y + 5.5);
}

export function addInfoBox(
  doc: jsPDF,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    value: string;
    color?: [number, number, number];
  }
) {
  const { x, y, width, height, label, value, color = PDF_BRAND.primary } = params;

  // Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, height, 2, 2, "FD");

  // Label
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.text(label, x + 4, y + 6);

  // Value
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...color);
  doc.text(value, x + 4, y + 14);
}
