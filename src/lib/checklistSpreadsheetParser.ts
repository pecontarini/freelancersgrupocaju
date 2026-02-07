import * as XLSX from "xlsx";

export interface ExtractedFailure {
  item_name: string;
  category: string | null;
  detalhes_falha?: string | null;
  url_foto_evidencia?: string | null;
}

export interface ExtractedAuditData {
  global_score: number | null;
  audit_date: string | null;
  unit_name: string | null;
  failures: ExtractedFailure[];
}

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const normalizedHeaders = headers.map((h) => ({ original: h, n: normalizeKey(h) }));
  const normalizedCandidates = candidates.map((c) => normalizeKey(c));

  // 1) exact match
  for (const cand of normalizedCandidates) {
    const hit = normalizedHeaders.find((h) => h.n === cand);
    if (hit) return hit.original;
  }

  // 2) contains match
  for (const cand of normalizedCandidates) {
    const hit = normalizedHeaders.find((h) => h.n.includes(cand) || cand.includes(h.n));
    if (hit) return hit.original;
  }

  return null;
}

export function extractFirstUrl(text: unknown): string | null {
  if (!text) return null;
  const s = String(text);
  const match = s.match(/https?:\/\/[^\s)\]}>"']+/i);
  return match?.[0] ?? null;
}

function splitTrailingParenthesis(text: string): { base: string; tail: string | null } {
  // Example: "Pergunta? (Gordura acumulada...)" -> base:"Pergunta?" tail:"Gordura..."
  const m = text.match(/^(.*?)(?:\s*\(([^)]+)\)\s*)$/);
  if (!m) return { base: text.trim(), tail: null };
  const base = m[1].trim();
  const tail = (m[2] || "").trim();
  if (!base) return { base: text.trim(), tail: tail || null };
  return { base, tail: tail || null };
}

export function normalizeExtractedFailures(failures: ExtractedFailure[]): ExtractedFailure[] {
  return failures
    .map((f) => {
      const rawName = (f.item_name || "").trim();
      const { base, tail } = splitTrailingParenthesis(rawName);

      const detalhesFromName = tail;
      const detalhes = (f.detalhes_falha ?? null) || detalhesFromName;

      const url =
        (f.url_foto_evidencia ?? null) ||
        extractFirstUrl(f.url_foto_evidencia) ||
        extractFirstUrl(detalhes) ||
        extractFirstUrl(rawName);

      return {
        ...f,
        item_name: base || rawName,
        detalhes_falha: detalhes ? detalhes.trim() : null,
        url_foto_evidencia: url,
      };
    })
    .filter((f) => !!f.item_name);
}

function normalizeStatus(value: unknown): string {
  return normalizeKey(String(value ?? ""));
}

function isNonConforming(status: string): boolean {
  const s = status;
  if (!s) return false;

  // Not applicable
  if (s.includes("nao se aplica") || s === "na" || s === "n/a") return false;

  // Conforming
  if (s.includes("conforme") || s === "sim" || s === "ok") return false;

  // Non conforming
  if (s.includes("nao conforme") || s === "nc" || s.includes("reprov")) return true;

  return false;
}

export async function parseChecklistSpreadsheet(file: File): Promise<ExtractedAuditData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (!rows.length) {
    return { global_score: null, audit_date: null, unit_name: null, failures: [] };
  }

  const headers = Object.keys(rows[0]);

  const colItem =
    findColumn(headers, [
      "Item",
      "Nome do item",
      "Pergunta",
      "Pergunta do item",
      "Descrição do item",
      "Descricao do item",
      "Item do checklist",
    ]) || headers[0];

  const colStatus =
    findColumn(headers, ["Status", "Resposta", "Resultado", "Conformidade"]) || null;

  const colComment =
    findColumn(headers, [
      "Comentário do item",
      "Comentario do item",
      "Comentário",
      "Comentario",
      "Observação",
      "Observacao",
    ]) || null;

  const colImages =
    findColumn(headers, ["Imagens", "Fotos", "Evidências", "Evidencias", "Evidência", "Evidencia"]) || null;

  const colCategory =
    findColumn(headers, ["Categoria", "Área", "Area", "Setor", "Seção", "Secao"]) || null;

  const failures: ExtractedFailure[] = [];

  for (const row of rows) {
    const status = colStatus ? normalizeStatus(row[colStatus]) : "";
    if (colStatus && !isNonConforming(status)) continue;

    const itemRaw = String(row[colItem] ?? "").trim();
    if (!itemRaw) continue;

    const detalhes = colComment ? String(row[colComment] ?? "").trim() : "";
    const url = colImages ? extractFirstUrl(row[colImages]) : null;
    const category = colCategory ? String(row[colCategory] ?? "").trim() : "";

    failures.push({
      item_name: itemRaw,
      category: category || null,
      detalhes_falha: detalhes || null,
      url_foto_evidencia: url,
    });
  }

  return {
    global_score: null,
    audit_date: null,
    unit_name: null,
    failures: normalizeExtractedFailures(failures),
  };
}
