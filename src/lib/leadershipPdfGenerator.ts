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
  const margin = 12;

  // ===== COVER PAGE =====
  addGrupoCajuHeader(doc, {
    title: "FICHA DE OCORRÊNCIAS",
    subtitle: "Checklist de Supervisão • Guia de Correção",
    unitName,
    rightTag: `${Math.round(score)}%`,
  });

  const scoreColor = getScoreColor(score);

  // Leader info card
  const infoY = 46;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, infoY, pageWidth - margin * 2, 36, 3, 3, "FD");

  // Leader name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(leaderName.toUpperCase(), margin + 6, infoY + 12);

  // Position
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.text(`Cargo: ${POSITION_LABELS[position]}`, margin + 6, infoY + 20);

  // Period
  doc.text(`Período: ${formatPeriod(dateRange)}`, margin + 6, infoY + 26);

  // Failure count
  doc.text(`Não conformidades: ${failures.length} item(s)`, margin + 6, infoY + 32);

  // Score badge (right side)
  const badgeW = 50;
  const badgeH = 26;
  const badgeX = pageWidth - margin - badgeW - 6;
  const badgeY = infoY + 5;
  
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${Math.round(score)}%`, badgeX + badgeW / 2, badgeY + 11, { align: "center" });
  
  doc.setFontSize(9);
  doc.text(`${getTierEmoji(tier)} ${getTierLabel(tier)}`, badgeX + badgeW / 2, badgeY + 20, { align: "center" });

  // ===== OCCURRENCES SECTION =====
  addSectionHeader(doc, "Não conformidades identificadas", 88);

  let y = 100;
  const cardX = margin;
  const cardW = pageWidth - margin * 2;
  const maxY = pageHeight - 20;

  if (failures.length === 0) {
    // Success message
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(margin, y, cardW, 20, 3, 3, "FD");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129);
    doc.text("✅ Parabéns! Nenhuma não conformidade registrada no período.", margin + 6, y + 12);
    y += 28;
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
          subtitle: `${leaderName} • Continuação`,
          unitName,
        });
        addSectionHeader(doc, "Não conformidades (continuação)", 44);
        y = 56;
        i--; // Retry same card on new page
        continue;
      }

      y = res.nextY;
    }
  }

  // ===== SIGNATURE SECTION =====
  const signatureNeedsNewPage = y > pageHeight - 60;
  
  if (signatureNeedsNewPage) {
    doc.addPage();
    addGrupoCajuHeader(doc, {
      title: "TERMO DE CIÊNCIA",
      subtitle: "Responsabilidade sobre correções",
      unitName,
    });
    y = 50;
  } else {
    y += 10;
  }

  addSectionHeader(doc, "Assinaturas e ciência", y);
  y += 14;

  // Signature boxes
  const sigBoxW = (pageWidth - margin * 3) / 2;
  const sigBoxH = 28;

  // Left signature (Responsável)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.roundedRect(margin, y, sigBoxW, sigBoxH, 2, 2, "FD");
  
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.2);
  doc.line(margin + 8, y + 18, margin + sigBoxW - 8, y + 18);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.text("Assinatura do Responsável", margin + sigBoxW / 2, y + 23, { align: "center" });
  doc.text("Data: ___/___/______", margin + sigBoxW / 2, y + 27, { align: "center" });

  // Right signature (Gestor)
  const rightSigX = margin * 2 + sigBoxW;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.roundedRect(rightSigX, y, sigBoxW, sigBoxH, 2, 2, "FD");
  
  doc.setDrawColor(150, 150, 150);
  doc.line(rightSigX + 8, y + 18, rightSigX + sigBoxW - 8, y + 18);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.text("Assinatura do Gestor", rightSigX + sigBoxW / 2, y + 23, { align: "center" });
  doc.text("Data: ___/___/______", rightSigX + sigBoxW / 2, y + 27, { align: "center" });

  // ===== FOOTER ON ALL PAGES =====
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
  const margin = 12;

  const areaLabel = areaType === "front" ? "FRONT" : "BACK";

  addGrupoCajuHeader(doc, {
    title: `RELATÓRIO CONSOLIDADO • ${areaLabel}`,
    subtitle: `Período: ${formatPeriod(dateRange)}`,
    unitName,
    rightTag: `${Math.round(areaScore)}%`,
  });

  // Area score banner
  const scoreColor = getScoreColor(areaScore);
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(margin, 46, pageWidth - margin * 2, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`MÉDIA ${areaLabel}: ${Math.round(areaScore)}%`, margin + 6, 54);

  // Leaders summary table
  const leaderTableData = leaders.map((l) => [
    l.name,
    POSITION_LABELS[l.position] || l.position,
    `${Math.round(l.score)}%`,
    `${getTierEmoji(l.tier)} ${getTierLabel(l.tier)}`,
    l.failureCount.toString(),
  ]);

  autoTable(doc, {
    startY: 64,
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
      0: { cellWidth: 50 },
      1: { cellWidth: 50 },
      2: { cellWidth: 20 },
      3: { cellWidth: 30 },
      4: { cellWidth: 20 },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;

  // Failures by sector summary
  addSectionHeader(doc, "Resumo por setor", finalY + 8);

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
        0: { cellWidth: 110 },
        1: { cellWidth: 50 },
      },
    });
  }

  // Detailed occurrence cards
  if (failures.length > 0) {
    doc.addPage();
    addGrupoCajuHeader(doc, {
      title: `DETALHAMENTO • ${areaLabel}`,
      subtitle: "Fichas de ocorrência individuais",
      unitName,
    });
    addSectionHeader(doc, "Não conformidades detalhadas", 44);

    let y = 56;
    const cardX = margin;
    const cardW = pageWidth - margin * 2;
    const maxY = pageHeight - 20;

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
        addSectionHeader(doc, "Não conformidades (continuação)", 44);
        y = 56;
        i--;
        continue;
      }

      y = res.nextY;
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addGrupoCajuFooter(doc, p, totalPages);
  }

  const fileName = `Consolidado_${areaLabel}_${unitName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}
