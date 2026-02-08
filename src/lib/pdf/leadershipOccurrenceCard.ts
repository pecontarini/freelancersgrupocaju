import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { PDF_BRAND } from "@/lib/pdf/grupoCajuPdfTheme";
import { addImageFromUrl } from "@/lib/pdf/pdfImageUtils";

// Constants for layout
const CARD_MARGIN = 20; // mm
const CARD_PADDING = 8;
const CARD_BORDER_COLOR: [number, number, number] = [229, 231, 235]; // #E5E7EB
const ACTION_BOX_HEIGHT = 25; // mm for manual writing

/**
 * Parses item name to extract the base name and any parenthetical details
 */
function parseItemDetails(failure: SupervisionFailure): { item: string; details: string } {
  const rawItem = (failure.item_name || "Item não identificado").trim();
  
  // Check if there's a parenthetical detail in the item name
  const parenMatch = rawItem.match(/^(.*?)(?:\s*\(([^)]+)\)\s*)$/);
  const item = (parenMatch?.[1] || rawItem).trim() || "Item não identificado";
  const detailsFromName = (parenMatch?.[2] || "").trim();
  
  // Priority: explicit detalhes_falha > parenthetical detail > default
  const details = (
    failure.detalhes_falha ||
    detailsFromName ||
    "Sem observação registrada"
  ).trim();
  
  return { item, details };
}

/**
 * Calculate card height before drawing to enable proper page breaks
 */
function calculateCardHeight(
  doc: jsPDF,
  failure: SupervisionFailure,
  contentWidth: number
): number {
  const { details } = parseItemDetails(failure);
  
  // Header height
  const headerHeight = 12;
  
  // Body: observation text height (60% of content width)
  const obsWidth = (contentWidth - CARD_PADDING * 3) * 0.6 - 4;
  doc.setFontSize(9);
  const obsLines = doc.splitTextToSize(details, obsWidth);
  const obsTextHeight = Math.max(40, obsLines.length * 4.5 + 16); // min 40mm for image
  
  // Action box (fixed height)
  const actionHeight = ACTION_BOX_HEIGHT + 8;
  
  return CARD_PADDING + headerHeight + obsTextHeight + actionHeight + CARD_PADDING;
}

/**
 * Draw occurrence card with structured layout using autoTable-like grid
 */
export async function drawOccurrenceCard(
  doc: jsPDF,
  params: {
    failure: SupervisionFailure;
    index: number;
    x: number;
    y: number;
    width: number;
    maxPageY: number;
  }
): Promise<{ nextY: number; pageBreak: boolean }> {
  const { failure, index, x, y, width, maxPageY } = params;
  const contentWidth = width;
  
  // Pre-calculate card height
  const cardHeight = calculateCardHeight(doc, failure, contentWidth);
  
  // Check if we need a page break
  if (y + cardHeight > maxPageY) {
    return { nextY: y, pageBreak: true };
  }

  const { item, details } = parseItemDetails(failure);

  // ===== CARD CONTAINER (Bordered Box) =====
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...CARD_BORDER_COLOR);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, cardHeight, 2, 2, "FD");

  let currentY = y + CARD_PADDING;

  // ===== HEADER ROW =====
  const headerHeight = 10;
  
  // Left: Number badge + Item name
  const badgeRadius = 4;
  doc.setFillColor(...PDF_BRAND.primary);
  doc.circle(x + CARD_PADDING + badgeRadius, currentY + badgeRadius, badgeRadius, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(String(index + 1), x + CARD_PADDING + badgeRadius, currentY + badgeRadius + 2, { align: "center" });
  
  // Item name (bold, 11pt)
  const itemX = x + CARD_PADDING + badgeRadius * 2 + 6;
  const itemMaxWidth = width * 0.65;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const itemLines = doc.splitTextToSize(item, itemMaxWidth);
  doc.text(itemLines[0] || item, itemX, currentY + 6);
  
  // Right: Status tags
  const tagX = x + width - CARD_PADDING;
  
  // Category tag
  const category = (failure.category || "GERAL").toUpperCase();
  doc.setFillColor(241, 245, 249);
  const catWidth = doc.getTextWidth(category) + 6;
  doc.roundedRect(tagX - catWidth - 4, currentY, catWidth + 4, 7, 1, 1, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text(category, tagX - catWidth / 2 - 2, currentY + 5, { align: "center" });
  
  // Recurring badge
  if (failure.is_recurring) {
    const recurX = tagX - catWidth - 35;
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(recurX, currentY, 28, 7, 1, 1, "F");
    doc.setFontSize(6);
    doc.setTextColor(185, 28, 28);
    doc.text("⚠ REINCIDENTE", recurX + 14, currentY + 5, { align: "center" });
  }
  
  currentY += headerHeight + 4;
  
  // Separator line
  doc.setDrawColor(...CARD_BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(x + CARD_PADDING, currentY, x + width - CARD_PADDING, currentY);
  currentY += 4;

  // ===== BODY: Two columns (60% obs + 40% image) =====
  const bodyStartY = currentY;
  const leftColWidth = (width - CARD_PADDING * 3) * 0.6;
  const rightColWidth = (width - CARD_PADDING * 3) * 0.4;
  const rightColX = x + CARD_PADDING + leftColWidth + CARD_PADDING;
  
  // Left column: Observation
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("OBSERVAÇÃO:", x + CARD_PADDING, currentY + 4);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const obsLines = doc.splitTextToSize(details, leftColWidth - 4);
  doc.text(obsLines, x + CARD_PADDING, currentY + 10);
  
  const obsEndY = currentY + 10 + obsLines.length * 4.5;

  // Right column: Image placeholder
  const imageSize = Math.min(rightColWidth - 4, 38);
  const imageX = rightColX + (rightColWidth - imageSize) / 2;
  const imageY = bodyStartY;
  
  const evidenceUrl = failure.url_foto_evidencia || "";
  let imageAdded = false;

  if (evidenceUrl.startsWith("http")) {
    try {
      imageAdded = await addImageFromUrl(doc, evidenceUrl, imageX, imageY, imageSize, imageSize);
    } catch {
      imageAdded = false;
    }
  }

  if (!imageAdded) {
    // Placeholder box
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.3);
    doc.roundedRect(imageX, imageY, imageSize, imageSize, 2, 2, "FD");
    
    // Placeholder text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text("Sem", imageX + imageSize / 2, imageY + imageSize / 2 - 2, { align: "center" });
    doc.text("Imagem", imageX + imageSize / 2, imageY + imageSize / 2 + 4, { align: "center" });
  } else {
    // Image border
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.3);
    doc.rect(imageX, imageY, imageSize, imageSize);
  }

  // Link under image
  if (evidenceUrl.startsWith("http")) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(59, 130, 246);
    doc.textWithLink("Ver foto original →", imageX + imageSize / 2, imageY + imageSize + 4, { 
      url: evidenceUrl,
      align: "center"
    });
  }

  currentY = Math.max(obsEndY, imageY + imageSize + 8) + 6;

  // ===== FOOTER: Action box (dashed border) =====
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.3);
  // Draw dashed rectangle
  const actionBoxX = x + CARD_PADDING;
  const actionBoxWidth = width - CARD_PADDING * 2;
  
  // Dashed border using setLineDashPattern if available, else solid
  try {
    (doc as any).setLineDashPattern([2, 2], 0);
  } catch {
    // Fallback to solid if dashed not supported
  }
  
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(actionBoxX, currentY, actionBoxWidth, ACTION_BOX_HEIGHT, 1.5, 1.5, "FD");
  
  // Reset line dash
  try {
    (doc as any).setLineDashPattern([], 0);
  } catch {
    // Ignore
  }
  
  // Action label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text("AÇÃO CORRETIVA / PRAZO:", actionBoxX + 4, currentY + 5);
  
  // Writing guide lines
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.15);
  const lineSpacing = 5;
  for (let i = 1; i <= 3; i++) {
    const lineY = currentY + 8 + i * lineSpacing;
    if (lineY < currentY + ACTION_BOX_HEIGHT - 2) {
      doc.line(actionBoxX + 4, lineY, actionBoxX + actionBoxWidth - 4, lineY);
    }
  }

  return { nextY: y + cardHeight + 6, pageBreak: false };
}

/**
 * Draw multiple occurrence cards with automatic pagination
 */
export async function drawOccurrenceCards(
  doc: jsPDF,
  failures: SupervisionFailure[],
  startY: number,
  onNewPage: () => number // Returns startY for new page
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = CARD_MARGIN;
  const cardWidth = pageWidth - margin * 2;
  const maxY = pageHeight - 25; // Leave space for footer

  let y = startY;

  for (let i = 0; i < failures.length; i++) {
    const result = await drawOccurrenceCard(doc, {
      failure: failures[i],
      index: i,
      x: margin,
      y,
      width: cardWidth,
      maxPageY: maxY,
    });

    if (result.pageBreak) {
      doc.addPage();
      y = onNewPage();
      i--; // Retry this card on the new page
      continue;
    }

    y = result.nextY;
  }

  return y;
}
