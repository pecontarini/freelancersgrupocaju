// Parser determinístico para a planilha "Escala Mínima" do CajuPAR.
// Não usa IA — lê a estrutura do Excel diretamente:
//
//   linha N   → SETOR (texto único, ex.: "GARÇOM", "CUMINS NAZO", "SUSHI NAZO")
//   linha N+1 → "TURNO | SEGUNDA | TERÇA | QUARTA | QUINTA | SEXTA | SÁBADO | DOMINGO | ..."
//   linha N+2 → "ALMOÇO | n | n | n | n | n | n | n | ..."
//   linha N+3 → "JANTAR | n | n | n | n | n | n | n | ..."
//
// Suporta notação X+Y nas células (X = required_count, Y = extras_count).
// Suporta abas compostas (multi-marca dentro da mesma aba): cada bloco é
// rotulado pela "marca atual" detectada pelo cabeçalho do bloco.

import type { SectorKey } from "@/lib/holding/sectors";

const DAY_HEADER_TO_DOW: Record<string, number> = {
  DOMINGO: 0,
  SEGUNDA: 1,
  TERCA: 2,
  TERÇA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
  SÁBADO: 6,
};

export type ShiftLabel = "almoco" | "jantar";

export interface ParsedCell {
  day_of_week: number;
  shift_type: ShiftLabel;
  required_count: number;
  extras_count: number;
  raw: string;
}

export type BlockMarker = "caminito" | "nazo" | "neutro";

export interface ParsedBlock {
  /** Texto bruto do cabeçalho do bloco (ex.: "GARÇOM", "SUSHI NAZO"). */
  rawSectorLabel: string;
  /** sector_key normalizado, ou null se não reconhecido. */
  sectorKey: SectorKey | null;
  /** Marca explícita do bloco quando a aba é composta. */
  marker: BlockMarker;
  /** Linhas no Excel onde os dados foram encontrados (1-indexed). */
  startRow: number;
  /** Células lidas (almoço + jantar × 7 dias). */
  cells: ParsedCell[];
  /** Avisos não-bloqueantes desse bloco. */
  warnings: string[];
}

export interface ParsedSheet {
  sheetName: string;
  /** Header explícito da loja (linha 1) quando existir. */
  storeHeader: string | null;
  blocks: ParsedBlock[];
  warnings: string[];
}

export interface ParseResult {
  sheets: ParsedSheet[];
  totalCells: number;
  totalBlocks: number;
}

// ----------------------------------------------------------------------------
// Normalização

function norm(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isShiftAlmoco(text: string): boolean {
  const n = norm(text);
  return n === "ALMOCO" || n === "MANHA";
}
function isShiftJantar(text: string): boolean {
  const n = norm(text);
  return n === "JANTAR" || n === "TARDE" || n === "NOITE";
}
function isTurnoHeader(text: string): boolean {
  return norm(text) === "TURNO";
}

// Setores: mapa robusto. Cada entrada = lista de palavras-chave que precisam
// estar TODAS presentes (AND), ou prefixos.
const SECTOR_RULES: Array<{
  key: SectorKey;
  marker: BlockMarker;
  match: (n: string) => boolean;
}> = [
  // Sushi (Nazo)
  { key: "sushi", marker: "nazo", match: (n) => /\bSUSHI\b/.test(n) },
  // Chefe / subchefe (sem garçom — quando tem garçom junto, vira garcom para não duplicar)
  {
    key: "chefe_subchefe_salao",
    marker: "neutro",
    match: (n) =>
      (/\bCHEFE\b/.test(n) || /\bSUBCHEFE\b/.test(n)) && !/\bGARCO/.test(n),
  },
  // Atendimento/Garçom (inclui composições "GARÇOM + CHEFIAS", "ATENDIMENTO CAMINITO/NAZO")
  {
    key: "garcom",
    marker: "neutro",
    match: (n) =>
      /\bGARCOM\b/.test(n) ||
      /\bGARCONS\b/.test(n) ||
      /\bATENDIMENTO\b/.test(n) ||
      (/\bCHEFE\b/.test(n) && /\bGARCO/.test(n)) ||
      (/\bSUB\b/.test(n) && /\bSALAO\b/.test(n) && /\bGARCO/.test(n)),
  },
  // Cumin
  { key: "cumin", marker: "neutro", match: (n) => /\bCUMIN/.test(n) },
  // Hostess / Monitora
  {
    key: "hostess",
    marker: "neutro",
    match: (n) => /\bHOSTESS\b/.test(n) || /\bMONITORA\b/.test(n),
  },
  // Caixa/Delivery
  {
    key: "caixa_delivery",
    marker: "neutro",
    match: (n) =>
      /\bCAIXA\b/.test(n) || /\bDELIVERY\b/.test(n) || /\bRECEPCAO\b/.test(n),
  },
  // Parrilla
  { key: "parrilla", marker: "caminito", match: (n) => /\bPARRILLA\b/.test(n) && !/\bCAMINITO PARRILLA\b/.test(n.replace(/\s+/g, " ")) || n === "PARRILLA" },
  // Cozinha
  { key: "cozinha", marker: "neutro", match: (n) => /\bCOZINHA\b/.test(n) || /\bCOPA\b/.test(n) },
  // Bar
  { key: "bar", marker: "neutro", match: (n) => /^BAR\b/.test(n) || n === "BAR" },
  // Serviços gerais / ASG
  {
    key: "servicos_gerais_salao_bar",
    marker: "neutro",
    match: (n) =>
      /\bSERVICO/.test(n) && /\bGERA/.test(n) ||
      /\bSERVICOS GERAIS\b/.test(n) ||
      /\bASG\b/.test(n),
  },
  // Produção
  { key: "producao", marker: "neutro", match: (n) => /\bPRODUCAO\b/.test(n) },
];

function detectSector(rawLabel: string): { key: SectorKey | null; marker: BlockMarker } {
  const n = norm(rawLabel);
  if (!n) return { key: null, marker: "neutro" };

  // Marca embutida no rótulo do bloco (afeta abas compostas)
  let blockMarker: BlockMarker = "neutro";
  if (/\bNAZO\b/.test(n)) blockMarker = "nazo";
  else if (/\bCAMINITO\b/.test(n)) blockMarker = "caminito";

  for (const rule of SECTOR_RULES) {
    if (rule.match(n)) {
      // marker do setor (ex.: sushi=nazo, parrilla=caminito) só vence quando
      // o rótulo NÃO declarou marca explicitamente
      const marker = blockMarker !== "neutro" ? blockMarker : rule.marker;
      return { key: rule.key, marker };
    }
  }
  return { key: null, marker: blockMarker };
}

// ----------------------------------------------------------------------------
// Parsing de células

const NUMERIC_CELL_RE = /^\s*(\d+)\s*(?:\+\s*(\d+))?\s*$/;

function parseCount(raw: unknown): { required: number; extras: number } | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(NUMERIC_CELL_RE);
  if (!m) return null;
  const required = Number(m[1]);
  const extras = m[2] ? Number(m[2]) : 0;
  if (!Number.isFinite(required) || !Number.isFinite(extras)) return null;
  return { required, extras };
}

// ----------------------------------------------------------------------------
// Leitura via xlsx

interface RawSheet {
  name: string;
  rows: any[][];
}

async function readWorkbook(file: File): Promise<RawSheet[]> {
  const XLSX: any = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: RawSheet[] = [];
  for (const name of wb.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      defval: "",
      blankrows: false,
      raw: true,
    });
    out.push({ name, rows });
  }
  return out;
}

function findTurnoHeaderColumns(row: any[]): Map<number, number> | null {
  // retorna mapa: colIndex (do dia no Excel) → day_of_week (0..6)
  // exige que tenha pelo menos 5 dias da semana mapeados
  const map = new Map<number, number>();
  let foundTurno = false;
  for (let c = 0; c < row.length; c++) {
    const cell = norm(row[c]);
    if (!cell) continue;
    if (!foundTurno && cell === "TURNO") {
      foundTurno = true;
      continue;
    }
    if (foundTurno) {
      const dow = DAY_HEADER_TO_DOW[cell];
      if (dow !== undefined) map.set(c, dow);
    }
  }
  return map.size >= 5 ? map : null;
}

function parseSheet(raw: RawSheet): ParsedSheet {
  const blocks: ParsedBlock[] = [];
  const warnings: string[] = [];
  const rows = raw.rows;

  // Header opcional da loja (linha 1)
  let storeHeader: string | null = null;
  for (let r = 0; r < Math.min(rows.length, 3); r++) {
    const v = String(rows[r]?.[0] ?? "").trim();
    if (v && !isTurnoHeader(v) && !isShiftAlmoco(v) && !isShiftJantar(v)) {
      storeHeader = v;
      break;
    }
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const next = rows[r + 1] ?? [];

    // candidato a "linha de setor": só tem texto na primeira coluna,
    // demais colunas vazias OU número de pessoas necessárias/dobras (ignorado).
    const labelCell = String(row[0] ?? "").trim();
    if (!labelCell) continue;
    if (isTurnoHeader(labelCell)) continue;
    if (isShiftAlmoco(labelCell) || isShiftJantar(labelCell)) continue;

    // a próxima linha precisa ser o cabeçalho TURNO|SEGUNDA|...
    if (!isTurnoHeader(String(next[0] ?? ""))) continue;
    const dayCols = findTurnoHeaderColumns(next);
    if (!dayCols) continue;

    // procura linhas ALMOÇO/JANTAR depois do header
    const cells: ParsedCell[] = [];
    const blockWarnings: string[] = [];
    for (let k = 2; k <= 4; k++) {
      const dataRow = rows[r + k];
      if (!dataRow) break;
      const head = String(dataRow[0] ?? "").trim();
      const isA = isShiftAlmoco(head);
      const isJ = isShiftJantar(head);
      if (!isA && !isJ) break;
      const shift: ShiftLabel = isA ? "almoco" : "jantar";
      for (const [colIdx, dow] of dayCols.entries()) {
        const parsed = parseCount(dataRow[colIdx]);
        if (!parsed) continue;
        cells.push({
          day_of_week: dow,
          shift_type: shift,
          required_count: parsed.required,
          extras_count: parsed.extras,
          raw: String(dataRow[colIdx]).trim(),
        });
      }
    }

    if (cells.length === 0) continue;

    const { key, marker } = detectSector(labelCell);
    if (!key) {
      blockWarnings.push(`Setor não reconhecido: "${labelCell}".`);
    }

    blocks.push({
      rawSectorLabel: labelCell,
      sectorKey: key,
      marker,
      startRow: r + 1,
      cells,
      warnings: blockWarnings,
    });

    // pula até depois das linhas de turno consumidas
    r = r + 3;
  }

  if (blocks.length === 0) {
    warnings.push("Nenhum bloco de setor reconhecido nesta aba.");
  }

  return { sheetName: raw.name, storeHeader, blocks, warnings };
}

export async function parseMinimumScaleWorkbook(file: File): Promise<ParseResult> {
  const sheets = await readWorkbook(file);
  const parsed = sheets.map(parseSheet);
  const totalBlocks = parsed.reduce((s, x) => s + x.blocks.length, 0);
  const totalCells = parsed.reduce(
    (s, x) => s + x.blocks.reduce((sb, b) => sb + b.cells.length, 0),
    0,
  );
  return { sheets: parsed, totalCells, totalBlocks };
}
