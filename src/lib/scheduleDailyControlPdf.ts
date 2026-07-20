import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getExportBranding } from "@/lib/pdf/exportBranding";
import { PDF_COLORS, PDF_LAYOUT } from "@/lib/pdf/grupoCajuPdfTheme";
import type { DailyRosterRow } from "@/hooks/useDailyRoster";

interface DailyControlPdfParams {
  unitName: string;
  /** YYYY-MM-DD */
  date: string;
  rows: DailyRosterRow[];
}

function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : "—";
}

function brk(min: number): string {
  if (!min || min <= 0) return "—";
  if (min % 60 === 0) return `${min / 60}h`;
  return `${min}min`;
}

/**
 * Gera uma folha de controle de intervalos (A4 paisagem) com colunas em branco
 * para o gestor preencher: saída p/ intervalo, retorno e assinatura.
 */
export async function exportDailyBreakControl({ unitName, date, rows }: DailyControlPdfParams) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF_LAYOUT.margin;

  // ---------- Header ----------
  const branding = getExportBranding();
  if (branding.logoDataUrl) {
    try {
      doc.addImage(branding.logoDataUrl, branding.logoFormat, margin, 8, 22, 14);
    } catch {
      /* logo opcional */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text("Controle de Intervalos", margin + 26, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.gray600);
  doc.text(unitName, margin + 26, 19);

  const dateLabel = format(parseISO(date + "T12:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(dateLabel, pageWidth - margin, 14, { align: "right" });

  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.3);
  doc.line(margin, 26, pageWidth - margin, 26);

  // ---------- Body ----------
  let cursorY = 32;

  // Agrupa por setor preservando a ordem já definida pelo hook
  const bySector = new Map<string, DailyRosterRow[]>();
  for (const r of rows) {
    if (!bySector.has(r.sector_name)) bySector.set(r.sector_name, []);
    bySector.get(r.sector_name)!.push(r);
  }

  if (bySector.size === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_COLORS.gray400);
    doc.text("Sem colaboradores escalados nesta data.", margin, cursorY + 10);
  }

  let idx = 1;
  for (const [sectorName, sectorRows] of bySector) {
    // Seção do setor
    doc.setFillColor(...PDF_COLORS.gray100);
    doc.rect(margin, cursorY, pageWidth - margin * 2, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.graphite);
    doc.text(sectorName.toUpperCase(), margin + 2, cursorY + 5);
    cursorY += 9;

    const body = sectorRows.map((r) => [
      String(idx++),
      r.employee_name,
      r.job_title || "—",
      hhmm(r.start_time),
      hhmm(r.end_time),
      brk(r.break_duration),
      "", // saída p/ intervalo
      "", // retorno
      "", // assinatura
    ]);

    autoTable(doc, {
      startY: cursorY,
      head: [[
        "#",
        "Colaborador",
        "Cargo",
        "Entrada",
        "Saída",
        "Interv. previsto",
        "Saída p/ intervalo",
        "Retorno",
        "Assinatura",
      ]],
      body,
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 2.2,
        textColor: PDF_COLORS.graphite as any,
        lineColor: PDF_COLORS.gray200 as any,
        lineWidth: 0.2,
        minCellHeight: 9, // espaço para escrever à mão
      },
      headStyles: {
        fillColor: PDF_COLORS.gray100 as any,
        textColor: PDF_COLORS.graphite as any,
        fontStyle: "bold",
        fontSize: 8.5,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 38 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 22, halign: "center" },
        6: { cellWidth: 30 },
        7: { cellWidth: 25 },
        8: { cellWidth: "auto" as any },
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 6;

    if (cursorY > pageHeight - 25) {
      doc.addPage();
      cursorY = margin;
    }
  }

  // ---------- Footer em todas as páginas ----------
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_COLORS.gray200);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.gray400);
    doc.text(
      format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      margin,
      pageHeight - 10,
    );
    doc.text(`${branding.fullName} — Folha de Controle de Intervalos`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });
    doc.text(`Página ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, {
      align: "right",
    });
  }

  const fileName = `controle-intervalos_${unitName.replace(/\s+/g, "-")}_${date}.pdf`;
  doc.save(fileName);
}
