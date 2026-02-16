import * as XLSX from "xlsx";

export interface ChecklistFacilRow {
  itemName: string;
  quantidade: number;
  rawQuantidade: string;
}

export interface ChecklistFacilParseResult {
  rows: ChecklistFacilRow[];
  detectedDate: string | null; // YYYY-MM-DD
  detectedUnit: string | null;
  totalRows: number;
  skippedRows: number;
}

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumnByKey(headers: string[], candidates: string[]): string | null {
  const normalizedHeaders = headers.map((h) => ({ original: h, n: normalizeKey(h) }));
  const normalizedCandidates = candidates.map((c) => normalizeKey(c));

  for (const cand of normalizedCandidates) {
    const hit = normalizedHeaders.find((h) => h.n === cand);
    if (hit) return hit.original;
  }
  for (const cand of normalizedCandidates) {
    const hit = normalizedHeaders.find((h) => h.n.includes(cand) || cand.includes(h.n));
    if (hit) return hit.original;
  }
  return null;
}

/**
 * Parse date from "DD/MM/YYYY HH:MM:SS" or "DD/MM/YYYY" format
 */
function parseBrazilianDate(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // Try DD/MM/YYYY...
  const match = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Try YYYY-MM-DD (already ISO)
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // Excel serial number
  const num = Number(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export async function parseChecklistFacilFile(file: File): Promise<ChecklistFacilParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (!rows.length) {
    return { rows: [], detectedDate: null, detectedUnit: null, totalRows: 0, skippedRows: 0 };
  }

  const headers = Object.keys(rows[0]);

  const colItem = findColumnByKey(headers, [
    "Item",
    "Nome do item",
    "Pergunta",
    "Pergunta do item",
    "Descrição do item",
  ]) || headers[0];

  const colResposta = findColumnByKey(headers, [
    "Resposta",
    "Quantidade",
    "Qtd",
    "Valor",
  ]);

  const colDate = findColumnByKey(headers, [
    "Data de sincronização",
    "Data de sincronizacao",
    "Data sincronização",
    "Data",
    "Data Checklist",
  ]);

  const colUnit = findColumnByKey(headers, [
    "Unidade",
    "Loja",
    "Filial",
    "Local",
  ]);

  const parsedRows: ChecklistFacilRow[] = [];
  let detectedDate: string | null = null;
  let detectedUnit: string | null = null;
  let skippedRows = 0;

  for (const row of rows) {
    const itemRaw = String(row[colItem] ?? "").trim();
    if (!itemRaw) {
      skippedRows++;
      continue;
    }

    // Parse quantity
    const rawQty = colResposta ? String(row[colResposta] ?? "").trim() : "";
    const quantidade = parseFloat(rawQty.replace(",", "."));
    if (isNaN(quantidade)) {
      skippedRows++;
      continue;
    }

    // Detect date from first valid row
    if (!detectedDate && colDate) {
      detectedDate = parseBrazilianDate(row[colDate]);
    }

    // Detect unit from first valid row
    if (!detectedUnit && colUnit) {
      const unitRaw = String(row[colUnit] ?? "").trim();
      if (unitRaw) detectedUnit = unitRaw;
    }

    parsedRows.push({
      itemName: itemRaw,
      quantidade,
      rawQuantidade: rawQty,
    });
  }

  return {
    rows: parsedRows,
    detectedDate,
    detectedUnit,
    totalRows: rows.length,
    skippedRows,
  };
}
