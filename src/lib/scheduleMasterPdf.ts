import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { PDF_COLORS, PDF_LAYOUT } from "@/lib/pdf/grupoCajuPdfTheme";
import { jsDayToPopDay } from "@/lib/popConventions";
import { fetchScheduleData, type ScheduleDataResult } from "@/lib/scheduleMasterExport";
import { meetsMinimumOverlap, LUNCH_PEAK, DINNER_PEAK } from "@/lib/peakHours";

const DAY_LABELS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface PdfExportParams {
  unitId: string;
  unitName: string;
  weekStart: Date;
}

function formatBreak(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes % 60 === 0) return `(${minutes / 60}h)`;
  return `(${minutes}m)`;
}

function getCellText(entry: any): { text: string; type: string } {
  if (!entry) return { text: "", type: "empty" };
  if (entry.schedule_type === "off") return { text: "FOLGA", type: "folga" };
  if (entry.schedule_type === "vacation") return { text: "FÉRIAS", type: "ferias" };
  if (entry.schedule_type === "sick_leave") return { text: "ATESTADO", type: "atestado" };
  const start = entry.start_time ? entry.start_time.slice(0, 5) : "";
  const end = entry.end_time ? entry.end_time.slice(0, 5) : "";
  if (!start || !end) return { text: "Turno", type: "horario" };
  const brk = entry.break_duration || 0;
  const brkStr = formatBreak(brk);
  return { text: brkStr ? `${start}-${end} ${brkStr}` : `${start}-${end}`, type: "horario" };
}

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF_LAYOUT.margin;

  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.gray400);
  doc.text(format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }), margin, pageHeight - 10);
  doc.text("CajuPAR — Escala Operacional", pageWidth / 2, pageHeight - 10, { align: "center" });
  doc.text(`Página ${pageNum} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
}

function addSectorHeader(doc: jsPDF, sectorName: string) {
  const margin = PDF_LAYOUT.margin;
  const pageWidth = doc.internal.pageSize.getWidth();

  try {
    doc.addImage(LOGO_BASE64, "JPEG", margin, margin - 5, 22, 15);
  } catch { /* fallback */ }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text(sectorName, margin + 28, margin + 5);

  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.3);
  doc.line(margin, margin + 14, pageWidth - margin, margin + 14);
}

export async function exportMasterSchedulePdf({ unitId, unitName, weekStart }: PdfExportParams) {
  const data = await fetchScheduleData({ unitId, weekStart });
  const { sectors, weekDays, empMap, scheduleBySector, matrix, shifts, shiftTypes } = data;

  // Use landscape for better table fit
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF_LAYOUT.margin;
  const centerX = pageWidth / 2;

  // ── PAGE 1: Cover ──
  try {
    doc.addImage(LOGO_BASE64, "JPEG", centerX - 25, 30, 50, 35);
  } catch { /* fallback */ }

  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(1.2);
  doc.line(margin, 75, pageWidth - margin, 75);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...PDF_COLORS.institutional);
  doc.text("Escala Operacional Semanal", centerX, 95, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.setTextColor(...PDF_COLORS.graphite);
  doc.text(unitName, centerX, 110, { align: "center" });

  doc.setFontSize(13);
  doc.setTextColor(...PDF_COLORS.gray500);
  doc.text(
    `${format(weekDays[0], "dd/MM/yyyy")} a ${format(weekDays[6], "dd/MM/yyyy")}`,
    centerX, 122, { align: "center" }
  );

  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.gray400);
  doc.text(
    `Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    centerX, 138, { align: "center" }
  );

  doc.setDrawColor(...PDF_COLORS.institutional);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray400);
  doc.text("Documento de uso interno • CajuPAR", centerX, pageHeight - 22, { align: "center" });

  // ── SECTOR PAGES ──
  for (const sector of sectors) {
    doc.addPage();
    addSectorHeader(doc, sector.name);

    const sectorSchedules = scheduleBySector.get(sector.id) || [];
    const empIds = new Set(sectorSchedules.map((s: any) => s.employee_id).filter(Boolean));
    const sectorEmployees = Array.from(empIds)
      .map((id) => {
        const emp = empMap.get(id as string);
        return { id: id as string, name: emp?.name || "", worker_type: emp?.worker_type || "clt" };
      })
      .filter((e) => e.name);

    const cltEmployees = sectorEmployees.filter((e) => e.worker_type === "clt").sort((a, b) => a.name.localeCompare(b.name));
    const extraEmployees = sectorEmployees.filter((e) => e.worker_type !== "clt").sort((a, b) => a.name.localeCompare(b.name));

    // Build table body
    const head = [["Funcionário", ...weekDays.map((d, i) => `${DAY_LABELS_SHORT[i]} (${format(d, "dd/MM")})`)]];
    const body: any[][] = [];

    // CLT
    for (const emp of cltEmployees) {
      const row: any[] = [emp.name];
      for (const day of weekDays) {
        const dateStr = format(day, "yyyy-MM-dd");
        const entry = sectorSchedules.find((s: any) => s.employee_id === emp.id && s.schedule_date === dateStr);
        row.push(getCellText(entry).text);
      }
      body.push(row);
    }

    // Separator
    if (cltEmployees.length > 0 && extraEmployees.length > 0) {
      const sep = ["── EXTRAS ──", ...Array(7).fill("")];
      body.push(sep);
    }

    // Extras
    for (const emp of extraEmployees) {
      const row: any[] = [`${emp.name} [EXTRA]`];
      for (const day of weekDays) {
        const dateStr = format(day, "yyyy-MM-dd");
        const entry = sectorSchedules.find((s: any) => s.employee_id === emp.id && s.schedule_date === dateStr);
        row.push(getCellText(entry).text);
      }
      body.push(row);
    }

    // Separator row index for styling
    const separatorIdx = cltEmployees.length;
    const extraStartIdx = separatorIdx + (cltEmployees.length > 0 && extraEmployees.length > 0 ? 1 : 0);

    let tableEndY = margin + 20;

    autoTable(doc, {
      head,
      body,
      startY: margin + 20,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: {
        fontSize: 8,
        cellPadding: 2,
        halign: "center",
        valign: "middle",
        lineColor: [209, 213, 219],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: PDF_COLORS.institutional,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 50 },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      didParseCell: (hookData) => {
        if (hookData.section !== "body") return;
        const rowIdx = hookData.row.index;
        const colIdx = hookData.column.index;
        const cellText = String(hookData.cell.raw || "");

        // Separator row
        if (rowIdx === separatorIdx && cltEmployees.length > 0 && extraEmployees.length > 0) {
          hookData.cell.styles.fillColor = [254, 230, 138];
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.textColor = [146, 64, 14];
          return;
        }

        // Extra rows
        if (rowIdx >= extraStartIdx && rowIdx < body.length) {
          hookData.cell.styles.fillColor = [255, 247, 237];
          if (colIdx === 0) hookData.cell.styles.textColor = [146, 64, 14];
        }

        // Cell content styling
        if (colIdx > 0) {
          if (cellText === "FOLGA") {
            hookData.cell.styles.fillColor = [75, 85, 99];
            hookData.cell.styles.textColor = [255, 255, 255];
            hookData.cell.styles.fontStyle = "bold";
          } else if (cellText === "FÉRIAS") {
            hookData.cell.styles.fillColor = [243, 232, 255];
            hookData.cell.styles.textColor = [107, 33, 168];
            hookData.cell.styles.fontStyle = "bold";
          } else if (cellText === "ATESTADO") {
            hookData.cell.styles.fillColor = [254, 226, 226];
            hookData.cell.styles.textColor = [185, 28, 28];
            hookData.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: () => {
        // Header on continuation pages
        if (doc.internal.pages.length > 2) {
          addSectorHeader(doc, sector.name);
        }
      },
    });

    // Get final Y from autoTable
    tableEndY = (doc as any).lastAutoTable?.finalY || tableEndY + 50;

    // ── Summary block — per shift (POP rule: 2h minimum overlap) ──
    const summaryY = tableEndY + 6;
    const summaryHead = [["", ...weekDays.map((d, i) => `${DAY_LABELS_SHORT[i]}`)]];
    const summaryBody: any[][] = [];

    // Almoço row
    const lunchRow: any[] = ["Almoço (12h–15h)"];
    for (const day of weekDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      const daySchedules = sectorSchedules.filter(
        (s: any) => s.schedule_date === dateStr && s.schedule_type === "working"
      );
      let clt = 0, extra = 0;
      for (const s of daySchedules) {
        if (!meetsMinimumOverlap(s.start_time, s.end_time, LUNCH_PEAK)) continue;
        const emp = s.employee_id ? empMap.get(s.employee_id) : null;
        if (emp && emp.worker_type !== "clt") extra++;
        else clt++;
      }
      lunchRow.push(`${clt} / ${extra} / ${clt + extra}`);
    }
    summaryBody.push(lunchRow);

    // Jantar row
    const dinnerRow: any[] = ["Jantar (19h–22h)"];
    for (const day of weekDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      const daySchedules = sectorSchedules.filter(
        (s: any) => s.schedule_date === dateStr && s.schedule_type === "working"
      );
      let clt = 0, extra = 0;
      for (const s of daySchedules) {
        if (!meetsMinimumOverlap(s.start_time, s.end_time, DINNER_PEAK)) continue;
        const emp = s.employee_id ? empMap.get(s.employee_id) : null;
        if (emp && emp.worker_type !== "clt") extra++;
        else clt++;
      }
      dinnerRow.push(`${clt} / ${extra} / ${clt + extra}`);
    }
    summaryBody.push(dinnerRow);

    // POP rows
    for (const shiftType of shiftTypes) {
      const shiftLabel = shifts.find((s: any) => s.type === shiftType)?.name || shiftType;
      const popRow: any[] = [`POP ${shiftLabel}`];
      for (const day of weekDays) {
        const dow = jsDayToPopDay(day.getDay());
        const entry = matrix.find(
          (m: any) => m.sector_id === sector.id && m.day_of_week === dow && m.shift_type === shiftType
        );
        const ef = entry?.required_count ?? 0;
        const ext = entry?.extras_count ?? 0;
        if (ef === 0 && ext === 0) popRow.push("—");
        else if (ext > 0) popRow.push(`${ef}+${ext}`);
        else popRow.push(`${ef}`);
      }
      summaryBody.push(popRow);
    }

    // Check if we need a new page for summary
    if (summaryY + 30 > pageHeight - 20) {
      doc.addPage();
      addSectorHeader(doc, sector.name);
      autoTable(doc, {
        head: summaryHead,
        body: summaryBody,
        startY: margin + 20,
        margin: { left: margin, right: margin },
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 1.5, halign: "center", valign: "middle", lineColor: [209, 213, 219], lineWidth: 0.3 },
        headStyles: { fillColor: [107, 114, 128], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        columnStyles: { 0: { halign: "left", cellWidth: 50 } },
        didParseCell: (hookData) => {
          if (hookData.section === "body") {
            if (hookData.row.index === 0) {
              hookData.cell.styles.fillColor = [254, 249, 195];
              hookData.cell.styles.fontStyle = "bold";
            } else {
              hookData.cell.styles.fillColor = [229, 231, 235];
            }
          }
        },
      });
    } else {
      autoTable(doc, {
        head: summaryHead,
        body: summaryBody,
        startY: summaryY,
        margin: { left: margin, right: margin },
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 1.5, halign: "center", valign: "middle", lineColor: [209, 213, 219], lineWidth: 0.3 },
        headStyles: { fillColor: [107, 114, 128], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        columnStyles: { 0: { halign: "left", cellWidth: 50 } },
        didParseCell: (hookData) => {
          if (hookData.section === "body") {
            if (hookData.row.index === 0) {
              hookData.cell.styles.fillColor = [254, 249, 195];
              hookData.cell.styles.fontStyle = "bold";
            } else {
              hookData.cell.styles.fillColor = [229, 231, 235];
            }
          }
        },
      });
    }
  }

  // ── Add footers to all pages ──
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }

  const fileName = `Escala_${unitName.replace(/\s+/g, "_")}_${format(weekDays[0], "ddMMyyyy")}.pdf`;
  doc.save(fileName);
}
