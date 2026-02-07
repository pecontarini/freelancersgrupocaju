import jsPDF from "jspdf";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { PDF_BRAND } from "@/lib/pdf/grupoCajuPdfTheme";
import { addImageFromUrl, drawNoEvidencePlaceholder } from "@/lib/pdf/pdfImageUtils";

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

  const padding = 5;
  const gap = 5;
  const photoSize = 45; // mm (visual guide-like thumbnail)

  const leftWidth = width - photoSize - gap;

  const rawItem = (failure.item_name || "Item não identificado").trim();
  const parenMatch = rawItem.match(/^(.*?)(?:\s*\(([^)]+)\)\s*)$/);
  const item = (parenMatch?.[1] || rawItem).trim() || "Item não identificado";
  const detailsFromName = (parenMatch?.[2] || "").trim() || null;
  const details = (
    failure.detalhes_falha ||
    detailsFromName ||
    "Sem comentário do auditor"
  ).trim();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const detailsLines = doc.splitTextToSize(details, leftWidth - padding * 2);

  const baseHeight = 16; // header + spacing
  const detailsHeight = Math.max(12, detailsLines.length * 4.2);
  const actionBoxHeight = 16;
  const cardHeight = padding + baseHeight + detailsHeight + actionBoxHeight + padding;

  // Page break
  if (y + cardHeight > maxPageY) {
    return { nextY: y, pageBreak: true };
  }

  // Card background
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, width, cardHeight, 3, 3, "FD");

  // Number badge
  doc.setFillColor(...PDF_BRAND.primary);
  doc.circle(x + 7, y + 7, 4.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(String(index + 1), x + 7, y + 8.8, { align: "center" });

  // Item title
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const titleX = x + 14;
  const titleY = y + 9;
  const truncated = item.length > 78 ? item.slice(0, 75) + "..." : item;
  doc.text(truncated, titleX, titleY);

  // Recurrence badge
  if (failure.is_recurring) {
    const badgeW = 32;
    const badgeH = 7;
    const badgeX = x + leftWidth - badgeW;
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(badgeX, y + 4.5, badgeW, badgeH, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28);
    doc.text("⚠ REINCIDENTE", badgeX + badgeW / 2, y + 9.5, { align: "center" });
  }

  // Details label
  const detailsStartY = y + 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("O que aconteceu:", x + padding, detailsStartY);

  // Details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(detailsLines, x + padding, detailsStartY + 5);

  // Photo
  const photoX = x + leftWidth + gap;
  const photoY = y + 12;

  const evidenceUrl = failure.url_foto_evidencia || "";
  let added = false;
  if (evidenceUrl.startsWith("http")) {
    try {
      added = await addImageFromUrl(doc, evidenceUrl, photoX, photoY, photoSize, photoSize);
    } catch {
      added = false;
    }
  }

  if (!added) {
    drawNoEvidencePlaceholder(doc, photoX, photoY, photoSize, photoSize);
  } else {
    doc.setDrawColor(203, 213, 225);
    doc.rect(photoX, photoY, photoSize, photoSize);
  }

  // Evidence link (small)
  if (evidenceUrl.startsWith("http")) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.textWithLink("Abrir evidência", photoX, photoY + photoSize + 5, { url: evidenceUrl });
  }

  // Action box
  const actionY = y + cardHeight - actionBoxHeight - padding;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + padding, actionY, width - padding * 2, actionBoxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("✍ Ação Corretiva Realizada:", x + padding + 2, actionY + 5);

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.2);
  doc.line(x + padding + 2, actionY + 10, x + width - padding - 2, actionY + 10);

  return { nextY: y + cardHeight + 6, pageBreak: false };
}
