import jsPDF from "jspdf";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { PDF_COLORS, PDF_LAYOUT } from "@/lib/pdf/grupoCajuPdfTheme";
import { addImageFromUrl } from "@/lib/pdf/pdfImageUtils";

/**
 * CAJUPAR - CORPORATE OCCURRENCE CARDS
 * 
 * Professional, minimalist cards for audit non-conformities.
 * - Clean bordered boxes
 * - No placeholders for empty fields
 * - Consistent spacing and typography
 */

// Layout Constants
const CARD_MARGIN = PDF_LAYOUT.margin;
const CARD_GAP = 8;
const CARD_PADDING = 10;
const ACTION_BOX_HEIGHT = 22;

/**
 * Parse item details from failure record
 */
function parseItemDetails(failure: SupervisionFailure): { item: string; details: string | null } {
  const rawItem = (failure.item_name || "Item não identificado").trim();
  
  // Extract parenthetical details from item name
  const parenMatch = rawItem.match(/^(.*?)(?:\s*\(([^)]+)\)\s*)$/);
  const item = (parenMatch?.[1] || rawItem).trim() || "Item não identificado";
  const detailsFromName = (parenMatch?.[2] || "").trim();
  
  // Priority: explicit details > parenthetical > null
  const details = failure.detalhes_falha?.trim() || detailsFromName || null;
  
  return { item, details };
}

/**
 * Calculate card height for page break decisions
 */
function calculateCardHeight(
  doc: jsPDF,
  failure: SupervisionFailure,
  contentWidth: number,
  hasImage: boolean
): number {
  const { details } = parseItemDetails(failure);
  
  const headerHeight = 16;
  let bodyHeight = 0;
  
  if (details || hasImage) {
    if (details) {
      doc.setFontSize(9);
      const textWidth = hasImage ? (contentWidth - CARD_PADDING * 3) * 0.58 : contentWidth - CARD_PADDING * 2;
      const lines = doc.splitTextToSize(details, textWidth);
      bodyHeight = Math.max(lines.length * 4.5 + 12, hasImage ? 45 : 20);
    } else if (hasImage) {
      bodyHeight = 45;
    }
  }
  
  const actionHeight = ACTION_BOX_HEIGHT + 8;
  
  return CARD_PADDING + headerHeight + bodyHeight + actionHeight + CARD_PADDING;
}

/**
 * Draw a single occurrence card
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
  const { item, details } = parseItemDetails(failure);
  
  const hasImage = !!(failure.url_foto_evidencia?.startsWith("http"));
  const cardHeight = calculateCardHeight(doc, failure, width, hasImage);
  
  // Check for page break
  if (y + cardHeight > maxPageY) {
    return { nextY: y, pageBreak: true };
  }

  // ===== CARD CONTAINER =====
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, cardHeight, 2, 2, "FD");

  let currentY = y + CARD_PADDING;

  // ===== HEADER: Number + Item Name + Status =====
  
  // Number badge (institutional red)
  const badgeSize = 7;
  doc.setFillColor(...PDF_COLORS.institutional);
  doc.circle(x + CARD_PADDING + badgeSize / 2, currentY + badgeSize / 2, badgeSize / 2, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(String(index + 1), x + CARD_PADDING + badgeSize / 2, currentY + badgeSize / 2 + 2, { align: "center" });
  
  // Item name (bold)
  const itemX = x + CARD_PADDING + badgeSize + 5;
  const maxItemWidth = width * 0.6;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.graphite);
  
  const itemLines = doc.splitTextToSize(item, maxItemWidth);
  doc.text(itemLines[0], itemX, currentY + 5);
  
  // Tags (right side)
  const tagY = currentY;
  let tagX = x + width - CARD_PADDING;
  
  // Recurring badge
  if (failure.is_recurring) {
    const recurText = "REINCIDENTE";
    doc.setFontSize(6);
    const recurWidth = doc.getTextWidth(recurText) + 8;
    
    doc.setFillColor(...PDF_COLORS.dangerLight);
    doc.roundedRect(tagX - recurWidth, tagY, recurWidth, 6, 1, 1, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.danger);
    doc.text(recurText, tagX - recurWidth / 2, tagY + 4.5, { align: "center" });
    
    tagX -= recurWidth + 4;
  }
  
  // Category badge
  if (failure.category) {
    const catText = failure.category.toUpperCase();
    doc.setFontSize(6);
    const catWidth = Math.max(doc.getTextWidth(catText) + 8, 25);
    
    doc.setFillColor(...PDF_COLORS.gray100);
    doc.roundedRect(tagX - catWidth, tagY, catWidth, 6, 1, 1, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_COLORS.gray600);
    doc.text(catText, tagX - catWidth / 2, tagY + 4.5, { align: "center" });
  }
  
  currentY += 12;
  
  // Thin separator
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.2);
  doc.line(x + CARD_PADDING, currentY, x + width - CARD_PADDING, currentY);
  currentY += 6;

  // ===== BODY: Observation + Image =====
  const bodyStartY = currentY;
  
  if (details || hasImage) {
    if (hasImage) {
      // Two columns: 58% text, 42% image
      const leftWidth = (width - CARD_PADDING * 3) * 0.58;
      const rightWidth = (width - CARD_PADDING * 3) * 0.42;
      const imageX = x + CARD_PADDING + leftWidth + CARD_PADDING;
      const imageSize = Math.min(rightWidth, 38);
      
      // Left column: Observation
      if (details) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...PDF_COLORS.gray500);
        doc.text("Observação", x + CARD_PADDING, currentY + 3);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...PDF_COLORS.graphite);
        const obsLines = doc.splitTextToSize(details, leftWidth - 4);
        doc.text(obsLines, x + CARD_PADDING, currentY + 10);
        
        currentY += 10 + obsLines.length * 4.5;
      }
      
      // Right column: Image
      const imageY = bodyStartY;
      let imageAdded = false;
      
      try {
        imageAdded = await addImageFromUrl(
          doc,
          failure.url_foto_evidencia!,
          imageX,
          imageY,
          imageSize,
          imageSize
        );
      } catch {
        imageAdded = false;
      }
      
      if (imageAdded) {
        // Subtle border around image
        doc.setDrawColor(...PDF_COLORS.gray300);
        doc.setLineWidth(0.3);
        doc.rect(imageX, imageY, imageSize, imageSize);
      }
      
      currentY = Math.max(currentY, imageY + imageSize + 4);
      
    } else if (details) {
      // Full width observation
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.gray500);
      doc.text("Observação", x + CARD_PADDING, currentY + 3);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLORS.graphite);
      const obsLines = doc.splitTextToSize(details, width - CARD_PADDING * 2 - 4);
      doc.text(obsLines, x + CARD_PADDING, currentY + 10);
      
      currentY += 10 + obsLines.length * 4.5 + 4;
    }
  }

  // ===== FOOTER: Action Box =====
  currentY += 4;
  
  const actionBoxX = x + CARD_PADDING;
  const actionBoxWidth = width - CARD_PADDING * 2;
  
  // Light dashed border
  doc.setFillColor(...PDF_COLORS.gray50);
  doc.setDrawColor(...PDF_COLORS.gray300);
  doc.setLineWidth(0.3);
  
  // Use dashed pattern if available
  try {
    (doc as any).setLineDashPattern([2, 2], 0);
  } catch {
    // Solid fallback
  }
  
  doc.roundedRect(actionBoxX, currentY, actionBoxWidth, ACTION_BOX_HEIGHT, 1.5, 1.5, "FD");
  
  // Reset dash
  try {
    (doc as any).setLineDashPattern([], 0);
  } catch {
    // Ignore
  }
  
  // Label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("AÇÃO CORRETIVA / PRAZO", actionBoxX + 4, currentY + 5);
  
  // Writing guide lines
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.1);
  
  for (let lineY = currentY + 10; lineY < currentY + ACTION_BOX_HEIGHT - 3; lineY += 5) {
    doc.line(actionBoxX + 4, lineY, actionBoxX + actionBoxWidth - 4, lineY);
  }

  return { nextY: y + cardHeight + CARD_GAP, pageBreak: false };
}

/**
 * Draw multiple occurrence cards with automatic pagination
 */
export async function drawOccurrenceCards(
  doc: jsPDF,
  failures: SupervisionFailure[],
  startY: number,
  onNewPage: () => number
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cardWidth = pageWidth - CARD_MARGIN * 2;
  const maxY = pageHeight - 20; // Footer space

  let y = startY;

  for (let i = 0; i < failures.length; i++) {
    const result = await drawOccurrenceCard(doc, {
      failure: failures[i],
      index: i,
      x: CARD_MARGIN,
      y,
      width: cardWidth,
      maxPageY: maxY,
    });

    if (result.pageBreak) {
      doc.addPage();
      y = onNewPage();
      i--; // Retry this card
      continue;
    }

    y = result.nextY;
  }

  return y;
}

/**
 * Get critical points from failures for executive summary
 */
export function extractCriticalPoints(failures: SupervisionFailure[]): string[] {
  // Get recurring items first, then by category count
  const recurring = failures.filter(f => f.is_recurring).map(f => parseItemDetails(f).item);
  const categories = failures.reduce((acc, f) => {
    const cat = f.category || "Geral";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat, count]) => `${cat}: ${count} ocorrência(s)`);
  
  const points: string[] = [];
  
  if (recurring.length > 0) {
    points.push(`Reincidências: ${recurring.slice(0, 3).join(", ")}`);
  }
  
  points.push(...topCategories);
  
  return points;
}
