import * as XLSX from "xlsx";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeString, stringSimilarity } from "@/lib/fuzzyMatch";

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

export interface UnmatchedEmployee {
  rowIndex: number;
  name: string;
  cargo: string;
}

export interface ScheduleParseResult {
  entries: ParsedScheduleEntry[];
  errors: ScheduleParseError[];
  workingCount: number;
  offCount: number;
  originalMonday: string | null;
  unmatchedEmployees: UnmatchedEmployee[];
}

// ─── Constants ───

const DAY_NAMES = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
const DAY_NAMES_NORM = DAY_NAMES.map((d) => normalizeString(d));
const SUB_HEADERS = ["ENTRADA", "INTERV.", "SAÍDA"];
const OFF_KEYWORDS = new Set(["folga", "f", "off", "fga", "folg", "fds mês", "fds mes", "férias", "ferias", "banco de horas"]);
const METADATA_ROW_KEY = "__CAJU_SCHEDULE_META__";

// ─── Template Generator (3 columns per day) ───

export function generateScheduleTemplate(
  employees: ScheduleEmployee[],
  weekDays: Date[],
  sectorName: string,
  unitName?: string
): void {
  const wb = XLSX.utils.book_new();
  const days = weekDays.length >= 7 ? weekDays.slice(0, 7) : weekDays;

  // ── ESCALA sheet ──
  const titleStr = `${sectorName.toUpperCase()} — ${(unitName || "").toUpperCase()} — SEMANA ${format(days[0], "dd/MM")} a ${format(days[days.length - 1], "dd/MM")}`;

  // Row 1: title merged across
  // Row 2: NOME | CARGO | SEGUNDA | | | TERÇA | | | ...
  // Row 3:       |       | ENTRADA | INTERV. | SAÍDA | ...
  // Row 4+: data

  const totalCols = 2 + days.length * 3; // NOME + CARGO + 3 per day

  // Build header rows
  const row1: string[] = [titleStr];
  for (let i = 1; i < totalCols; i++) row1.push("");

  const row2: string[] = ["NOME", "CARGO"];
  const row3: string[] = ["", ""];
  days.forEach((d, idx) => {
    const dayLabel = DAY_NAMES[idx] || format(d, "EEEE", { locale: ptBR }).toUpperCase();
    row2.push(dayLabel, "", "");
    row3.push(...SUB_HEADERS);
  });

  // Employee data rows
  const dataRows: string[][] = [];
  employees.forEach((emp) => {
    const row: string[] = [emp.name, emp.job_title || ""];
    days.forEach(() => row.push("", "", ""));
    dataRows.push(row);
  });

  const sheetData = [row1, row2, row3, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Merge title row
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];

  // Merge day name cells (each spans 3 cols)
  for (let d = 0; d < days.length; d++) {
    const startCol = 2 + d * 3;
    ws["!merges"].push({ s: { r: 1, c: startCol }, e: { r: 1, c: startCol + 2 } });
  }

  // Column widths
  const cols: XLSX.ColInfo[] = [{ wch: 25 }, { wch: 18 }];
  for (let d = 0; d < days.length; d++) {
    cols.push({ wch: 10 }, { wch: 8 }, { wch: 8 });
  }
  ws["!cols"] = cols;

  // Style: make header rows bold via cell formatting (xlsx doesn't support rich styles, but xlsx-js-style might be available)
  // We'll keep it simple — the structure itself is clear enough.

  XLSX.utils.book_append_sheet(wb, ws, "ESCALA");

  // ── __meta__ sheet (hidden) ──
  const metaHeader = ["employee_id", "employee_name", "worker_type"];
  const metaRows = [metaHeader, ...employees.map((e) => [e.id, e.name, e.worker_type])];
  // Also store dates
  const dateRow = [METADATA_ROW_KEY, ...days.map((d) => format(d, "yyyy-MM-dd"))];
  metaRows.push(dateRow);
  const metaWs = XLSX.utils.aoa_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, metaWs, "__meta__");

  // ── Instructions sheet ──
  const instrData = [
    ["📋 COLETA DE ESCALA — " + sectorName.toUpperCase()],
    [`UNIDADE: ${(unitName || "").toUpperCase()} | SEMANA: ${format(days[0], "dd/MM")} a ${format(days[days.length - 1], "dd/MM")}`],
    [""],
    ["═══════════════════════════════════════════════════════"],
    ["📌 COMO PREENCHER:"],
    ['1. Vá para a aba "ESCALA" (próxima aba)'],
    ["2. Para cada dia, preencha 3 campos:"],
    ["   ENTRADA → horário de início (ex: 11:00)"],
    ["   INTERV. → duração do intervalo (ex: 1h ou 3h)"],
    ["   SAÍDA   → horário de saída (ex: 23:00)"],
    ['3. Para dias de FOLGA → digite "FOLGA" na ENTRADA'],
    ['   Também aceito: "FDS MÊS", "FÉRIAS", "BANCO DE HORAS"'],
    ["   Deixe INTERVALO e SAÍDA em branco"],
    [""],
    ["═══════════════════════════════════════════════════════"],
    ["⚠️ ATENÇÃO:"],
    ["• Horários SEMPRE no formato HH:MM (24 horas)"],
    ["• Se sai após meia-noite, use 00:00 ou 01:00"],
    ["• NÃO altere cabeçalhos, NÃO adicione colunas"],
    ["• Intervalo mínimo: 01:00 | máximo: 04:00"],
    [""],
    ["═══════════════════════════════════════════════════════"],
    ["📤 APÓS PREENCHER:"],
    ["• Salve o arquivo (Ctrl+S)"],
    ["• Importe de volta no sistema pelo botão Importar Planilha"],
  ];
  const instrWs = XLSX.utils.aoa_to_sheet(instrData.map((r) => [r[0] || ""]));
  instrWs["!cols"] = [{ wch: 65 }];
  XLSX.utils.book_append_sheet(wb, instrWs, "Instruções");

  const filename = `ESCALA_${sectorName.toUpperCase().replace(/\s+/g, "_")}_${format(days[0], "ddMM")}_${format(days[days.length - 1], "ddMM")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── Helpers ───

function cellToString(cell: any): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string") return cell.trim();
  if (typeof cell === "number") {
    // Excel time fraction (0-1) → HH:MM
    if (cell >= 0 && cell < 1) return excelTimeToHHMM(cell);
    if (cell >= 1 && cell < 2) return excelTimeToHHMM(cell - 1); // e.g. 1.0 = 24:00 → 0:00
    return String(cell);
  }
  if (cell instanceof Date) return format(cell, "yyyy-MM-dd");
  return String(cell).trim();
}

function excelTimeToHHMM(fraction: number): string {
  const totalMinutes = Math.round(fraction * 1440);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function excelSerialToISO(serial: number): string {
  const excelEpoch = new Date(Date.UTC(1899, 11, 30));
  const ms = excelEpoch.getTime() + serial * 86400000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseDateCell(cell: any): string | null {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    return null;
  }
  if (typeof cell === "number" && cell > 30000 && cell < 200000) return excelSerialToISO(cell);
  if (cell instanceof Date) return format(cell, "yyyy-MM-dd");
  return null;
}

/** Parse break duration from interval cell: "1h", "3h", "3:00", "01:00", 60min fraction */
function parseBreakFromCell(cell: any): number {
  const val = cellToString(cell);
  if (!val) return 60; // default

  // "3h", "1h"
  const hMatch = val.match(/^(\d+)\s*h$/i);
  if (hMatch) return parseInt(hMatch[1], 10) * 60;

  // "HH:MM" format → interpret as duration in hours:minutes
  const hmMatch = val.match(/^(\d{1,2}):(\d{2})$/);
  if (hmMatch) return parseInt(hmMatch[1], 10) * 60 + parseInt(hmMatch[2], 10);

  // raw number (Excel fraction)
  if (typeof cell === "number" && cell > 0 && cell < 1) {
    return Math.round(cell * 1440);
  }

  return 60;
}

/** Parse a time string like "9:00", "23:00", "0:00" to "HH:MM" */
function parseTimeStr(cell: any): string | null {
  const val = cellToString(cell);
  if (!val) return null;
  const m = val.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return null;
}

function isOffKeyword(val: string): boolean {
  return OFF_KEYWORDS.has(val.toLowerCase().trim());
}

// ─── Detect format ───

function detect3ColFormat(rawData: any[][]): boolean {
  // Look for ENTRADA/INTERV./SAÍDA in any of the first 5 rows
  for (let r = 0; r < Math.min(5, rawData.length); r++) {
    const row = rawData[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const v = cellToString(row[c]).toUpperCase();
      if (v === "ENTRADA") return true;
    }
  }
  return false;
}

function detectLegacyFormat(rawData: any[][]): boolean {
  if (rawData.length > 0) {
    const firstCell = cellToString(rawData[0]?.[0]);
    if (firstCell === METADATA_ROW_KEY) return true;
  }
  return false;
}

// ─── 3-Column Parser ───

function parse3ColSheet(
  rawData: any[][],
  targetMonday: string | null,
  metaEmployees: Map<string, { id: string; name: string }> | null,
  allEmployees?: ScheduleEmployee[]
): ScheduleParseResult {
  const entries: ParsedScheduleEntry[] = [];
  const errors: ScheduleParseError[] = [];
  const unmatchedEmployees: UnmatchedEmployee[] = [];
  let workingCount = 0;
  let offCount = 0;

  // Find the sub-header row (ENTRADA)
  let subHeaderRow = -1;
  let dayHeaderRow = -1;
  let titleRow = -1;
  for (let r = 0; r < Math.min(10, rawData.length); r++) {
    const row = rawData[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const v = cellToString(row[c]).toUpperCase();
      if (v === "ENTRADA") {
        subHeaderRow = r;
        dayHeaderRow = r - 1;
        titleRow = r - 2;
        break;
      }
    }
    if (subHeaderRow >= 0) break;
  }

  if (subHeaderRow < 0) {
    return { entries, errors, workingCount, offCount, originalMonday: null, unmatchedEmployees };
  }

  // Parse day columns: find all ENTRADA positions
  const dayColumns: number[] = []; // start column of each day (where ENTRADA is)
  const subRow = rawData[subHeaderRow];
  for (let c = 0; c < subRow.length; c++) {
    if (cellToString(subRow[c]).toUpperCase() === "ENTRADA") {
      dayColumns.push(c);
    }
  }

  const numDays = dayColumns.length;

  // Try to extract original monday from title row
  let originalMonday: string | null = null;
  if (titleRow >= 0 && rawData[titleRow]) {
    const titleStr = cellToString(rawData[titleRow][0]);
    // "... SEMANA dd/MM a dd/MM" or "... SEMANA dd/MM/yyyy a dd/MM/yyyy"
    const semanaMatch = titleStr.match(/SEMANA\s+(\d{2})\/(\d{2})(?:\/(\d{4}))?\s+a/i);
    if (semanaMatch) {
      const day = semanaMatch[1];
      const month = semanaMatch[2];
      const year = semanaMatch[3] || new Date().getFullYear().toString();
      originalMonday = `${year}-${month}-${day}`;
    }
  }

  // Determine dates to use
  let dates: string[];
  if (targetMonday) {
    dates = [];
    for (let i = 0; i < numDays; i++) {
      dates.push(format(addDays(new Date(targetMonday + "T12:00:00"), i), "yyyy-MM-dd"));
    }
  } else if (originalMonday) {
    dates = [];
    for (let i = 0; i < numDays; i++) {
      dates.push(format(addDays(new Date(originalMonday + "T12:00:00"), i), "yyyy-MM-dd"));
    }
  } else {
    // Fallback: current week
    const now = new Date();
    const monday = addDays(now, -(((now.getDay() + 6) % 7)));
    dates = [];
    for (let i = 0; i < numDays; i++) {
      dates.push(format(addDays(monday, i), "yyyy-MM-dd"));
    }
  }

  // Build name→id map for fuzzy matching
  const nameMap = new Map<string, { id: string; name: string }>();
  if (metaEmployees) {
    metaEmployees.forEach((v, k) => nameMap.set(k, v));
  }
  if (allEmployees) {
    for (const emp of allEmployees) {
      const norm = normalizeString(emp.name);
      if (!nameMap.has(norm)) {
        nameMap.set(norm, { id: emp.id, name: emp.name });
      }
    }
  }

  // Parse data rows (start after sub-header)
  const dataStart = subHeaderRow + 1;
  for (let r = dataStart; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row) continue;

    const empName = cellToString(row[0]);
    if (!empName) continue;

    const cargo = cellToString(row[1]);
    const normName = normalizeString(empName);

    // Try exact match first
    let empId: string | null = null;
    let resolvedName = empName;

    if (nameMap.has(normName)) {
      const match = nameMap.get(normName)!;
      empId = match.id;
      resolvedName = match.name;
    } else {
      // Fuzzy match
      let bestSim = 0;
      let bestMatch: { id: string; name: string } | null = null;
      nameMap.forEach((val) => {
        const sim = stringSimilarity(empName, val.name);
        if (sim > bestSim) {
          bestSim = sim;
          bestMatch = val;
        }
      });

      if (bestMatch && bestSim >= 0.85) {
        empId = bestMatch.id;
        resolvedName = bestMatch.name;
      } else {
        unmatchedEmployees.push({ rowIndex: r, name: empName, cargo });
        continue;
      }
    }

    // Parse each day
    for (let d = 0; d < numDays; d++) {
      const colBase = dayColumns[d]; // ENTRADA col
      const entradaRaw = row[colBase];
      const intervRaw = row[colBase + 1];
      const saidaRaw = row[colBase + 2];

      const entradaStr = cellToString(entradaRaw);
      if (!entradaStr) continue; // empty = no schedule

      const dateStr = dates[d];
      const dateLabel = format(new Date(dateStr + "T12:00:00"), "EEE dd/MM", { locale: ptBR });

      // Check off keywords
      if (isOffKeyword(entradaStr)) {
        entries.push({
          employee_id: empId,
          employee_name: resolvedName,
          date: dateStr,
          schedule_type: "off",
          start_time: null,
          end_time: null,
          break_duration: 0,
        });
        offCount++;
        continue;
      }

      // Parse times
      const startTime = parseTimeStr(entradaRaw);
      const endTime = parseTimeStr(saidaRaw);

      if (!startTime) {
        errors.push({
          row: r + 1,
          employeeName: resolvedName,
          dateLabel,
          message: `Horário de entrada inválido: "${entradaStr}"`,
        });
        continue;
      }

      if (!endTime) {
        errors.push({
          row: r + 1,
          employeeName: resolvedName,
          dateLabel,
          message: `Horário de saída não informado ou inválido.`,
        });
        continue;
      }

      const breakDuration = parseBreakFromCell(intervRaw);

      entries.push({
        employee_id: empId,
        employee_name: resolvedName,
        date: dateStr,
        schedule_type: "working",
        start_time: startTime,
        end_time: endTime,
        break_duration: breakDuration,
      });
      workingCount++;
    }
  }

  return { entries, errors, workingCount, offCount, originalMonday, unmatchedEmployees };
}

// ─── Legacy Parser (1 col per day) ───

function parseLegacySheet(
  rawData: any[][],
  metaData: { employee_id: string; employee_name: string; worker_type: string }[],
  targetMonday: string | null
): ScheduleParseResult {
  const entries: ParsedScheduleEntry[] = [];
  const errors: ScheduleParseError[] = [];
  let workingCount = 0;
  let offCount = 0;

  const metaRow = rawData[0];
  const fileDates: string[] = [];
  for (let c = 1; c < metaRow.length; c++) {
    const dateStr = parseDateCell(metaRow[c]);
    if (dateStr) fileDates.push(dateStr);
  }

  const originalMonday = fileDates.length > 0 ? fileDates[0] : null;

  let dates: string[];
  if (targetMonday) {
    const numCols = Math.max(fileDates.length, 7);
    dates = [];
    for (let i = 0; i < numCols; i++) {
      dates.push(format(addDays(new Date(targetMonday + "T12:00:00"), i), "yyyy-MM-dd"));
    }
  } else {
    dates = fileDates;
  }

  if (dates.length === 0) {
    return { entries, errors, workingCount, offCount, originalMonday, unmatchedEmployees: [] };
  }

  const nameToMeta = new Map<string, (typeof metaData)[0]>();
  for (const m of metaData) {
    nameToMeta.set(m.employee_name.trim().toUpperCase(), m);
  }

  for (let r = 3; r < rawData.length; r++) {
    const row = rawData[r];
    const employeeName = cellToString(row[0]);
    if (!employeeName) continue;

    const empMeta = nameToMeta.get(employeeName.toUpperCase());
    if (!empMeta) {
      errors.push({ row: r + 1, employeeName, dateLabel: "", message: "Funcionário não encontrado na aba __meta__." });
      continue;
    }

    for (let c = 0; c < dates.length; c++) {
      const rawCell = row[c + 1];
      if (typeof rawCell === "number" && rawCell > 0 && rawCell < 1) {
        errors.push({
          row: r + 1,
          employeeName: empMeta.employee_name,
          dateLabel: format(new Date(dates[c] + "T12:00:00"), "EEE dd/MM", { locale: ptBR }),
          message: "Célula formatada como horário pelo Excel. Use formato texto.",
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

  return { entries, errors, workingCount, offCount, originalMonday, unmatchedEmployees: [] };
}

/** Legacy time range parser for "HH:MM - HH:MM (break)" format */
function parseTimeRange(cellValue: string): { start_time: string; end_time: string; break_duration: number } | null {
  const cleaned = cellValue.replace(/\s+/g, " ").trim().toLowerCase();
  if (!cleaned) return null;

  const separators = [" - ", " – ", " — ", "-", "–", "—", " as ", " a ", " até ", " ate "];
  for (const sep of separators) {
    const idx = cleaned.indexOf(sep);
    if (idx > 0) {
      const left = cleaned.slice(0, idx).trim();
      const rightRaw = cleaned.slice(idx + sep.length).trim();
      const rightTime = rightRaw.match(/^(\d{1,2}:\d{2})/);
      const startMatch = left.match(/^(\d{1,2}):(\d{2})$/);
      if (startMatch && rightTime) {
        const endParts = rightTime[1].match(/^(\d{1,2}):(\d{2})$/);
        if (endParts) {
          const start_time = `${startMatch[1].padStart(2, "0")}:${startMatch[2]}`;
          const end_time = `${endParts[1].padStart(2, "0")}:${endParts[2]}`;
          // Break from parentheses
          const breakPattern = /\(\s*(\d+)\s*(h|m|min|hr)\s*\)/i;
          const bm = cellValue.match(breakPattern);
          let break_duration: number;
          if (bm) {
            const bv = parseInt(bm[1], 10);
            break_duration = bm[2].toLowerCase().startsWith("h") ? bv * 60 : bv;
          } else {
            const sMin = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
            let eMin = parseInt(endParts[1]) * 60 + parseInt(endParts[2]);
            if (eMin <= sMin) eMin += 1440;
            break_duration = eMin - sMin > 360 ? 60 : 0;
          }
          return { start_time, end_time, break_duration };
        }
      }
    }
  }
  return null;
}

// ─── Main Parse Entry Point ───

export function parseScheduleFile(
  file: File,
  targetMonday?: string | null,
  allEmployees?: ScheduleEmployee[]
): Promise<ScheduleParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });

        // Read meta sheet if present
        const metaSheet = wb.Sheets["__meta__"];
        let metaData: { employee_id: string; employee_name: string; worker_type: string }[] = [];
        let metaEmployeeMap: Map<string, { id: string; name: string }> | null = null;

        if (metaSheet) {
          const raw = XLSX.utils.sheet_to_json<any>(metaSheet);
          metaData = raw.filter((r: any) => r.employee_id && r.employee_id !== METADATA_ROW_KEY);
          if (metaData.length > 0) {
            metaEmployeeMap = new Map();
            for (const m of metaData) {
              metaEmployeeMap.set(normalizeString(m.employee_name), { id: m.employee_id, name: m.employee_name });
            }
          }
        }

        // Find the main data sheet
        const scheduleSheet = wb.Sheets["ESCALA"] || wb.Sheets["Escala"] || wb.Sheets[wb.SheetNames.find((n) => n !== "__meta__" && n !== "Instruções") || wb.SheetNames[0]];

        if (!scheduleSheet) {
          reject(new Error("Nenhuma aba de escala encontrada."));
          return;
        }

        const rawData = XLSX.utils.sheet_to_json<any>(scheduleSheet, { header: 1, defval: "", raw: true }) as any[][];

        if (rawData.length < 3) {
          reject(new Error("Planilha vazia ou com formato inválido."));
          return;
        }

        // Detect format
        if (detect3ColFormat(rawData)) {
          resolve(parse3ColSheet(rawData, targetMonday || null, metaEmployeeMap, allEmployees));
        } else if (detectLegacyFormat(rawData)) {
          if (metaData.length === 0) {
            reject(new Error("Formato legado detectado mas aba __meta__ sem dados."));
            return;
          }
          resolve(parseLegacySheet(rawData, metaData, targetMonday || null));
        } else {
          reject(new Error("Formato de planilha não reconhecido. Use o modelo gerado pelo sistema ou o formato padrão com ENTRADA/INTERV./SAÍDA."));
        }
      } catch (err) {
        reject(new Error("Erro ao processar arquivo. Verifique se é um Excel válido."));
      }
    };

    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}
