import * as XLSX from "xlsx";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ───

export interface ScheduleEmployee {
  id: string;
  name: string;
  job_title: string | null;
  worker_type: string;
}

export interface ParsedScheduleEntry {
  employee_id: string;
  employee_name: string;
  date: string; // YYYY-MM-DD
  schedule_type: "working" | "off";
  start_time: string | null;
  end_time: string | null;
  break_duration: number; // minutes
}

export interface ScheduleParseError {
  row: number;
  employeeName: string;
  dateLabel: string;
  message: string;
}

export interface ScheduleParseResult {
  entries: ParsedScheduleEntry[];
  errors: ScheduleParseError[];
  workingCount: number;
  offCount: number;
  /** ISO date of the first date found in the file's meta row (original week) */
  originalMonday: string | null;
}

// ─── Template Generator ───

const METADATA_ROW_KEY = "__CAJU_SCHEDULE_META__";

export function generateScheduleTemplate(
  employees: ScheduleEmployee[],
  weekDays: Date[],
  sectorName: string
): void {
  const wb = XLSX.utils.book_new();

  // Row 1 (metadata): marker + employee IDs in col A, ISO dates in cols B-H
  const metaRow: string[] = [METADATA_ROW_KEY];
  weekDays.forEach((d) => metaRow.push(format(d, "yyyy-MM-dd")));

  // Row 2 (ID row): employee IDs will go here per data row
  // Row 3 (header): visible header
  const headerRow = ["Funcionário"];
  weekDays.forEach((d) => {
    const dayLabel = format(d, "EEE", { locale: ptBR });
    const dateLabel = format(d, "dd/MM");
    headerRow.push(`${dayLabel} (${dateLabel})`);
  });

  // Build sheet data
  const sheetData: (string | number)[][] = [];
  sheetData.push(metaRow);

  // ID row (hidden)
  const idRowHeader = ["__IDS__"];
  weekDays.forEach(() => idRowHeader.push(""));
  sheetData.push(idRowHeader);

  // Visible header
  sheetData.push(headerRow);

  // Employee rows
  employees.forEach((emp) => {
    const row: string[] = [emp.name];
    weekDays.forEach(() => row.push("")); // empty cells for filling
    sheetData.push(row);

    // Store ID in the hidden ID row concept — we'll use a different approach:
    // Put ID as a comment-like value in metadata
  });

  // Actually, let's use a cleaner approach: put IDs in a separate hidden sheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Force meta row date cells to be TEXT so Excel doesn't convert to serial numbers
  for (let c = 1; c <= weekDays.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cellRef]) {
      ws[cellRef].t = "s"; // force string type
      ws[cellRef].z = "@"; // text number format
    }
  }

  // Set column widths
  ws["!cols"] = [
    { wch: 25 }, // Employee name
    ...weekDays.map(() => ({ wch: 18 })),
  ];

  // Hide rows 1 and 2 (metadata + IDs)
  ws["!rows"] = [{ hidden: true }, { hidden: true }];

  // Add cell comments/instructions to data cells
  for (let r = 3; r < 3 + employees.length; r++) {
    for (let c = 1; c <= weekDays.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: "s", v: "" };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Escala");

  // Hidden metadata sheet with employee IDs
  const metaSheetData: string[][] = [["employee_id", "employee_name", "worker_type"]];
  employees.forEach((emp) => {
    metaSheetData.push([emp.id, emp.name, emp.worker_type]);
  });
  const metaWs = XLSX.utils.aoa_to_sheet(metaSheetData);
  XLSX.utils.book_append_sheet(wb, metaWs, "__meta__");

  // Instructions sheet
  const instrData = [
    ["INSTRUÇÕES DE PREENCHIMENTO"],
    [""],
    ["1. Preencha os horários no formato: 08:00 - 16:00"],
    ["2. Para especificar intervalo: 08:00 - 16:00 (30m) ou (1h) ou (3h)"],
    ["3. Se omitido, turnos > 6h assumem intervalo de 1h"],
    ["4. Para FOLGA, digite: FOLGA (ou F, OFF)"],
    ["5. Para dobra (turno longo), ex: 11:00 - 23:00"],
    ["6. Deixe vazio para não programar nada"],
    ["7. NÃO altere os nomes dos funcionários na coluna A"],
    ["8. NÃO altere a aba __meta__ (dados do sistema)"],
    ["9. IMPORTANTE: Formate as células de horário como TEXTO no Excel"],
    [""],
    [`Setor: ${sectorName}`],
    [`Semana: ${format(weekDays[0], "dd/MM/yyyy")} a ${format(weekDays[6], "dd/MM/yyyy")}`],
    [`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`],
  ];
  const instrWs = XLSX.utils.aoa_to_sheet(instrData.map((row) => [row[0] || ""]));
  instrWs["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, instrWs, "Instruções");

  const filename = `escala_${sectorName.toLowerCase().replace(/\s+/g, "_")}_${format(weekDays[0], "ddMMyyyy")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── Importer / Parser ───

const OFF_KEYWORDS = new Set(["folga", "f", "off", "fga", "folg"]);

function parseBreakDuration(cellValue: string, startTime: string, endTime: string): number {
  // Look for break info in parentheses: (1h), (60m), (30m), (15m), (3h), etc.
  const breakPattern = /\(\s*(\d+)\s*(h|m|min|hr)\s*\)/i;
  const match = cellValue.match(breakPattern);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === "h" || unit === "hr") return value * 60;
    return value; // already minutes
  }

  // Default: 60 min for shifts > 6h, 0 otherwise
  const sMin = timeToMinutes(startTime);
  let eMin = timeToMinutes(endTime);
  if (eMin <= sMin) eMin += 1440;
  const shiftLength = eMin - sMin;
  return shiftLength > 360 ? 60 : 0;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Convert an Excel serial date number to ISO YYYY-MM-DD string */
function excelSerialToISO(serial: number): string {
  // Excel epoch is 1900-01-01, but has a leap year bug (day 60 = Feb 29, 1900 which doesn't exist)
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = excelEpoch.getTime() + serial * 86400000;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert an Excel time fraction (0–1) to HH:MM string */
function excelTimeToHHMM(fraction: number): string {
  const totalMinutes = Math.round(fraction * 1440);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Normalize a cell value to a string, handling Excel serial dates/times */
function cellToString(cell: any): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string") return cell.trim();
  if (typeof cell === "number") {
    // Could be an Excel time fraction (0 < x < 1) — but schedule cells are text, so just stringify
    return String(cell);
  }
  if (cell instanceof Date) {
    return format(cell, "yyyy-MM-dd");
  }
  return String(cell).trim();
}

/** Extract a date string from a meta-row cell that may be ISO text or Excel serial number */
function parseDateCell(cell: any): string | null {
  if (cell === null || cell === undefined) return null;

  // Already an ISO string
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    // Try parsing dd/MM/yyyy
    const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    return null;
  }

  // Excel serial date number (typically > 40000 for modern dates)
  if (typeof cell === "number" && cell > 30000 && cell < 200000) {
    return excelSerialToISO(cell);
  }

  // JS Date object
  if (cell instanceof Date) {
    return format(cell, "yyyy-MM-dd");
  }

  return null;
}

function parseTimeRange(cellValue: string): {
  start_time: string;
  end_time: string;
  break_duration: number;
} | null {
  const cleaned = cellValue
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // If cell is empty after cleaning, skip
  if (!cleaned) return null;

  const separators = [" - ", " – ", " — ", "-", "–", "—", " as ", " a ", " até ", " ate "];

  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0) {
      const left = cleaned.slice(0, idx).trim();
      // Right side: take only the time part (strip break info)
      const rightRaw = cleaned.slice(idx + sep.length).trim();
      const rightTime = rightRaw.match(/^(\d{1,2}:\d{2})/);

      const startMatch = left.match(/^(\d{1,2}):(\d{2})$/);

      if (startMatch && rightTime) {
        const endParts = rightTime[1].match(/^(\d{1,2}):(\d{2})$/);
        if (endParts) {
          const sh = startMatch[1].padStart(2, "0");
          const sm = startMatch[2];
          const eh = endParts[1].padStart(2, "0");
          const em = endParts[2];
          const start_time = `${sh}:${sm}`;
          const end_time = `${eh}:${em}`;
          const break_duration = parseBreakDuration(cellValue, start_time, end_time);
          return { start_time, end_time, break_duration };
        }
      }
    }
  }

  return null;
}

/**
 * Parse a schedule Excel file.
 * @param file        The .xlsx file
 * @param targetMonday  Optional ISO date (YYYY-MM-DD) of the Monday to use.
 *                      When provided, the dates from the file are IGNORED and
 *                      columns are mapped positionally starting from this date.
 */
export function parseScheduleFile(
  file: File,
  targetMonday?: string | null
): Promise<ScheduleParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        // Read metadata sheet
        const metaSheet = wb.Sheets["__meta__"];
        if (!metaSheet) {
          reject(new Error("Arquivo inválido. Use o modelo gerado pelo sistema (aba __meta__ ausente)."));
          return;
        }

        const metaData = XLSX.utils.sheet_to_json<{
          employee_id: string;
          employee_name: string;
          worker_type: string;
        }>(metaSheet);

        if (metaData.length === 0) {
          reject(new Error("Nenhum funcionário encontrado no modelo."));
          return;
        }

        // Read schedule sheet
        const scheduleSheet = wb.Sheets["Escala"];
        if (!scheduleSheet) {
          reject(new Error("Aba 'Escala' não encontrada."));
          return;
        }

        const rawData = XLSX.utils.sheet_to_json<any>(scheduleSheet, {
          header: 1,
          defval: "",
          raw: true,
        }) as any[][];

        if (rawData.length < 4) {
          reject(new Error("Planilha vazia ou com formato inválido."));
          return;
        }

        // Row 0 = metadata (marker + ISO dates or Excel serial dates)
        const metaRow = rawData[0];
        const metaMarker = cellToString(metaRow[0]);
        if (metaMarker !== METADATA_ROW_KEY) {
          reject(new Error("Formato de planilha não reconhecido. Use o modelo gerado pelo sistema."));
          return;
        }

        // Extract original dates from file for reference
        const fileDates: string[] = [];
        for (let c = 1; c < metaRow.length; c++) {
          const dateStr = parseDateCell(metaRow[c]);
          if (dateStr) fileDates.push(dateStr);
        }

        const originalMonday = fileDates.length > 0 ? fileDates[0] : null;

        // Determine which dates to actually use
        let dates: string[];
        if (targetMonday) {
          // Generate 7 days positionally from the target monday
          const numCols = Math.max(fileDates.length, 7);
          dates = [];
          for (let i = 0; i < numCols; i++) {
            dates.push(format(addDays(new Date(targetMonday + "T12:00:00"), i), "yyyy-MM-dd"));
          }
        } else {
          dates = fileDates;
        }

        if (dates.length === 0) {
          reject(new Error("Datas não encontradas no cabeçalho da planilha."));
          return;
        }

        // Build name->meta map
        const nameToMeta = new Map<string, typeof metaData[0]>();
        for (const m of metaData) {
          nameToMeta.set(m.employee_name.trim().toUpperCase(), m);
        }

        const entries: ParsedScheduleEntry[] = [];
        const errors: ScheduleParseError[] = [];
        let workingCount = 0;
        let offCount = 0;

        for (let r = 3; r < rawData.length; r++) {
          const row = rawData[r];
          const employeeName = cellToString(row[0]);
          if (!employeeName) continue;

          const empMeta = nameToMeta.get(employeeName.toUpperCase());

          if (!empMeta) {
            errors.push({
              row: r + 1,
              employeeName,
              dateLabel: "",
              message: "Funcionário não encontrado na aba __meta__. Verifique se o nome não foi alterado.",
            });
            continue;
          }

          for (let c = 0; c < dates.length; c++) {
            const rawCell = row[c + 1];

            if (typeof rawCell === "number" && rawCell > 0 && rawCell < 1) {
              errors.push({
                row: r + 1,
                employeeName: empMeta.employee_name,
                dateLabel: format(new Date(dates[c] + "T12:00:00"), "EEE dd/MM", { locale: ptBR }),
                message: `Célula formatada como horário pelo Excel. Use formato texto: HH:MM - HH:MM.`,
              });
              continue;
            }

            const cellValue = cellToString(rawCell);
            if (!cellValue) continue;

            const dateStr = dates[c];
            const dateLabel = format(new Date(dateStr + "T12:00:00"), "EEE dd/MM", { locale: ptBR });
            const cellLower = cellValue.toLowerCase().trim();

            if (OFF_KEYWORDS.has(cellLower)) {
              entries.push({
                employee_id: empMeta.employee_id,
                employee_name: empMeta.employee_name,
                date: dateStr,
                schedule_type: "off",
                start_time: null,
                end_time: null,
                break_duration: 0,
              });
              offCount++;
              continue;
            }

            const parsed = parseTimeRange(cellValue);
            if (parsed) {
              entries.push({
                employee_id: empMeta.employee_id,
                employee_name: empMeta.employee_name,
                date: dateStr,
                schedule_type: "working",
                start_time: parsed.start_time,
                end_time: parsed.end_time,
                break_duration: parsed.break_duration,
              });
              workingCount++;
              continue;
            }

            errors.push({
              row: r + 1,
              employeeName: empMeta.employee_name,
              dateLabel,
              message: `Formato inválido: "${cellValue}". Use HH:MM - HH:MM ou FOLGA.`,
            });
          }
        }

        resolve({ entries, errors, workingCount, offCount, originalMonday });
      } catch (err) {
        reject(new Error("Erro ao processar arquivo. Verifique se é um Excel válido."));
      }
    };

    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}
