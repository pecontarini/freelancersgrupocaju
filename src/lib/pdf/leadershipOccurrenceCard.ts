import jsPDF from "jspdf";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { PDF_BRAND } from "@/lib/pdf/grupoCajuPdfTheme";
import { addImageFromUrl, drawNoEvidencePlaceholder } from "@/lib/pdf/pdfImageUtils";

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

  const padding = 6;
  const photoSize = 42;
  const photoMargin = 4;
  const contentWidth = width - photoSize - photoMargin * 3 - padding;

  const { item, details } = parseItemDetails(failure);

  // Calculate text heights
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const itemLines = doc.splitTextToSize(item, contentWidth);
  const itemHeight = itemLines.length * 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const detailsLines = doc.splitTextToSize(details, contentWidth);
  const detailsHeight = Math.max(10, detailsLines.length * 4);

  // Card height calculation
  const headerHeight = 8;
  const itemSectionHeight = itemHeight + 6;
  const detailsSectionHeight = detailsHeight + 8;
  const actionBoxHeight = 18;
  const cardHeight = padding + headerHeight + itemSectionHeight + detailsSectionHeight + actionBoxHeight + padding + 2;

  // Page break check
  if (y + cardHeight > maxPageY) {
    return { nextY: y, pageBreak: true };
  }

  // ===== CARD BACKGROUND =====
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, cardHeight, 2.5, 2.5, "FD");

  // ===== HEADER ROW =====
  const headerY = y + padding;
  
  // Number badge (circular)
  const badgeRadius = 5;
  doc.setFillColor(...PDF_BRAND.primary);
  doc.circle(x + padding + badgeRadius, headerY + badgeRadius - 1, badgeRadius, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(String(index + 1), x + padding + badgeRadius, headerY + badgeRadius + 1.5, { align: "center" });

  // Category label
  const categoryX = x + padding + badgeRadius * 2 + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.primary);
  const category = (failure.category || "GERAL").toUpperCase();
  doc.text(category, categoryX, headerY + 5);

  // Recurrence badge (if applicable)
  if (failure.is_recurring) {
    const badgeW = 28;
    const badgeH = 6;
    const badgeX = x + width - padding - badgeW - photoSize - photoMargin;
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(badgeX, headerY, badgeW, badgeH, 1.5, 1.5, "F");
    doc.setFontSize(6);
    doc.setTextColor(185, 28, 28);
    doc.setFont("helvetica", "bold");
    doc.text("⚠ REINCIDENTE", badgeX + badgeW / 2, headerY + 4.2, { align: "center" });
  }

  // ===== ITEM NAME =====
  const itemY = headerY + headerHeight + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(itemLines, x + padding, itemY);

  // ===== DETAILS SECTION =====
  const detailsY = itemY + itemHeight + 4;
  
  // Details label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("OBSERVAÇÃO:", x + padding, detailsY);

  // Details content
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(detailsLines, x + padding, detailsY + 5);

  // ===== PHOTO SECTION (Right side) =====
  const photoX = x + width - padding - photoSize;
  const photoY = headerY + 2;

  const evidenceUrl = failure.url_foto_evidencia || "";
  let imageAdded = false;

  if (evidenceUrl.startsWith("http")) {
    try {
      imageAdded = await addImageFromUrl(doc, evidenceUrl, photoX, photoY, photoSize, photoSize);
    } catch {
      imageAdded = false;
    }
  }

  if (!imageAdded) {
    drawNoEvidencePlaceholder(doc, photoX, photoY, photoSize, photoSize);
  } else {
    // Add border around image
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(photoX, photoY, photoSize, photoSize);
  }

  // Photo link (if available)
  if (evidenceUrl.startsWith("http")) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.textWithLink("Ver foto →", photoX + photoSize / 2, photoY + photoSize + 4, { 
      url: evidenceUrl 
    });
  }

  // ===== ACTION BOX =====
  const actionY = y + cardHeight - actionBoxHeight - padding;
  const actionWidth = width - padding * 2;

  // Box background
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.roundedRect(x + padding, actionY, actionWidth, actionBoxHeight, 2, 2, "FD");

  // Action label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(75, 85, 99);
  doc.text("✍ AÇÃO CORRETIVA REALIZADA:", x + padding + 3, actionY + 5);

  // Writing lines
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.15);
  const lineY1 = actionY + 10;
  const lineY2 = actionY + 15;
  doc.line(x + padding + 3, lineY1, x + padding + actionWidth - 3, lineY1);
  doc.line(x + padding + 3, lineY2, x + padding + actionWidth - 3, lineY2);

  return { nextY: y + cardHeight + 5, pageBreak: false };
}
