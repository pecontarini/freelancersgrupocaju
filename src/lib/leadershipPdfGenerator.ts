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

import { addGrupoCajuFooter, addGrupoCajuHeader, addSectionHeader, PDF_BRAND } from "@/lib/pdf/grupoCajuPdfTheme";
import { drawOccurrenceCard } from "@/lib/pdf/leadershipOccurrenceCard";

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
    case "ouro":
      return "OURO";
    case "prata":
      return "PRATA";
    case "bronze":
      return "BRONZE";
    case "red_flag":
      return "CRÍTICO";
  }
}

function getTierEmoji(tier: "ouro" | "prata" | "bronze" | "red_flag"): string {
  switch (tier) {
    case "ouro":
      return "🥇";
    case "prata":
      return "🥈";
    case "bronze":
      return "🥉";
    case "red_flag":
      return "🚨";
  }
}

function getScoreColor(score: number): [number, number, number] {
  if (score >= 95) return [16, 185, 129];
  if (score >= 85) return [245, 158, 11];
  return [239, 68, 68];
}

function formatPeriod(dateRange: DateRange | undefined): string {
  const from = dateRange?.from ? format(dateRange.from, "dd/MM/yyyy", { locale: ptBR }) : "—";
  const to = dateRange?.to ? format(dateRange.to, "dd/MM/yyyy", { locale: ptBR }) : "—";
  return `${from} a ${to}`;
}

export async function generateLeadershipPDF(params: LeadershipPDFParams): Promise<void> {
  const { leaderName, position, score, tier, failures, dateRange, unitName } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ===== COVER =====
  addGrupoCajuHeader(doc, {
    title: "FICHA DE OCORRÊNCIAS",
    subtitle: "Checklist de Supervisão • Guia Visual de Correção",
    unitName,
    rightTag: `${Math.round(score)}% • ${getTierEmoji(tier)} ${getTierLabel(tier)}`,
  });

  const scoreColor = getScoreColor(score);

  // Leader info box
  const boxY = 44;
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, boxY, pageWidth - margin * 2, 34, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(leaderName, margin + 4, boxY + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.text(`Cargo: ${POSITION_LABELS[position]}`, margin + 4, boxY + 17);
  doc.text(`Período: ${formatPeriod(dateRange)}`, margin + 4, boxY + 23);
  doc.text(`Não conformidades: ${failures.length}`, margin + 4, boxY + 29);

  // Score badge (right)
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(pageWidth - margin - 50, boxY + 6, 46, 22, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${Math.round(score)}%`, pageWidth - margin - 27, boxY + 15, { align: "center" });
  doc.setFontSize(8);
  doc.text(`${getTierEmoji(tier)} ${getTierLabel(tier)}`, pageWidth - margin - 27, boxY + 21, { align: "center" });

  // ===== OCCURRENCES =====
  addSectionHeader(doc, "Não conformidades do setor", 84);

  let y = 95;
  const cardX = margin;
  const cardW = pageWidth - margin * 2;
  const maxY = pageHeight - 24;

  if (failures.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_BRAND.secondaryText);
    doc.text("✅ Nenhuma não conformidade registrada no período.", margin, y);
    y += 10;
  } else {
    for (let i = 0; i < failures.length; i++) {
      const res = await drawOccurrenceCard(doc, {
        failure: failures[i],
        index: i,
        x: cardX,
        y,
        width: cardW,
        maxPageY: maxY,
      });

      if (res.pageBreak) {
        doc.addPage();
        addGrupoCajuHeader(doc, {
          title: "FICHA DE OCORRÊNCIAS",
          subtitle: "Checklist de Supervisão • Continuação",
          unitName,
        });
        addSectionHeader(doc, "Não conformidades do setor", 44);
        y = 55;
        i--; // retry same card on new page
        continue;
      }

      y = res.nextY;
    }
  }

  // ===== SIGNATURES =====
  if (y > pageHeight - 65) {
    doc.addPage();
    addGrupoCajuHeader(doc, {
      title: "ASSINATURAS",
      subtitle: "Responsabilidade e ciência",
      unitName,
    });
    y = 55;
  } else {
    y += 8;
  }

  addSectionHeader(doc, "Assinaturas", y);
  y += 16;

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.2);
  doc.line(margin + 5, y + 20, margin + 75, y + 20);
  doc.line(pageWidth - margin - 75, y + 20, pageWidth - margin - 5, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.text("Assinatura do Responsável", margin + 40, y + 25, { align: "center" });
  doc.text("Assinatura do Gestor", pageWidth - margin - 40, y + 25, { align: "center" });

  doc.setFontSize(7);
  doc.text("Data: ____/____/________", margin + 40, y + 32, { align: "center" });
  doc.text("Data: ____/____/________", pageWidth - margin - 40, y + 32, { align: "center" });

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addGrupoCajuFooter(doc, p, totalPages);
  }

  const fileName = `Ficha_${leaderName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}

export async function generateConsolidatedPDF(params: ConsolidatedPDFParams): Promise<void> {
  const { areaType, areaScore, leaders, failures, dateRange, unitName } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const areaLabel = areaType === "front" ? "FRONT" : "BACK";

  addGrupoCajuHeader(doc, {
    title: `RELATÓRIO CONSOLIDADO • ${areaLabel}`,
    subtitle: `Período: ${formatPeriod(dateRange)}`,
    unitName,
    rightTag: `${Math.round(areaScore)}%`,
  });

  // Score badge
  const scoreColor = getScoreColor(areaScore);
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(margin, 44, pageWidth - margin * 2, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`MÉDIA ${areaLabel}: ${Math.round(areaScore)}%`, margin + 4, 53);

  // Leaders table
  const leaderTableData = leaders.map((l) => [
    l.name,
    POSITION_LABELS[l.position] || l.position,
    `${Math.round(l.score)}%`,
    `${getTierEmoji(l.tier)} ${getTierLabel(l.tier)}`,
    l.failureCount.toString(),
  ]);

  autoTable(doc, {
    startY: 64,
    head: [["Líder", "Cargo", "Nota", "Selo", "Falhas"]],
    body: leaderTableData,
    theme: "striped",
    headStyles: {
      fillColor: PDF_BRAND.primary,
      textColor: 255,
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 55 },
      2: { cellWidth: 18 },
      3: { cellWidth: 32 },
      4: { cellWidth: 18 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;

  // Failures by sector
  addSectionHeader(doc, "Falhas por setor", finalY + 8);

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
      startY: finalY + 18,
      head: [["Setor", "Não Conformidades"]],
      body: sectorTableData,
      theme: "plain",
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 40 },
      },
    });
  }

  // Detailed cards
  if (failures.length > 0) {
    doc.addPage();
    addGrupoCajuHeader(doc, {
      title: `DETALHAMENTO • ${areaLabel}`,
      subtitle: "Cards de ocorrência por não conformidade",
      unitName,
    });
    addSectionHeader(doc, "Não conformidades", 44);

    let y = 55;
    const cardX = margin;
    const cardW = pageWidth - margin * 2;
    const maxY = pageHeight - 24;

    for (let i = 0; i < failures.length; i++) {
      const res = await drawOccurrenceCard(doc, {
        failure: failures[i],
        index: i,
        x: cardX,
        y,
        width: cardW,
        maxPageY: maxY,
      });

      if (res.pageBreak) {
        doc.addPage();
        addGrupoCajuHeader(doc, {
          title: `DETALHAMENTO • ${areaLabel}`,
          subtitle: "Continuação",
          unitName,
        });
        addSectionHeader(doc, "Não conformidades", 44);
        y = 55;
        i--;
        continue;
      }

      y = res.nextY;
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addGrupoCajuFooter(doc, p, totalPages);
  }

  const fileName = `Consolidado_${areaLabel}_${unitName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}
