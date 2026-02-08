import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LOGO_BASE64 } from "@/lib/logoBase64";

/**
 * GRUPO CAJU - INSTITUTIONAL PDF THEME
 * 
 * Design System:
 * - Predominant white background
 * - Black/graphite text
 * - Strategic use of INSTITUTIONAL RED (only for: titles, indicators, separators, status)
 * - No gradients, heavy shadows, or decorative effects
 * - Clean, minimalist, corporate aesthetic
 */

// Institutional Color Palette
export const PDF_COLORS = {
  // Primary institutional red
  institutional: [208, 89, 55] as [number, number, number],
  institutionalLight: [251, 235, 230] as [number, number, number],
  
  // Neutrals
  black: [0, 0, 0] as [number, number, number],
  graphite: [30, 41, 59] as [number, number, number],
  gray600: [75, 85, 99] as [number, number, number],
  gray500: [107, 114, 128] as [number, number, number],
  gray400: [156, 163, 175] as [number, number, number],
  gray300: [209, 213, 219] as [number, number, number],
  gray200: [229, 231, 235] as [number, number, number],
  gray100: [243, 244, 246] as [number, number, number],
  gray50: [249, 250, 251] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  
  // Semantic (used sparingly)
  success: [16, 185, 129] as [number, number, number],
  successLight: [236, 253, 245] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  warningLight: [254, 243, 199] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  dangerLight: [254, 226, 226] as [number, number, number],
};

// Legacy export for compatibility
export const PDF_BRAND = {
  primary: PDF_COLORS.institutional,
  primaryLight: PDF_COLORS.institutionalLight,
  secondaryText: PDF_COLORS.gray500,
  headerBg: PDF_COLORS.gray50,
  border: PDF_COLORS.gray200,
  success: PDF_COLORS.success,
  warning: PDF_COLORS.warning,
  danger: PDF_COLORS.danger,
};

// Layout Constants
export const PDF_LAYOUT = {
  margin: 20,
  pageWidth: 210, // A4
  pageHeight: 297, // A4
  contentWidth: 170, // 210 - 20*2
  footerHeight: 15,
  headerHeight: 45,
};

// Typography
export const PDF_TYPOGRAPHY = {
  title: { size: 22, weight: "bold" },
  subtitle: { size: 14, weight: "bold" },
  heading: { size: 12, weight: "bold" },
  subheading: { size: 10, weight: "bold" },
  body: { size: 10, weight: "normal" },
  small: { size: 9, weight: "normal" },
  caption: { size: 8, weight: "normal" },
  tiny: { size: 7, weight: "normal" },
};

// Tier configuration
export type TierType = "ouro" | "prata" | "bronze" | "red_flag";

export interface TierInfo {
  label: string;
  color: [number, number, number];
  bgColor: [number, number, number];
}

export function getTierInfo(tier: TierType): TierInfo {
  switch (tier) {
    case "ouro":
      return { label: "OURO", color: [161, 98, 7], bgColor: [254, 249, 195] };
    case "prata":
      return { label: "PRATA", color: [71, 85, 105], bgColor: [241, 245, 249] };
    case "bronze":
      return { label: "BRONZE", color: [180, 83, 9], bgColor: [255, 237, 213] };
    case "red_flag":
      return { label: "CRÍTICO", color: [185, 28, 28], bgColor: [254, 226, 226] };
  }
}

export function getScoreColor(score: number): [number, number, number] {
  if (score >= 95) return PDF_COLORS.success;
  if (score >= 85) return PDF_COLORS.warning;
  return PDF_COLORS.danger;
}

/**
 * ============================================================
 * 1. EXECUTIVE COVER PAGE
 * ============================================================
 */
export interface CoverPageParams {
  leaderName: string;
  position: string;
  unitName: string;
  dateRange: string;
  score: number;
  tier: TierType;
  failureCount: number;
}

export function addExecutiveCover(doc: jsPDF, params: CoverPageParams): void {
  const { leaderName, position, unitName, dateRange, score, tier, failureCount } = params;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;
  const margin = PDF_LAYOUT.margin;

  // Logo centered at top
  try {
    doc.addImage(LOGO_BASE64, "JPEG", centerX - 20, 25, 40, 28);
  } catch {
    // Fallback
  }

  // Institutional line under logo
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(1);
  doc.line(margin, 60, pageWidth - margin, 60);

  // Main title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text("Relatório de Auditoria Operacional", centerX, 80, { align: "center" });

  // Subtitle (position)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(position, centerX, 92, { align: "center" });

  // Institutional data block
  const blockY = 115;
  const blockHeight = 55;
  
  doc.setFillColor(...PDF_COLORS.gray50);
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin + 20, blockY, pageWidth - margin * 2 - 40, blockHeight, 3, 3, "FD");

  // Block content
  const leftX = margin + 35;
  let labelY = blockY + 15;

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("RESPONSÁVEL", leftX, labelY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(leaderName.toUpperCase(), leftX, labelY + 8);

  // Unit
  labelY += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("UNIDADE", leftX, labelY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(unitName, leftX, labelY + 8);

  // Period (right side)
  const rightX = pageWidth - margin - 35;
  labelY = blockY + 15;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("PERÍODO AUDITADO", rightX, labelY, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(dateRange, rightX, labelY + 8, { align: "right" });

  // Emission date
  labelY += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("DATA DE EMISSÃO", rightX, labelY, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(format(new Date(), "dd/MM/yyyy", { locale: ptBR }), rightX, labelY + 8, { align: "right" });

  // Performance indicators
  const indicatorsY = 195;
  const tierInfo = getTierInfo(tier);
  const scoreColor = getScoreColor(score);

  // Score box
  const scoreBoxWidth = 70;
  const scoreBoxHeight = 50;
  const scoreBoxX = centerX - scoreBoxWidth / 2 - 45;
  
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...scoreColor);
  doc.setLineWidth(2);
  doc.roundedRect(scoreBoxX, indicatorsY, scoreBoxWidth, scoreBoxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("CONFORMIDADE", scoreBoxX + scoreBoxWidth / 2, indicatorsY + 12, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...scoreColor);
  doc.text(`${Math.round(score)}%`, scoreBoxX + scoreBoxWidth / 2, indicatorsY + 35, { align: "center" });

  // Tier box
  const tierBoxX = centerX - scoreBoxWidth / 2 + 45;
  
  doc.setFillColor(...tierInfo.bgColor);
  doc.setDrawColor(...tierInfo.color);
  doc.setLineWidth(2);
  doc.roundedRect(tierBoxX, indicatorsY, scoreBoxWidth, scoreBoxHeight, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("CLASSIFICAÇÃO", tierBoxX + scoreBoxWidth / 2, indicatorsY + 12, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...tierInfo.color);
  doc.text(tierInfo.label, tierBoxX + scoreBoxWidth / 2, indicatorsY + 35, { align: "center" });

  // Non-conformities count
  if (failureCount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text(`${failureCount} não conformidade(s) identificada(s)`, centerX, indicatorsY + 65, { align: "center" });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.success);
    doc.text("Nenhuma não conformidade identificada", centerX, indicatorsY + 65, { align: "center" });
  }

  // Bottom institutional line
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - 40, pageWidth - margin, pageHeight - 40);

  // Confidentiality notice
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray400);
  doc.text("Documento de uso interno • Grupo Caju", centerX, pageHeight - 30, { align: "center" });
}

/**
 * ============================================================
 * 2. EXECUTIVE SUMMARY
 * ============================================================
 */
export interface SummaryParams {
  failureCount: number;
  recurringCount: number;
  criticalPoints: string[];
  score: number;
}

export function addExecutiveSummary(doc: jsPDF, params: SummaryParams): number {
  const { failureCount, recurringCount, criticalPoints, score } = params;
  const margin = PDF_LAYOUT.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin + 10;

  // Section title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text("Resumo Executivo", margin, y);
  
  y += 4;
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 50, y);
  y += 12;

  // Summary boxes row
  const boxWidth = (pageWidth - margin * 2 - 16) / 3;
  const boxHeight = 35;
  const boxGap = 8;

  // Box 1: Total non-conformities
  doc.setFillColor(...PDF_COLORS.gray50);
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 2, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("NÃO CONFORMIDADES", margin + boxWidth / 2, y + 10, { align: "center" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...(failureCount > 0 ? PDF_COLORS.institutional : PDF_COLORS.success));
  doc.text(String(failureCount), margin + boxWidth / 2, y + 26, { align: "center" });

  // Box 2: Recurring items
  const box2X = margin + boxWidth + boxGap;
  doc.setFillColor(...PDF_COLORS.gray50);
  doc.roundedRect(box2X, y, boxWidth, boxHeight, 2, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("REINCIDÊNCIAS", box2X + boxWidth / 2, y + 10, { align: "center" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...(recurringCount > 0 ? PDF_COLORS.danger : PDF_COLORS.success));
  doc.text(String(recurringCount), box2X + boxWidth / 2, y + 26, { align: "center" });

  // Box 3: Score
  const box3X = margin + (boxWidth + boxGap) * 2;
  const scoreColor = getScoreColor(score);
  doc.setFillColor(...PDF_COLORS.gray50);
  doc.roundedRect(box3X, y, boxWidth, boxHeight, 2, 2, "FD");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("CONFORMIDADE", box3X + boxWidth / 2, y + 10, { align: "center" });
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...scoreColor);
  doc.text(`${Math.round(score)}%`, box3X + boxWidth / 2, y + 26, { align: "center" });

  y += boxHeight + 12;

  // Critical points (if any)
  if (criticalPoints.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.graphite);
    doc.text("Principais Pontos Críticos:", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.gray600);

    criticalPoints.slice(0, 5).forEach((point, i) => {
      const bullet = `${i + 1}.`;
      doc.text(bullet, margin + 4, y);
      const lines = doc.splitTextToSize(point, pageWidth - margin * 2 - 15);
      doc.text(lines, margin + 12, y);
      y += lines.length * 4.5 + 2;
    });
  }

  // Separator line
  y += 6;
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  return y + 10;
}

/**
 * ============================================================
 * 3. SECTION HEADER (for non-conformities section)
 * ============================================================
 */
export function addSectionHeader(doc: jsPDF, title: string, y: number): number {
  const margin = PDF_LAYOUT.margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text(title, margin, y);
  
  y += 4;
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 50, y);
  
  return y + 10;
}

/**
 * ============================================================
 * 4. PAGE CONTINUATION HEADER
 * ============================================================
 */
export function addContinuationHeader(doc: jsPDF, section?: string): number {
  const margin = PDF_LAYOUT.margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  // Logo small
  try {
    doc.addImage(LOGO_BASE64, "JPEG", margin, y - 5, 22, 15);
  } catch {
    // Fallback
  }

  // Section indicator
  if (section) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text(section, pageWidth - margin, y + 5, { align: "right" });
  }

  // Separator
  y += 16;
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  return y + 8;
}

/**
 * ============================================================
 * 5. SUCCESS MESSAGE (no failures)
 * ============================================================
 */
export function addNoFailuresMessage(doc: jsPDF, y: number): number {
  const margin = PDF_LAYOUT.margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_COLORS.successLight);
  doc.setDrawColor(...PDF_COLORS.success);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.success);
  doc.text("Parabéns! Nenhuma não conformidade registrada no período.", pageWidth / 2, y + 14, { align: "center" });

  return y + 34;
}

/**
 * ============================================================
 * 6. SIGNATURE PAGE (TERMO DE CIÊNCIA)
 * ============================================================
 */
export function addSignaturePage(doc: jsPDF): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF_LAYOUT.margin;
  const centerX = pageWidth / 2;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text("Termo de Ciência", centerX, margin + 20, { align: "center" });

  // Underline
  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(0.8);
  doc.line(centerX - 35, margin + 24, centerX + 35, margin + 24);

  // Formal text
  const textY = margin + 45;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.graphite);

  const formalText = [
    "Declaro que tomei ciência do conteúdo deste relatório de auditoria operacional,",
    "comprometendo-me a implementar as ações corretivas necessárias para sanar as",
    "não conformidades identificadas, nos prazos acordados."
  ];

  formalText.forEach((line, i) => {
    doc.text(line, centerX, textY + i * 6, { align: "center" });
  });

  // Signature boxes
  const boxY = textY + 50;
  const boxWidth = (pageWidth - margin * 2 - 20) / 2;
  const boxHeight = 50;

  // Left box: Responsible
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...PDF_COLORS.gray300);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, boxY, boxWidth, boxHeight, 2, 2, "FD");

  // Signature line
  doc.setDrawColor(...PDF_COLORS.gray400);
  doc.setLineWidth(0.3);
  doc.line(margin + 15, boxY + 30, margin + boxWidth - 15, boxY + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("Assinatura do Responsável", margin + boxWidth / 2, boxY + 38, { align: "center" });

  // Date line
  doc.setFontSize(8);
  doc.text("Data: ____/____/________", margin + boxWidth / 2, boxY + 46, { align: "center" });

  // Right box: Manager
  const rightBoxX = margin + boxWidth + 20;
  doc.setFillColor(...PDF_COLORS.white);
  doc.setDrawColor(...PDF_COLORS.gray300);
  doc.roundedRect(rightBoxX, boxY, boxWidth, boxHeight, 2, 2, "FD");

  doc.setDrawColor(...PDF_COLORS.gray400);
  doc.line(rightBoxX + 15, boxY + 30, rightBoxX + boxWidth - 15, boxY + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text("Assinatura do Gestor", rightBoxX + boxWidth / 2, boxY + 38, { align: "center" });

  doc.setFontSize(8);
  doc.text("Data: ____/____/________", rightBoxX + boxWidth / 2, boxY + 46, { align: "center" });

  // Footer note
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray400);
  doc.text("Este documento faz parte do sistema de gestão de qualidade do Grupo Caju", centerX, pageHeight - 35, { align: "center" });
}

/**
 * ============================================================
 * 7. PAGE FOOTER (all pages)
 * ============================================================
 */
export function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF_LAYOUT.margin;

  // Footer line
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

  // Left: Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.gray400);
  doc.text(format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }), margin, pageHeight - 7);

  // Center: Brand
  doc.text("Grupo Caju • Auditoria Operacional", pageWidth / 2, pageHeight - 7, { align: "center" });

  // Right: Pagination
  doc.text(`${pageNum}/${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
}
