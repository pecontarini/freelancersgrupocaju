import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { PDF_COLORS, PDF_LAYOUT, getScoreColor, addPageFooter, addContinuationHeader, addSignaturePage } from "@/lib/pdf/grupoCajuPdfTheme";
import { addImageFromUrl } from "@/lib/pdf/pdfImageUtils";

/**
 * GRUPO CAJU - CHECKLIST PDF HELPERS
 * 
 * Helpers específicos para PDFs de Checklist Diário e Relatório NC.
 * Seguem o design system institucional definido em grupoCajuPdfTheme.ts.
 */

// ============================================================
// 1. CHECKLIST COVER PAGE
// ============================================================

export interface ChecklistCoverParams {
  title: string;
  subtitle?: string;
  sectorName: string;
  unitName: string;
  appliedBy: string;
  date: string;
  templateName?: string;
  score: number;
  conforming: number;
  nonConforming: number;
}

export function addChecklistCover(doc: jsPDF, params: ChecklistCoverParams): void {
  const { title, subtitle, sectorName, unitName, appliedBy, date, templateName, score, conforming, nonConforming } = params;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;
  const margin = PDF_LAYOUT.margin;
  const scoreColor = getScoreColor(score);

  // Logo centered at top
  try {
    doc.addImage(LOGO_BASE64, "JPEG", centerX - 20, 25, 40, 28);
  } catch { /* fallback */ }

  // Institutional line under logo
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(1);
  doc.line(margin, 60, pageWidth - margin, 60);

  // Main title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text(title, centerX, 80, { align: "center" });

  // Subtitle
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(...PDF_COLORS.graphite);
    doc.text(subtitle, centerX, 90, { align: "center" });
  }

  // Institutional data block
  const blockY = 108;
  const blockHeight = templateName ? 70 : 55;

  doc.setFillColor(...PDF_COLORS.gray50);
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin + 15, blockY, pageWidth - margin * 2 - 30, blockHeight, 3, 3, "FD");

  const leftX = margin + 30;
  let labelY = blockY + 14;

  // Sector
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("SETOR", leftX, labelY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(sectorName.toUpperCase(), leftX, labelY + 7);

  // Unit
  labelY += 19;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("UNIDADE", leftX, labelY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(unitName, leftX, labelY + 7);

  // Template (if present)
  if (templateName) {
    labelY += 19;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text("TEMPLATE", leftX, labelY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_COLORS.graphite);
    doc.text(templateName, leftX, labelY + 7);
  }

  // Right side: Applied by + Date
  const rightX = pageWidth - margin - 30;
  labelY = blockY + 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("APLICADO POR", rightX, labelY, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(appliedBy, rightX, labelY + 7, { align: "right" });

  labelY += 19;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("DATA / HORA", rightX, labelY, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(date, rightX, labelY + 7, { align: "right" });

  // Performance indicators
  const indicatorsY = blockY + blockHeight + 20;
  const boxWidth = (pageWidth - margin * 2 - 24) / 3;
  const boxHeight = 50;
  const boxGap = 12;

  // Score box
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...scoreColor);
  doc.setLineWidth(2);
  doc.roundedRect(margin, indicatorsY, boxWidth, boxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("NOTA", margin + boxWidth / 2, indicatorsY + 14, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...scoreColor);
  doc.text(`${Math.round(score)}%`, margin + boxWidth / 2, indicatorsY + 37, { align: "center" });

  // Conforming box
  const box2X = margin + boxWidth + boxGap;
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...PDF_COLORS.success);
  doc.setLineWidth(2);
  doc.roundedRect(box2X, indicatorsY, boxWidth, boxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("CONFORMES", box2X + boxWidth / 2, indicatorsY + 14, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...PDF_COLORS.success);
  doc.text(String(conforming), box2X + boxWidth / 2, indicatorsY + 37, { align: "center" });

  // Non-conforming box
  const box3X = margin + (boxWidth + boxGap) * 2;
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(... (nonConforming > 0 ? PDF_COLORS.danger : PDF_COLORS.success));
  doc.setLineWidth(2);
  doc.roundedRect(box3X, indicatorsY, boxWidth, boxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("NÃO CONFORMES", box3X + boxWidth / 2, indicatorsY + 14, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...(nonConforming > 0 ? PDF_COLORS.danger : PDF_COLORS.success));
  doc.text(String(nonConforming), box3X + boxWidth / 2, indicatorsY + 37, { align: "center" });

  // Bottom institutional line
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - 40, pageWidth - margin, pageHeight - 40);

  // Confidentiality notice
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray400);
  doc.text("Documento de uso interno • Grupo Caju", centerX, pageHeight - 30, { align: "center" });
}

// ============================================================
// 2. PHOTO EVIDENCE CARD
// ============================================================

export interface PhotoEvidenceCardParams {
  x: number;
  y: number;
  w: number;
  h: number;
  imageUrl: string;
  itemText: string;
  observation?: string;
  index: number;
}

export async function addPhotoEvidenceCard(
  doc: jsPDF,
  params: PhotoEvidenceCardParams
): Promise<number> {
  const { x, y, w, h, imageUrl, itemText, observation, index } = params;
  const imgH = h;
  const cardPadding = 4;
  const labelHeight = 12;
  const obsHeight = observation ? 10 : 0;
  const totalCardHeight = cardPadding + imgH + labelHeight + obsHeight + cardPadding;

  // Card border
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, totalCardHeight, 3, 3, "FD");

  // Index badge (institutional red circle)
  const badgeX = x + w - 8;
  const badgeY = y + 4;
  doc.setFillColor(...PDF_COLORS.institutional);
  doc.circle(badgeX, badgeY + 3, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(String(index), badgeX, badgeY + 4.5, { align: "center" });

  // Image area
  const imgX = x + cardPadding;
  const imgY = y + cardPadding;
  const imgW = w - cardPadding * 2;

  const added = await addImageFromUrl(doc, imageUrl, imgX, imgY, imgW, imgH);
  if (!added) {
    // Placeholder
    doc.setFillColor(...PDF_COLORS.gray100);
    doc.roundedRect(imgX, imgY, imgW, imgH, 2, 2, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray400);
    doc.text("Foto indisponível", imgX + imgW / 2, imgY + imgH / 2, { align: "center" });
  }

  // Item text below image
  const textY = y + cardPadding + imgH + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.graphite);
  const truncatedText = itemText.length > 50 ? itemText.substring(0, 47) + "..." : itemText;
  doc.text(truncatedText, x + cardPadding, textY);

  // Observation (if present)
  if (observation) {
    const obsY = textY + 5;
    // Observation background
    doc.setFillColor(...PDF_COLORS.gray50);
    doc.roundedRect(x + cardPadding, obsY - 2, w - cardPadding * 2, 8, 1, 1, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(...PDF_COLORS.gray600);
    const truncatedObs = observation.length > 60 ? observation.substring(0, 57) + "..." : observation;
    doc.text(truncatedObs, x + cardPadding + 2, obsY + 3);
  }

  return totalCardHeight;
}

// ============================================================
// 3. CORRECTION LINK BOX
// ============================================================

export function addCorrectionLinkBox(doc: jsPDF, y: number, url: string): number {
  const margin = PDF_LAYOUT.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const boxW = pageWidth - margin * 2;
  const boxH = 55;

  // Outer box with thick institutional border
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(2);
  doc.roundedRect(margin, y, boxW, boxH, 4, 4, "FD");

  // Inner accent bar at top
  doc.setFillColor(...PDF_COLORS.institutional);
  doc.rect(margin + 1, y + 1, boxW - 2, 6, "F");

  // Clipboard icon (geometric shapes)
  const iconX = centerX;
  const iconY = y + 16;
  
  // Clipboard body
  doc.setFillColor(...PDF_COLORS.gray200);
  doc.roundedRect(iconX - 5, iconY, 10, 12, 1, 1, "F");
  doc.setFillColor(...PDF_COLORS.institutional);
  doc.roundedRect(iconX - 3, iconY - 2, 6, 4, 1, 1, "F");
  
  // Check lines
  doc.setDrawColor(...PDF_COLORS.gray500);
  doc.setLineWidth(0.3);
  doc.line(iconX - 3, iconY + 5, iconX + 3, iconY + 5);
  doc.line(iconX - 3, iconY + 8, iconX + 1, iconY + 8);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text("Registrar Correções", centerX, y + 34, { align: "center" });

  // Instruction
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray600);
  doc.text("Acesse o link abaixo para registrar as correções com foto comprobatória:", centerX, y + 41, { align: "center" });

  // URL with link
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.institutional);
  
  // Truncate URL if too long for display
  const maxUrlWidth = boxW - 20;
  let displayUrl = url;
  while (doc.getTextWidth(displayUrl) > maxUrlWidth && displayUrl.length > 30) {
    displayUrl = displayUrl.substring(0, displayUrl.length - 4) + "...";
  }
  
  doc.textWithLink(displayUrl, centerX - doc.getTextWidth(displayUrl) / 2, y + 49, { url });

  // Underline the URL
  const urlWidth = doc.getTextWidth(displayUrl);
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(0.3);
  doc.line(centerX - urlWidth / 2, y + 50, centerX + urlWidth / 2, y + 50);

  return y + boxH + 10;
}

// ============================================================
// 4. PHOTO EVIDENCE SECTION (full section with header)
// ============================================================

export interface PhotoItem {
  itemText: string;
  photoUrl: string;
  observation?: string;
}

export async function addPhotoEvidenceSection(
  doc: jsPDF,
  startY: number,
  photos: PhotoItem[]
): Promise<void> {
  if (photos.length === 0) return;

  const margin = PDF_LAYOUT.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  let y = startY;

  // Check if we need a new page for the section header
  if (y > pageHeight - 100) {
    doc.addPage();
    y = addContinuationHeader(doc, "Evidências Fotográficas");
  }

  // Section separator
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 50, y);
  y += 8;

  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text("Evidências Fotográficas", margin, y);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text(`${photos.length} registro(s) de não conformidade`, margin, y + 7);
  y += 16;

  // 2-column grid
  const colGap = 10;
  const cardW = (pageWidth - margin * 2 - colGap) / 2;
  const imgH = 45;
  let colIdx = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const x = margin + colIdx * (cardW + colGap);

    // Estimate card height
    const estimatedCardH = 4 + imgH + 12 + (photo.observation ? 10 : 0) + 4;

    // Check if we need a new page
    if (y + estimatedCardH > pageHeight - 20) {
      doc.addPage();
      y = addContinuationHeader(doc, "Evidências Fotográficas");
      colIdx = 0;
    }

    const actualX = margin + colIdx * (cardW + colGap);
    const cardHeight = await addPhotoEvidenceCard(doc, {
      x: actualX,
      y,
      w: cardW,
      h: imgH,
      imageUrl: photo.photoUrl,
      itemText: photo.itemText,
      observation: photo.observation,
      index: i + 1,
    });

    colIdx++;
    if (colIdx >= 2) {
      colIdx = 0;
      y += cardHeight + 8;
    }
  }

  // Advance Y if last row was incomplete
  if (colIdx > 0) {
    y += 4 + imgH + 12 + 4 + 8;
  }
}
