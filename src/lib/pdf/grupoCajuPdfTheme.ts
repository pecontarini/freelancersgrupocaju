import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LOGO_BASE64 } from "@/lib/logoBase64";

export const PDF_BRAND = {
  primary: [208, 89, 55] as [number, number, number],
  primaryLight: [251, 235, 230] as [number, number, number],
  secondaryText: [100, 116, 139] as [number, number, number],
  headerBg: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
};

const MARGIN = 20; // mm

interface LeaderHeaderParams {
  leaderName: string;
  position: string;
  score: number;
  tier: "ouro" | "prata" | "bronze" | "red_flag";
  failureCount: number;
  dateRange: string;
  unitName: string;
}

/**
 * Get tier display info
 */
function getTierInfo(tier: "ouro" | "prata" | "bronze" | "red_flag"): { 
  label: string; 
  emoji: string; 
  color: [number, number, number];
  bgColor: [number, number, number];
} {
  switch (tier) {
    case "ouro":
      return { 
        label: "OURO", 
        emoji: "🥇", 
        color: [161, 98, 7],
        bgColor: [254, 249, 195]
      };
    case "prata":
      return { 
        label: "PRATA", 
        emoji: "🥈", 
        color: [71, 85, 105],
        bgColor: [241, 245, 249]
      };
    case "bronze":
      return { 
        label: "BRONZE", 
        emoji: "🥉", 
        color: [180, 83, 9],
        bgColor: [255, 237, 213]
      };
    case "red_flag":
      return { 
        label: "CRÍTICO", 
        emoji: "🚨", 
        color: [185, 28, 28],
        bgColor: [254, 226, 226]
      };
  }
}

/**
 * Get score color based on value
 */
function getScoreColor(score: number): [number, number, number] {
  if (score >= 95) return PDF_BRAND.success;
  if (score >= 85) return PDF_BRAND.warning;
  return PDF_BRAND.danger;
}

/**
 * Add professional header with 2-column table layout
 */
export function addLeadershipHeader(
  doc: jsPDF,
  params: LeaderHeaderParams
): number {
  const { leaderName, position, score, tier, failureCount, dateRange, unitName } = params;
  const pageWidth = doc.internal.pageSize.getWidth();
  const tierInfo = getTierInfo(tier);
  const scoreColor = getScoreColor(score);

  // Header table using autoTable for structured layout
  autoTable(doc, {
    startY: MARGIN,
    margin: { left: MARGIN, right: MARGIN },
    theme: "plain",
    tableWidth: pageWidth - MARGIN * 2,
    styles: {
      cellPadding: 4,
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: (pageWidth - MARGIN * 2) * 0.6 },
      1: { cellWidth: (pageWidth - MARGIN * 2) * 0.4, halign: "right" },
    },
    body: [
      [
        { content: "", styles: { minCellHeight: 45 } },
        { content: "", styles: { minCellHeight: 45 } },
      ],
    ],
    didDrawCell: (data) => {
      if (data.row.index === 0) {
        const cellX = data.cell.x;
        const cellY = data.cell.y;
        const cellWidth = data.cell.width;
        const cellHeight = data.cell.height;

        if (data.column.index === 0) {
          // LEFT COLUMN: Logo + Info
          try {
            doc.addImage(LOGO_BASE64, "JPEG", cellX + 2, cellY + 2, 28, 20);
          } catch {
            // Logo fallback
          }

          // Leader name
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(30, 41, 59);
          doc.text(leaderName.toUpperCase(), cellX + 34, cellY + 10);

          // Position
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(...PDF_BRAND.secondaryText);
          doc.text(`Cargo: ${position}`, cellX + 34, cellY + 18);

          // Unit
          doc.text(`Unidade: ${unitName}`, cellX + 34, cellY + 25);

          // Period
          doc.text(`Período: ${dateRange}`, cellX + 34, cellY + 32);

          // Failure count
          doc.text(`Não conformidades: ${failureCount} item(s)`, cellX + 34, cellY + 39);

        } else {
          // RIGHT COLUMN: Score + Tier badge
          const scoreBoxWidth = 70;
          const scoreBoxHeight = 35;
          const scoreX = cellX + cellWidth - scoreBoxWidth - 4;
          const scoreY = cellY + 4;

          // Score background
          doc.setFillColor(...scoreColor);
          doc.roundedRect(scoreX, scoreY, scoreBoxWidth, scoreBoxHeight, 3, 3, "F");

          // Score value
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(24);
          doc.text(`${Math.round(score)}%`, scoreX + scoreBoxWidth / 2, scoreY + 16, { align: "center" });

          // Tier label
          doc.setFontSize(11);
          doc.text(`${tierInfo.emoji} ${tierInfo.label}`, scoreX + scoreBoxWidth / 2, scoreY + 28, { align: "center" });
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || MARGIN + 50;

  // Horizontal separator
  doc.setDrawColor(...PDF_BRAND.primary);
  doc.setLineWidth(1);
  doc.line(MARGIN, finalY + 4, pageWidth - MARGIN, finalY + 4);

  return finalY + 12;
}

/**
 * Add section header bar
 */
export function addSectionHeader(doc: jsPDF, label: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PDF_BRAND.primary);
  doc.roundedRect(MARGIN, y, pageWidth - MARGIN * 2, 9, 1.5, 1.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(label.toUpperCase(), MARGIN + 5, y + 6);

  return y + 14;
}

/**
 * Add success message when no failures
 */
export function addNoFailuresMessage(doc: jsPDF, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(...PDF_BRAND.success);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, pageWidth - MARGIN * 2, 18, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_BRAND.success);
  doc.text("✅ Parabéns! Nenhuma não conformidade registrada no período.", MARGIN + 6, y + 11);

  return y + 26;
}

/**
 * Add signature section
 */
export function addSignatureSection(doc: jsPDF, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const boxWidth = (pageWidth - MARGIN * 3) / 2;
  const boxHeight = 32;

  // Section title
  addSectionHeader(doc, "Termo de Ciência", y);
  y += 18;

  // Left signature box (Responsável)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, boxWidth, boxHeight, 2, 2, "FD");

  // Signature line
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 10, y + 20, MARGIN + boxWidth - 10, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.text("Assinatura do Responsável", MARGIN + boxWidth / 2, y + 26, { align: "center" });
  doc.text("Data: ___/___/______", MARGIN + boxWidth / 2, y + 30, { align: "center" });

  // Right signature box (Gestor)
  const rightX = MARGIN * 2 + boxWidth;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.roundedRect(rightX, y, boxWidth, boxHeight, 2, 2, "FD");

  doc.setDrawColor(150, 150, 150);
  doc.line(rightX + 10, y + 20, rightX + boxWidth - 10, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.text("Assinatura do Gestor", rightX + boxWidth / 2, y + 26, { align: "center" });
  doc.text("Data: ___/___/______", rightX + boxWidth / 2, y + 30, { align: "center" });

  return y + boxHeight + 8;
}

/**
 * Add footer with pagination and date
 */
export function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Footer line
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, pageHeight - 14, pageWidth - MARGIN, pageHeight - 14);

  // Left: Date
  doc.setTextColor(...PDF_BRAND.secondaryText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    `Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    MARGIN,
    pageHeight - 8
  );

  // Center: Brand
  doc.text("Portal da Liderança • Grupo Caju", pageWidth / 2, pageHeight - 8, { align: "center" });

  // Right: Pagination
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - MARGIN, pageHeight - 8, { align: "right" });
}

/**
 * Add continuation header for subsequent pages
 */
export function addContinuationHeader(
  doc: jsPDF, 
  title: string, 
  subtitle?: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Simple header bar
  doc.setFillColor(...PDF_BRAND.headerBg);
  doc.setDrawColor(...PDF_BRAND.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, MARGIN, pageWidth - MARGIN * 2, 16, 2, 2, "FD");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_BRAND.primary);
  doc.text(title, MARGIN + 6, MARGIN + 7);

  // Subtitle
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_BRAND.secondaryText);
    doc.text(subtitle, MARGIN + 6, MARGIN + 13);
  }

  // Bottom line
  doc.setDrawColor(...PDF_BRAND.primary);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, MARGIN + 20, pageWidth - MARGIN, MARGIN + 20);

  return MARGIN + 28;
}
