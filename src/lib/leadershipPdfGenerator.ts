import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import { LOGO_BASE64 } from "./logoBase64";
import { 
  POSITION_LABELS, 
  SECTOR_POSITION_MAP,
  categorizeItemToSector,
  type LeadershipPosition, 
  type AreaType,
  type AuditSector,
} from "./sectorPositionMapping";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";

interface LeadershipPDFParams {
  leaderName: string;
  position: LeadershipPosition;
  score: number;
  tier: "ouro" | "prata" | "bronze" | "red_flag";
  failures: SupervisionFailure[];
  dateRange: DateRange | undefined;
  unitName: string;
}

interface ConsolidatedPDFParams {
  areaType: AreaType;
  areaScore: number;
  leaders: Array<{
    position: LeadershipPosition;
    name: string;
    score: number;
    failureCount: number;
    tier: "ouro" | "prata" | "bronze" | "red_flag";
    sectors: AuditSector[];
  }>;
  failures: SupervisionFailure[];
  dateRange: DateRange | undefined;
  unitName: string;
}

function getTierLabel(tier: "ouro" | "prata" | "bronze" | "red_flag"): string {
  switch (tier) {
    case "ouro": return "OURO";
    case "prata": return "PRATA";
    case "bronze": return "BRONZE";
    case "red_flag": return "CRÍTICO";
  }
}

function getTierEmoji(tier: "ouro" | "prata" | "bronze" | "red_flag"): string {
  switch (tier) {
    case "ouro": return "🥇";
    case "prata": return "🥈";
    case "bronze": return "🥉";
    case "red_flag": return "🚨";
  }
}

function getScoreColor(score: number): [number, number, number] {
  if (score >= 95) return [16, 185, 129]; // Emerald
  if (score >= 85) return [245, 158, 11]; // Amber
  return [239, 68, 68]; // Red
}

// Load image from URL and convert to base64
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Draw a placeholder for missing image
function drawNoImagePlaceholder(doc: jsPDF, x: number, y: number, size: number) {
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(x, y, size, size, 2, 2, "FD");
  
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("Sem", x + size / 2, y + size / 2 - 3, { align: "center" });
  doc.text("Evidência", x + size / 2, y + size / 2 + 3, { align: "center" });
}

// Draw occurrence card for a failure
async function drawOccurrenceCard(
  doc: jsPDF,
  failure: SupervisionFailure & { detalhes_falha?: string | null; url_foto_evidencia?: string | null },
  index: number,
  startY: number,
  pageWidth: number
): Promise<number> {
  const cardMargin = 15;
  const cardWidth = pageWidth - cardMargin * 2;
  const imageSize = 35;
  const textAreaWidth = cardWidth - imageSize - 15;
  
  // Card background
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(229, 231, 235);
  
  // Calculate card height based on content
  const itemName = failure.item_name || "Item não identificado";
  const details = (failure as any).detalhes_falha || "Sem detalhes registrados";
  
  doc.setFontSize(9);
  const detailsLines = doc.splitTextToSize(details, textAreaWidth - 10);
  const cardHeight = Math.max(60, 25 + detailsLines.length * 4 + 25);
  
  // Check if we need a new page
  if (startY + cardHeight > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    startY = 20;
  }
  
  // Draw card border
  doc.roundedRect(cardMargin, startY, cardWidth, cardHeight, 3, 3, "FD");
  
  // Card number badge
  doc.setFillColor(59, 130, 246);
  doc.circle(cardMargin + 8, startY + 8, 5, "F");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(String(index + 1), cardMargin + 8, startY + 10, { align: "center" });
  
  // Item name (bold)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  const truncatedName = itemName.length > 60 ? itemName.substring(0, 57) + "..." : itemName;
  doc.text(truncatedName, cardMargin + 18, startY + 10);
  
  // Recurrence badge
  if (failure.is_recurring) {
    const badgeX = cardMargin + cardWidth - imageSize - 50;
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(badgeX, startY + 4, 40, 10, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(185, 28, 28);
    doc.setFont("helvetica", "bold");
    doc.text("⚠️ REINCIDENTE", badgeX + 20, startY + 10.5, { align: "center" });
  }
  
  // "O que aconteceu" section
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("O que aconteceu:", cardMargin + 8, startY + 20);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(detailsLines, cardMargin + 8, startY + 26);
  
  // Image area (right side)
  const imageX = cardMargin + cardWidth - imageSize - 5;
  const imageY = startY + 15;
  
  const imageUrl = (failure as any).url_foto_evidencia;
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      const imageData = await loadImageAsBase64(imageUrl);
      if (imageData) {
        doc.addImage(imageData, "JPEG", imageX, imageY, imageSize, imageSize);
        doc.setDrawColor(203, 213, 225);
        doc.rect(imageX, imageY, imageSize, imageSize);
      } else {
        drawNoImagePlaceholder(doc, imageX, imageY, imageSize);
      }
    } catch {
      drawNoImagePlaceholder(doc, imageX, imageY, imageSize);
    }
  } else {
    drawNoImagePlaceholder(doc, imageX, imageY, imageSize);
  }
  
  // Corrective action box
  const actionBoxY = startY + cardHeight - 18;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardMargin + 5, actionBoxY, cardWidth - 10, 14, 2, 2, "FD");
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("✍️ Ação Corretiva Realizada:", cardMargin + 10, actionBoxY + 5);
  
  doc.setDrawColor(229, 231, 235);
  doc.line(cardMargin + 10, actionBoxY + 10, cardMargin + cardWidth - 15, actionBoxY + 10);
  
  return startY + cardHeight + 5;
}

export async function generateLeadershipPDF(params: LeadershipPDFParams): Promise<void> {
  const { leaderName, position, score, tier, failures, dateRange, unitName } = params;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // === COVER PAGE ===
  
  // Header with logo
  try {
    doc.addImage(LOGO_BASE64, "JPEG", 15, 10, 40, 20);
  } catch (e) {
    console.warn("Could not add logo to PDF");
  }
  
  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("FICHA DE OCORRÊNCIAS", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(unitName.toUpperCase(), pageWidth / 2, 28, { align: "center" });
  
  // Leader Info Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, 40, pageWidth - 30, 45, 4, 4, "FD");
  
  // Leader name
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(leaderName, 25, 55);
  
  // Position
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Cargo: ${POSITION_LABELS[position]}`, 25, 63);
  
  // Period
  const periodText = `Período: ${dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : "—"} a ${dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : "—"}`;
  doc.text(periodText, 25, 71);
  
  // Total failures
  doc.text(`Total de Não Conformidades: ${failures.length}`, 25, 79);
  
  // Score Badge (large, right side)
  const scoreColor = getScoreColor(score);
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(pageWidth - 75, 45, 55, 35, 4, 4, "F");
  
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`${Math.round(score)}%`, pageWidth - 47.5, 62, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`${getTierEmoji(tier)} ${getTierLabel(tier)}`, pageWidth - 47.5, 73, { align: "center" });
  
  // === OCCURRENCE CARDS ===
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("NÃO CONFORMIDADES DO SETOR", 15, 100);
  
  let currentY = 108;
  
  if (failures.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("✅ Nenhuma não conformidade registrada no período. Parabéns!", 15, currentY);
    currentY += 20;
  } else {
    for (let i = 0; i < failures.length; i++) {
      currentY = await drawOccurrenceCard(doc, failures[i], i, currentY, pageWidth);
    }
  }
  
  // === SIGNATURE SECTION ===
  
  // Check if we need a new page for signature
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 30;
  }
  
  currentY = Math.max(currentY + 15, pageHeight - 55);
  
  // Signature boxes
  doc.setDrawColor(203, 213, 225);
  doc.line(20, currentY, 90, currentY);
  doc.line(pageWidth - 90, currentY, pageWidth - 20, currentY);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Assinatura do Responsável", 55, currentY + 6, { align: "center" });
  doc.text("Assinatura do Gestor", pageWidth - 55, currentY + 6, { align: "center" });
  
  doc.setFontSize(7);
  doc.text(`Data: ____/____/________`, 55, currentY + 14, { align: "center" });
  doc.text(`Data: ____/____/________`, pageWidth - 55, currentY + 14, { align: "center" });
  
  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const footerText = `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Portal da Liderança - Grupo Caju`;
  doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: "center" });
  
  // Save
  const fileName = `Ficha_${leaderName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}

export async function generateConsolidatedPDF(params: ConsolidatedPDFParams): Promise<void> {
  const { areaType, areaScore, leaders, failures, dateRange, unitName } = params;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const areaLabel = areaType === "front" ? "FRONT" : "BACK";
  
  // Header with logo
  try {
    doc.addImage(LOGO_BASE64, "JPEG", 15, 10, 40, 20);
  } catch (e) {
    console.warn("Could not add logo to PDF");
  }
  
  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`RELATÓRIO CONSOLIDADO - ${areaLabel}`, pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(unitName.toUpperCase(), pageWidth / 2, 28, { align: "center" });
  
  // Period
  const periodText = `Período: ${dateRange?.from ? format(dateRange.from, "dd/MM/yyyy") : "—"} a ${dateRange?.to ? format(dateRange.to, "dd/MM/yyyy") : "—"}`;
  doc.text(periodText, pageWidth / 2, 36, { align: "center" });
  
  // Area Score Box
  const scoreColor = getScoreColor(areaScore);
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(pageWidth / 2 - 35, 42, 70, 30, 4, 4, "F");
  
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`${Math.round(areaScore)}%`, pageWidth / 2, 58, { align: "center" });
  
  doc.setFontSize(9);
  doc.text(`MÉDIA ${areaLabel}`, pageWidth / 2, 67, { align: "center" });
  
  // Leadership Summary
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO POR LIDERANÇA", 15, 85);
  
  const leaderTableData = leaders.map((l) => [
    l.name,
    POSITION_LABELS[l.position] || l.position,
    `${Math.round(l.score)}%`,
    `${getTierEmoji(l.tier)} ${getTierLabel(l.tier)}`,
    l.failureCount.toString(),
  ]);

  autoTable(doc, {
    startY: 90,
    head: [["Líder", "Cargo", "Nota", "Selo", "Falhas"]],
    body: leaderTableData,
    theme: "striped",
    headStyles: {
      fillColor: areaType === "front" ? [59, 130, 246] : [249, 115, 22],
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45 },
      2: { cellWidth: 20 },
      3: { cellWidth: 35 },
      4: { cellWidth: 20 },
    },
    margin: { left: 15, right: 15 },
  });
  
  // Get the final Y position after the table
  const finalY = (doc as any).lastAutoTable?.finalY || 130;
  
  // Sector Breakdown
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("FALHAS POR SETOR", 15, finalY + 15);
  
  const sectorCounts: Record<string, number> = {};
  failures.forEach((f) => {
    const sector = categorizeItemToSector(f.item_name, f.category);
    const sectorName = SECTOR_POSITION_MAP[sector]?.displayName || sector;
    sectorCounts[sectorName] = (sectorCounts[sectorName] || 0) + 1;
  });
  
  const sectorTableData = Object.entries(sectorCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([sector, count]) => [sector, count.toString()]);

  if (sectorTableData.length > 0) {
    autoTable(doc, {
      startY: finalY + 20,
      head: [["Setor", "Não Conformidades"]],
      body: sectorTableData,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
      },
      margin: { left: 15, right: 15 },
    });
  }

  // Add occurrence cards on new pages
  if (failures.length > 0) {
    doc.addPage();
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("DETALHAMENTO DAS NÃO CONFORMIDADES", 15, 20);
    
    let currentY = 28;
    
    for (let i = 0; i < failures.length; i++) {
      currentY = await drawOccurrenceCard(doc, failures[i], i, currentY, pageWidth);
    }
  }
  
  // Footer on last page
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  const footerText = `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Portal da Liderança - Grupo Caju`;
  doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: "center" });
  
  // Save
  const fileName = `Consolidado_${areaLabel}_${unitName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}
