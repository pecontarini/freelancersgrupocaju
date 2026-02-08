import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import {
  POSITION_LABELS,
  categorizeItemToSector,
  SECTOR_POSITION_MAP,
  type LeadershipPosition,
  type AreaType,
  type AuditSector,
} from "./sectorPositionMapping";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";

import { 
  PDF_COLORS,
  PDF_LAYOUT,
  addExecutiveCover,
  addExecutiveSummary,
  addSectionHeader,
  addContinuationHeader,
  addNoFailuresMessage,
  addSignaturePage,
  addPageFooter,
  getTierInfo,
  getScoreColor,
  type TierType,
} from "@/lib/pdf/grupoCajuPdfTheme";

import { drawOccurrenceCards, extractCriticalPoints } from "@/lib/pdf/leadershipOccurrenceCard";

interface LeadershipPDFParams {
  leaderName: string;
  position: LeadershipPosition;
  score: number;
  tier: TierType;
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
    tier: TierType;
    sectors: AuditSector[];
  }>;
  failures: SupervisionFailure[];
  dateRange: DateRange | undefined;
  unitName: string;
}

function formatPeriod(dateRange: DateRange | undefined): string {
  const from = dateRange?.from ? format(dateRange.from, "dd/MM/yyyy", { locale: ptBR }) : "—";
  const to = dateRange?.to ? format(dateRange.to, "dd/MM/yyyy", { locale: ptBR }) : "—";
  return `${from} a ${to}`;
}

/**
 * Generate Individual Leadership PDF Report
 * 
 * Structure:
 * 1. Executive Cover Page
 * 2. Executive Summary
 * 3. Non-Conformities (Occurrence Cards)
 * 4. Signature Page (Termo de Ciência)
 */
export async function generateLeadershipPDF(params: LeadershipPDFParams): Promise<void> {
  const { leaderName, position, score, tier, failures, dateRange, unitName } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ===== PAGE 1: EXECUTIVE COVER =====
  addExecutiveCover(doc, {
    leaderName,
    position: POSITION_LABELS[position],
    unitName,
    dateRange: formatPeriod(dateRange),
    score,
    tier,
    failureCount: failures.length,
  });

  // ===== PAGE 2: EXECUTIVE SUMMARY + NON-CONFORMITIES =====
  doc.addPage();
  
  const recurringCount = failures.filter(f => f.is_recurring).length;
  const criticalPoints = extractCriticalPoints(failures);
  
  let y = addExecutiveSummary(doc, {
    failureCount: failures.length,
    recurringCount,
    criticalPoints,
    score,
  });

  // Non-conformities section
  y = addSectionHeader(doc, "Não Conformidades Identificadas", y + 4);
  y += 4;

  if (failures.length === 0) {
    y = addNoFailuresMessage(doc, y);
  } else {
    // Draw occurrence cards with pagination
    y = await drawOccurrenceCards(doc, failures, y, () => {
      return addContinuationHeader(doc, "Não Conformidades");
    });
  }

  // ===== FINAL PAGE: SIGNATURE (TERMO DE CIÊNCIA) =====
  doc.addPage();
  addSignaturePage(doc);

  // ===== ADD FOOTERS TO ALL PAGES =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, p, totalPages);
  }

  // Save
  const fileName = `Auditoria_${leaderName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}

/**
 * Generate Consolidated Area PDF Report (Front or Back)
 * 
 * Structure:
 * 1. Executive Cover Page (Area)
 * 2. Leaders Summary Table
 * 3. Sector Summary
 * 4. Detailed Non-Conformities
 * 5. Signature Page
 */
export async function generateConsolidatedPDF(params: ConsolidatedPDFParams): Promise<void> {
  const { areaType, areaScore, leaders, failures, dateRange, unitName } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = PDF_LAYOUT.margin;
  
  const areaLabel = areaType === "front" ? "FRONT" : "BACK";
  const areaPosition = areaType === "front" ? "Gerente de Salão" : "Gerente de Cozinha";
  const totalFailures = failures.length;
  const tier: TierType = areaScore >= 95 ? "ouro" : areaScore >= 85 ? "prata" : areaScore >= 70 ? "bronze" : "red_flag";

  // ===== PAGE 1: EXECUTIVE COVER =====
  addExecutiveCover(doc, {
    leaderName: `Área ${areaLabel}`,
    position: areaPosition,
    unitName,
    dateRange: formatPeriod(dateRange),
    score: areaScore,
    tier,
    failureCount: totalFailures,
  });

  // ===== PAGE 2: LEADERS SUMMARY =====
  doc.addPage();
  let y = addContinuationHeader(doc, "Resumo da Área");
  
  // Area score banner
  const scoreColor = getScoreColor(areaScore);
  doc.setFillColor(...scoreColor);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 2, 2, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(`MÉDIA ${areaLabel}: ${Math.round(areaScore)}%`, margin + 8, y + 9);
  y += 22;

  // Leaders summary table
  y = addSectionHeader(doc, "Desempenho por Líder", y);
  y += 2;

  const getTierLabel = (t: TierType) => {
    switch (t) {
      case "ouro": return "OURO";
      case "prata": return "PRATA";
      case "bronze": return "BRONZE";
      case "red_flag": return "CRÍTICO";
    }
  };

  const leaderTableData = leaders.map((l) => [
    l.name,
    POSITION_LABELS[l.position] || l.position,
    `${Math.round(l.score)}%`,
    getTierLabel(l.tier),
    l.failureCount.toString(),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Líder", "Cargo", "Nota", "Selo", "NCs"]],
    body: leaderTableData,
    theme: "plain",
    headStyles: {
      fillColor: PDF_COLORS.gray100,
      textColor: PDF_COLORS.graphite,
      fontSize: 8,
      fontStyle: "bold",
      cellPadding: 4,
    },
    bodyStyles: { 
      fontSize: 9,
      cellPadding: 4,
      textColor: PDF_COLORS.graphite,
    },
    alternateRowStyles: { fillColor: PDF_COLORS.gray50 },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 50 },
      2: { cellWidth: 25, halign: "center" },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 20, halign: "center" },
    },
  });

  y = (doc as any).lastAutoTable?.finalY || y + 50;
  y += 10;

  // Sector summary
  y = addSectionHeader(doc, "Distribuição por Setor", y);
  y += 2;

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
      startY: y,
      head: [["Setor", "Não Conformidades"]],
      body: sectorTableData,
      theme: "plain",
      headStyles: {
        fillColor: PDF_COLORS.gray100,
        textColor: PDF_COLORS.graphite,
        fontSize: 8,
        fontStyle: "bold",
        cellPadding: 4,
      },
      bodyStyles: { 
        fontSize: 9, 
        cellPadding: 4,
        textColor: PDF_COLORS.graphite,
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 50, halign: "center" },
      },
    });
    y = (doc as any).lastAutoTable?.finalY || y + 30;
  }

  // ===== DETAILED NON-CONFORMITIES =====
  if (failures.length > 0) {
    doc.addPage();
    y = addContinuationHeader(doc, "Detalhamento");
    y = addSectionHeader(doc, "Não Conformidades Detalhadas", y + 4);
    y += 4;

    y = await drawOccurrenceCards(doc, failures, y, () => {
      return addContinuationHeader(doc, "Não Conformidades");
    });
  }

  // ===== FINAL PAGE: SIGNATURE =====
  doc.addPage();
  addSignaturePage(doc);

  // ===== ADD FOOTERS =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, p, totalPages);
  }

  // Save
  const fileName = `Consolidado_${areaLabel}_${unitName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}
