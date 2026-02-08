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
  PDF_BRAND, 
  addLeadershipHeader, 
  addSectionHeader, 
  addNoFailuresMessage,
  addSignatureSection,
  addPageFooter,
  addContinuationHeader
} from "@/lib/pdf/grupoCajuPdfTheme";
import { drawOccurrenceCards } from "@/lib/pdf/leadershipOccurrenceCard";

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

function formatPeriod(dateRange: DateRange | undefined): string {
  const from = dateRange?.from ? format(dateRange.from, "dd/MM/yyyy", { locale: ptBR }) : "—";
  const to = dateRange?.to ? format(dateRange.to, "dd/MM/yyyy", { locale: ptBR }) : "—";
  return `${from} a ${to}`;
}

export async function generateLeadershipPDF(params: LeadershipPDFParams): Promise<void> {
  const { leaderName, position, score, tier, failures, dateRange, unitName } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();

  // ===== HEADER (2-column table) =====
  let y = addLeadershipHeader(doc, {
    leaderName,
    position: POSITION_LABELS[position],
    score,
    tier,
    failureCount: failures.length,
    dateRange: formatPeriod(dateRange),
    unitName,
  });

  // ===== OCCURRENCES SECTION =====
  y = addSectionHeader(doc, "Não conformidades identificadas", y);
  y += 4;

  if (failures.length === 0) {
    y = addNoFailuresMessage(doc, y);
  } else {
    // Draw all occurrence cards with automatic pagination
    y = await drawOccurrenceCards(doc, failures, y, () => {
      return addContinuationHeader(doc, "FICHA DE OCORRÊNCIAS", `${leaderName} • Continuação`);
    });
  }

  // ===== SIGNATURE SECTION =====
  if (y > pageHeight - 60) {
    doc.addPage();
    y = addContinuationHeader(doc, "TERMO DE CIÊNCIA", "Responsabilidade sobre correções");
  }
  
  addSignatureSection(doc, y);

  // ===== FOOTER ON ALL PAGES =====
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, p, totalPages);
  }

  const fileName = `Ficha_${leaderName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}

export async function generateConsolidatedPDF(params: ConsolidatedPDFParams): Promise<void> {
  const { areaType, areaScore, leaders, failures, dateRange, unitName } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  const areaLabel = areaType === "front" ? "FRONT" : "BACK";

  // ===== CONSOLIDATED HEADER =====
  let y = addContinuationHeader(doc, `RELATÓRIO CONSOLIDADO • ${areaLabel}`, `${unitName} • ${formatPeriod(dateRange)}`);

  // Area score banner
  const scoreColor = areaScore >= 95 ? PDF_BRAND.success : areaScore >= 85 ? PDF_BRAND.warning : PDF_BRAND.danger;
  doc.setFillColor(...scoreColor);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`MÉDIA ${areaLabel}: ${Math.round(areaScore)}%`, margin + 6, y + 8);
  y += 18;

  // Leaders summary table
  const getTierLabel = (t: string) => {
    switch (t) {
      case "ouro": return "🥇 OURO";
      case "prata": return "🥈 PRATA";
      case "bronze": return "🥉 BRONZE";
      case "red_flag": return "🚨 CRÍTICO";
      default: return t;
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
    head: [["LÍDER", "CARGO", "NOTA", "SELO", "FALHAS"]],
    body: leaderTableData,
    theme: "striped",
    headStyles: {
      fillColor: PDF_BRAND.primary,
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45 },
      2: { cellWidth: 20 },
      3: { cellWidth: 30 },
      4: { cellWidth: 20 },
    },
  });

  y = (doc as any).lastAutoTable?.finalY || y + 40;
  y += 8;

  // Failures by sector summary
  y = addSectionHeader(doc, "Resumo por setor", y);
  y += 4;

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
      head: [["SETOR", "NÃO CONFORMIDADES"]],
      body: sectorTableData,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 50 },
      },
    });
    y = (doc as any).lastAutoTable?.finalY || y + 20;
  }

  // Detailed occurrence cards
  if (failures.length > 0) {
    doc.addPage();
    y = addContinuationHeader(doc, `DETALHAMENTO • ${areaLabel}`, "Fichas de ocorrência individuais");
    y = addSectionHeader(doc, "Não conformidades detalhadas", y);
    y += 4;

    y = await drawOccurrenceCards(doc, failures, y, () => {
      return addContinuationHeader(doc, `DETALHAMENTO • ${areaLabel}`, "Continuação");
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, p, totalPages);
  }

  const fileName = `Consolidado_${areaLabel}_${unitName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}
