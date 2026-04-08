import XLSX from "xlsx-js-style";
import { format, addDays, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { jsDayToPopDay } from "@/lib/popConventions";

const DAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

interface ExportParams {
  unitId: string;
  unitName: string;
  weekStart: Date;
}

// ── Shared data fetch (reused by PDF export) ──
export interface ScheduleDataResult {
  sectors: any[];
  schedules: any[];
  employees: any[];
  matrix: any[];
  shifts: any[];
  weekDays: Date[];
  empMap: Map<string, { name: string; worker_type: string }>;
  scheduleBySector: Map<string, any[]>;
  shiftTypes: string[];
}

export async function fetchScheduleData({ unitId, weekStart }: { unitId: string; weekStart: Date }): Promise<ScheduleDataResult> {
  const week = startOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const startStr = format(weekDays[0], "yyyy-MM-dd");
  const endStr = format(weekDays[6], "yyyy-MM-dd");

  const { data: sectors, error: secErr } = await supabase
    .from("sectors").select("*").eq("unit_id", unitId).order("name");
  if (secErr) throw new Error("Erro ao buscar setores: " + secErr.message);
  if (!sectors?.length) throw new Error("Nenhum setor cadastrado nesta unidade.");

  const sectorIds = sectors.map((s) => s.id);

  const { data: schedules, error: schErr } = await supabase
    .from("schedules").select("*").in("sector_id", sectorIds)
    .gte("schedule_date", startStr).lte("schedule_date", endStr).neq("status", "cancelled");
  if (schErr) throw new Error("Erro ao buscar escalas: " + schErr.message);

  const { data: employees, error: empErr } = await supabase
    .from("employees").select("id, name, worker_type").eq("unit_id", unitId).eq("active", true);
  if (empErr) throw new Error("Erro ao buscar funcionários: " + empErr.message);

  const { data: matrixData } = await supabase
    .from("staffing_matrix").select("*").in("sector_id", sectorIds);
  const matrix = matrixData || [];

  const { data: shiftsData } = await supabase
    .from("shifts").select("name, type");
  const shifts = shiftsData || [];
  const shiftTypes = [...new Set(shifts.map((s) => s.type))];

  const empMap = new Map<string, { name: string; worker_type: string }>();
  (employees || []).forEach((e) => empMap.set(e.id, { name: e.name, worker_type: e.worker_type || "clt" }));

  const scheduleBySector = new Map<string, any[]>();
  for (const s of schedules || []) {
    const arr = scheduleBySector.get(s.sector_id) || [];
    arr.push(s);
    scheduleBySector.set(s.sector_id, arr);
  }

  return { sectors, schedules: schedules || [], employees: employees || [], matrix, shifts, weekDays, empMap, scheduleBySector, shiftTypes };
}

// ── Style helpers ──

function formatBreak(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes % 60 === 0) return `(${minutes / 60}h)`;
  return `(${minutes}m)`;
}

const THIN_BORDER = { style: "thin", color: { rgb: "CCCCCC" } };
const BORDERS_ALL = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

const STYLE = {
  headerMerged: {
    font: { bold: true, sz: 14, color: { rgb: "D05937" } },
    alignment: { horizontal: "center", vertical: "center" },
    fill: { fgColor: { rgb: "FFFFFF" } },
  },
  dayHeader: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "D05937" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  },
  nameHeader: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "8B4513" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDERS_ALL,
  },
  cltRowEven: {
    font: { sz: 10 },
    fill: { fgColor: { rgb: "FFFFFF" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDERS_ALL,
  },
  cltRowOdd: {
    font: { sz: 10 },
    fill: { fgColor: { rgb: "F3F4F6" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDERS_ALL,
  },
  cellCenter: (bg: string) => ({
    font: { sz: 10 },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  }),
  extraSeparator: {
    font: { bold: true, sz: 10, color: { rgb: "92400E" } },
    fill: { fgColor: { rgb: "FDE68A" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  },
  extraRow: {
    font: { sz: 10, color: { rgb: "92400E" } },
    fill: { fgColor: { rgb: "FFF7ED" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDERS_ALL,
  },
  folga: {
    font: { bold: true, sz: 9, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4B5563" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  },
  ferias: {
    font: { bold: true, sz: 9, color: { rgb: "6B21A8" } },
    fill: { fgColor: { rgb: "F3E8FF" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  },
  resumo: {
    font: { bold: true, sz: 9 },
    fill: { fgColor: { rgb: "FEF9C3" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  },
  resumoLabel: {
    font: { bold: true, sz: 10 },
    fill: { fgColor: { rgb: "FEF9C3" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDERS_ALL,
  },
  pop: {
    font: { bold: true, sz: 9, color: { rgb: "374151" } },
    fill: { fgColor: { rgb: "E5E7EB" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  },
  popLabel: {
    font: { bold: true, sz: 10, color: { rgb: "374151" } },
    fill: { fgColor: { rgb: "E5E7EB" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDERS_ALL,
  },
  summaryHeader: {
    font: { bold: true, sz: 10, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "D05937" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  },
  summaryCell: (bg: string) => ({
    font: { sz: 10 },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  }),
  summaryTotal: {
    font: { bold: true, sz: 10 },
    fill: { fgColor: { rgb: "FEF9C3" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDERS_ALL,
  },
};

function getCellValue(entry: any): { text: string; type: "folga" | "ferias" | "atestado" | "horario" | "empty" } {
  if (!entry) return { text: "", type: "empty" };
  if (entry.schedule_type === "off") return { text: "FOLGA", type: "folga" };
  if (entry.schedule_type === "vacation") return { text: "FÉRIAS", type: "ferias" };
  if (entry.schedule_type === "sick_leave") return { text: "ATESTADO", type: "atestado" };

  const start = entry.start_time ? entry.start_time.slice(0, 5) : "";
  const end = entry.end_time ? entry.end_time.slice(0, 5) : "";
  if (!start || !end) return { text: "Turno", type: "horario" };

  const brk = entry.break_duration || 0;
  const brkStr = formatBreak(brk);
  const text = brkStr ? `${start}-${end} ${brkStr}` : `${start}-${end}`;
  return { text, type: "horario" };
}

function getCellStyle(type: string, isExtra: boolean, rowIndex: number) {
  if (type === "folga" || type === "atestado") return STYLE.folga;
  if (type === "ferias") return STYLE.ferias;
  if (isExtra) return { ...STYLE.cellCenter("FFF7ED"), font: { sz: 10, color: { rgb: "92400E" } } };
  return STYLE.cellCenter(rowIndex % 2 === 0 ? "FFFFFF" : "F3F4F6");
}

// ── Main export ──

export async function exportMasterSchedule({ unitId, unitName, weekStart }: ExportParams) {
  const data = await fetchScheduleData({ unitId, weekStart });
  const { sectors, weekDays, empMap, scheduleBySector, matrix, shifts, shiftTypes } = data;

  const wb = XLSX.utils.book_new();

  // Track summary data for "Resumo Geral" tab
  const summaryData: { sectorName: string; days: { clt: number; extra: number }[] }[] = [];

  for (const sector of sectors) {
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

    const ws: XLSX.WorkSheet = {};
    let row = 0;

    // Row 0: Merged header
    const titleText = `${sector.name} — ${unitName} — ${format(weekDays[0], "dd/MM")} a ${format(weekDays[6], "dd/MM/yyyy")}`;
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: titleText, s: STYLE.headerMerged };
    for (let c = 1; c <= 7; c++) {
      ws[XLSX.utils.encode_cell({ r: row, c })] = { v: "", s: STYLE.headerMerged };
    }
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
    row += 2; // Skip row 1

    // Row 2: Day headers
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: "Funcionário", s: STYLE.nameHeader };
    for (let i = 0; i < 7; i++) {
      ws[XLSX.utils.encode_cell({ r: row, c: i + 1 })] = {
        v: `${DAY_LABELS[i]} (${format(weekDays[i], "dd/MM")})`,
        s: STYLE.dayHeader,
      };
    }
    row++;

    // CLT employees
    let cltIdx = 0;
    for (const emp of cltEmployees) {
      const rowStyle = cltIdx % 2 === 0 ? STYLE.cltRowEven : STYLE.cltRowOdd;
      ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: emp.name, s: rowStyle };
      for (let d = 0; d < 7; d++) {
        const dateStr = format(weekDays[d], "yyyy-MM-dd");
        const entry = sectorSchedules.find((s: any) => s.employee_id === emp.id && s.schedule_date === dateStr);
        const { text, type } = getCellValue(entry);
        ws[XLSX.utils.encode_cell({ r: row, c: d + 1 })] = { v: text, s: getCellStyle(type, false, cltIdx) };
      }
      row++;
      cltIdx++;
    }

    // Extras separator
    if (cltEmployees.length > 0 && extraEmployees.length > 0) {
      ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: "── EXTRAS ──", s: STYLE.extraSeparator };
      for (let c = 1; c <= 7; c++) {
        ws[XLSX.utils.encode_cell({ r: row, c })] = { v: "", s: STYLE.extraSeparator };
      }
      ws["!merges"].push({ s: { r: row, c: 0 }, e: { r: row, c: 7 } });
      row++;
    }

    // Extra/freelancer employees
    for (const emp of extraEmployees) {
      ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: `${emp.name} [EXTRA]`, s: STYLE.extraRow };
      for (let d = 0; d < 7; d++) {
        const dateStr = format(weekDays[d], "yyyy-MM-dd");
        const entry = sectorSchedules.find((s: any) => s.employee_id === emp.id && s.schedule_date === dateStr);
        const { text, type } = getCellValue(entry);
        ws[XLSX.utils.encode_cell({ r: row, c: d + 1 })] = { v: text, s: getCellStyle(type, true, 0) };
      }
      row++;
    }

    // Empty separator
    row++;

    // Daily summary
    const sectorDaySummary: { clt: number; extra: number }[] = [];
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: "RESUMO DO DIA", s: STYLE.resumoLabel };
    for (let d = 0; d < 7; d++) {
      const dateStr = format(weekDays[d], "yyyy-MM-dd");
      const daySchedules = sectorSchedules.filter(
        (s: any) => s.schedule_date === dateStr && s.schedule_type === "working"
      );
      let cltCount = 0;
      let extraCount = 0;
      for (const s of daySchedules) {
        const emp = s.employee_id ? empMap.get(s.employee_id) : null;
        if (emp && emp.worker_type !== "clt") extraCount++;
        else cltCount++;
      }
      sectorDaySummary.push({ clt: cltCount, extra: extraCount });
      ws[XLSX.utils.encode_cell({ r: row, c: d + 1 })] = {
        v: `Efet: ${cltCount} | Ext: ${extraCount} | Total: ${cltCount + extraCount}`,
        s: STYLE.resumo,
      };
    }
    summaryData.push({ sectorName: sector.name, days: sectorDaySummary });
    row++;

    // Empty separator
    row++;

    // POP header
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: "POP — Efetivo Mínimo", s: STYLE.popLabel };
    for (let c = 1; c <= 7; c++) {
      ws[XLSX.utils.encode_cell({ r: row, c })] = { v: "", s: STYLE.pop };
    }
    ws["!merges"].push({ s: { r: row, c: 0 }, e: { r: row, c: 7 } });
    row++;

    for (const shiftType of shiftTypes) {
      const shiftLabel = shifts.find((s: any) => s.type === shiftType)?.name || shiftType;
      ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: `POP ${shiftLabel}`, s: STYLE.popLabel };
      for (let d = 0; d < 7; d++) {
        const dow = jsDayToPopDay(weekDays[d].getDay());
        const entry = matrix.find(
          (m: any) => m.sector_id === sector.id && m.day_of_week === dow && m.shift_type === shiftType
        );
        const efetivos = entry?.required_count ?? 0;
        const extras = entry?.extras_count ?? 0;
        let text = "—";
        if (efetivos > 0 || extras > 0) {
          text = extras > 0 ? `${efetivos} + ${extras} extras` : `${efetivos}`;
        }
        ws[XLSX.utils.encode_cell({ r: row, c: d + 1 })] = { v: text, s: STYLE.pop };
      }
      row++;
    }

    // Set ref and cols
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: 7 } });
    ws["!cols"] = [{ wch: 32 }, ...Array(7).fill({ wch: 22 })];
    ws["!rows"] = [{ hpt: 30 }]; // taller first row

    const sheetName = sector.name.length > 31 ? sector.name.slice(0, 31) : sector.name;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // ── "Resumo Geral" tab ──
  {
    const ws: XLSX.WorkSheet = {};
    let row = 0;

    // Title
    const titleText = `Resumo Geral — ${unitName} — ${format(weekDays[0], "dd/MM")} a ${format(weekDays[6], "dd/MM/yyyy")}`;
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: titleText, s: STYLE.headerMerged };
    for (let c = 1; c <= 7; c++) ws[XLSX.utils.encode_cell({ r: row, c })] = { v: "", s: STYLE.headerMerged };
    if (!ws["!merges"]) ws["!merges"] = [];
    ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
    row += 2;

    // Headers
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: "Setor", s: STYLE.summaryHeader };
    for (let i = 0; i < 7; i++) {
      ws[XLSX.utils.encode_cell({ r: row, c: i + 1 })] = {
        v: `${DAY_LABELS[i]} (${format(weekDays[i], "dd/MM")})`,
        s: STYLE.summaryHeader,
      };
    }
    row++;

    // Data rows
    const totals = Array(7).fill(null).map(() => ({ clt: 0, extra: 0 }));
    summaryData.forEach((sd, idx) => {
      const bg = idx % 2 === 0 ? "FFFFFF" : "F3F4F6";
      ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: sd.sectorName, s: { ...STYLE.summaryCell(bg), alignment: { horizontal: "left", vertical: "center" }, font: { sz: 10, bold: true } } };
      for (let d = 0; d < 7; d++) {
        const { clt, extra } = sd.days[d];
        totals[d].clt += clt;
        totals[d].extra += extra;
        ws[XLSX.utils.encode_cell({ r: row, c: d + 1 })] = {
          v: `${clt} + ${extra} ext = ${clt + extra}`,
          s: STYLE.summaryCell(bg),
        };
      }
      row++;
    });

    // Totals row
    ws[XLSX.utils.encode_cell({ r: row, c: 0 })] = { v: "TOTAL GERAL", s: { ...STYLE.summaryTotal, alignment: { horizontal: "left", vertical: "center" } } };
    for (let d = 0; d < 7; d++) {
      const { clt, extra } = totals[d];
      ws[XLSX.utils.encode_cell({ r: row, c: d + 1 })] = {
        v: `${clt} + ${extra} ext = ${clt + extra}`,
        s: STYLE.summaryTotal,
      };
    }
    row++;

    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row - 1, c: 7 } });
    ws["!cols"] = [{ wch: 32 }, ...Array(7).fill({ wch: 22 })];
    ws["!rows"] = [{ hpt: 30 }];

    XLSX.utils.book_append_sheet(wb, ws, "Resumo Geral");
  }

  const fileName = `Escala_Geral_${unitName.replace(/\s+/g, "_")}_${format(weekDays[0], "ddMMyyyy")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
