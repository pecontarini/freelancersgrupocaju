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
    case "ouro": return "🥇 OURO";
    case "prata": return "🥈 PRATA";
    case "bronze": return "🥉 BRONZE";
    case "red_flag": return "🚨 CRÍTICO";
  }
}

function getScoreColor(score: number): [number, number, number] {
  if (score >= 95) return [16, 185, 129]; // Emerald
  if (score >= 85) return [245, 158, 11]; // Amber
  return [239, 68, 68]; // Red
}

export function generateLeadershipPDF(params: LeadershipPDFParams): void {
  const { leaderName, position, score, tier, failures, dateRange, unitName } = params;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header with logo
  try {
    doc.addImage(LOGO_BASE64, "JPEG", 15, 10, 40, 20);
  } catch (e) {
    console.warn("Could not add logo to PDF");
  }
  
  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE PERFORMANCE", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(unitName.toUpperCase(), pageWidth / 2, 28, { align: "center" });
  
  // Leader Info Box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 40, pageWidth - 30, 35, 3, 3, "FD");
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(leaderName, 25, 52);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Cargo: ${POSITION_LABELS[position]}`, 25, 60);
  
  // Period
  const periodText = `Período: ${dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "—"} a ${dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "—"}`;
  doc.text(periodText, 25, 68);
  
  // Score Badge
  const scoreColor = getScoreColor(score);
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(pageWidth - 70, 45, 50, 25, 3, 3, "F");
  
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`${score}%`, pageWidth - 45, 57, { align: "center" });
  
  doc.setFontSize(8);
  doc.text(getTierLabel(tier), pageWidth - 45, 65, { align: "center" });
  
  // Non-conformities section
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("NÃO CONFORMIDADES DO SETOR", 15, 90);
  
  if (failures.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Nenhuma não conformidade registrada no período.", 15, 100);
  } else {
    // Table of failures
    const tableData = failures.map((f, index) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      const sectorName = SECTOR_POSITION_MAP[sector]?.displayName || sector;
      return [
        (index + 1).toString(),
        f.item_name.length > 50 ? f.item_name.substring(0, 50) + "..." : f.item_name,
        sectorName,
        f.status === "pending" ? "Pendente" : f.status === "resolved" ? "Corrigido" : "Validado",
        f.is_recurring ? "🔁 Sim" : "Não",
      ];
    });

    autoTable(doc, {
      startY: 95,
      head: [["#", "Item", "Setor", "Status", "Recorrente"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 80 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
      },
      margin: { left: 15, right: 15 },
    });
  }
  
  // Signature area
  const signatureY = pageHeight - 50;
  doc.setDrawColor(150, 150, 150);
  doc.line(15, signatureY, 95, signatureY);
  doc.line(pageWidth - 95, signatureY, pageWidth - 15, signatureY);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Assinatura do Líder", 55, signatureY + 5, { align: "center" });
  doc.text("Assinatura do Gestor", pageWidth - 55, signatureY + 5, { align: "center" });
  
  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const footerText = `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Portal da Liderança - Grupo Caju`;
  doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: "center" });
  
  // Save
  const fileName = `Performance_${leaderName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}

export function generateConsolidatedPDF(params: ConsolidatedPDFParams): void {
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
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`RELATÓRIO CONSOLIDADO - ${areaLabel}`, pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(unitName.toUpperCase(), pageWidth / 2, 28, { align: "center" });
  
  // Period
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const periodText = `Período: ${dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : "—"} a ${dateRange.to ? format(dateRange.to, "dd/MM/yyyy") : "—"}`;
  doc.text(periodText, pageWidth / 2, 36, { align: "center" });
  
  // Area Score Box
  const scoreColor = getScoreColor(areaScore);
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.roundedRect(pageWidth / 2 - 30, 42, 60, 25, 3, 3, "F");
  
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(`${areaScore}%`, pageWidth / 2, 57, { align: "center" });
  
  doc.setFontSize(9);
  doc.text(`MÉDIA ${areaLabel}`, pageWidth / 2, 64, { align: "center" });
  
  // Leadership Summary
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO POR LIDERANÇA", 15, 80);
  
  const leaderTableData = leaders.map((l) => [
    l.name,
    `${l.score}%`,
    getTierLabel(l.tier),
    l.failureCount.toString(),
  ]);

  autoTable(doc, {
    startY: 85,
    head: [["Líder", "Nota", "Selo", "Falhas"]],
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
      0: { cellWidth: 60 },
      1: { cellWidth: 25 },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
    },
    margin: { left: 15, right: 15 },
  });
  
  // Get the final Y position after the table
  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  
  // Sector Breakdown
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("SETORES INCLUÍDOS", 15, finalY + 15);
  
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
        textColor: [30, 30, 30],
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40 },
      },
      margin: { left: 15, right: 15 },
    });
  }
  
  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  const footerText = `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Portal da Liderança - Grupo Caju`;
  doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: "center" });
  
  // Save
  const fileName = `Consolidado_${areaLabel}_${unitName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}
