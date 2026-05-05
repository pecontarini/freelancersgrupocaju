import * as XLSX from "xlsx";

type Cell = string | number | null;
type Grid = Cell[][];

export function sheetToGrid(wb: XLSX.WorkBook, sheetName?: string): Grid {
  const name = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as Grid;
}

function findSheet(wb: XLSX.WorkBook, candidates: string[]): string {
  for (const c of candidates) {
    const hit = wb.SheetNames.find((n) => n.toLowerCase().trim() === c.toLowerCase().trim());
    if (hit) return hit;
  }
  // partial match
  for (const c of candidates) {
    const hit = wb.SheetNames.find((n) => n.toLowerCase().includes(c.toLowerCase()));
    if (hit) return hit;
  }
  return wb.SheetNames[0];
}

export function toNum(v: Cell): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace("%", "").replace("R$", "").replace(/\s/g, "").trim();
  // se tem vírgula como decimal
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

export function toStr(v: Cell): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function rowHas(row: Cell[], needle: string): boolean {
  return row.some((c) => toStr(c).toUpperCase().includes(needle.toUpperCase()));
}

// ============================================================
// Parser 1 — Ranking de Supervisores (Checklist)
// ============================================================
export interface SupervisoresRanking {
  geral: { periodo: string; itens: { posicao: number; unidade: string; media: number }[] };
  gerenteBack: { periodo: string; itens: { posicao: number; unidade: string; media: number }[] };
  gerenteFront: { periodo: string; itens: { posicao: number; unidade: string; media: number }[] };
}

export function parseSupervisoresRanking(wb: XLSX.WorkBook) {
  const sheet = findSheet(wb, ["GERAL E GERENTES", "GERAL", "RANKING"]);
  const grid = sheetToGrid(wb, sheet);

  const result: SupervisoresRanking = {
    geral: { periodo: "", itens: [] },
    gerenteBack: { periodo: "", itens: [] },
    gerenteFront: { periodo: "", itens: [] },
  };

  let section: keyof SupervisoresRanking | null = null;
  let currentPeriodo = "";

  for (const row of grid) {
    if (!row || row.length === 0) continue;
    const joined = row.map(toStr).join(" | ").toUpperCase();

    // Detectar período
    const periodoMatch = joined.match(/PER[ÍI]ODO[:\s]+([^|]+)/);
    if (periodoMatch) {
      currentPeriodo = periodoMatch[1].trim();
      if (section) result[section].periodo = currentPeriodo;
    }

    // Detectar seção
    if (/GERENTE\s+BACK/.test(joined)) {
      section = "gerenteBack";
      result.gerenteBack.periodo = currentPeriodo;
      continue;
    }
    if (/GERENTE\s+FRONT/.test(joined)) {
      section = "gerenteFront";
      result.gerenteFront.periodo = currentPeriodo;
      continue;
    }
    if (/\bGERAL\b/.test(joined) && !/BACK|FRONT/.test(joined)) {
      section = "geral";
      result.geral.periodo = currentPeriodo;
      continue;
    }

    if (!section) continue;

    // Linhas de ranking: posição (col C) + unidade (D) + media (E)
    const posCell = toStr(row[2]);
    const unidade = toStr(row[3]);
    const media = toNum(row[4]);
    const isRankRow = (/º|°|^\d+$/.test(posCell)) && unidade && unidade.length > 1;
    if (isRankRow) {
      const posicao = parseInt(posCell.replace(/[^\d]/g, ""), 10) || result[section].itens.length + 1;
      result[section].itens.push({ posicao, unidade, media });
    }
  }

  const linhas =
    result.geral.itens.length + result.gerenteBack.itens.length + result.gerenteFront.itens.length;
  return { dados: result, linhas };
}

// ============================================================
// Parser 2 — NPS (Atendimento × Delivery)
// ============================================================
export interface NpsData {
  atendimento: { restaurante: string; media: number; totalAvaliacoes: number }[];
  delivery: { restaurante: string; media: number; totalAvaliacoes: number }[];
}

export function parseNpsAtendimento(wb: XLSX.WorkBook) {
  const sheet = findSheet(wb, ["BASE dados", "BASE", "NPS"]);
  const grid = sheetToGrid(wb, sheet);
  if (grid.length < 2) return { dados: { atendimento: [], delivery: [] } as NpsData, linhas: 0 };

  const header = grid[0].map(toStr);
  // Detectar offsets de grupos (cada grupo: Plataforma, Restaurante, Nota, Quantidade)
  const offsets: number[] = [];
  header.forEach((cell, idx) => {
    if (/^plataforma$/i.test(cell.trim())) offsets.push(idx);
  });
  if (offsets.length === 0) offsets.push(0, 4, 8, 12);

  const atendimento = new Map<string, { soma: number; total: number }>();
  const delivery = new Map<string, { soma: number; total: number }>();

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    for (const off of offsets) {
      const plataforma = toStr(row[off]).toLowerCase();
      const restaurante = toStr(row[off + 1]);
      const nota = toNum(row[off + 2]);
      const qtd = toNum(row[off + 3]);
      if (!plataforma || !restaurante || qtd <= 0) continue;

      const isDelivery = plataforma.includes("ifood");
      const isAtend = plataforma.includes("google") || plataforma.includes("trip");
      if (!isDelivery && !isAtend) continue;

      const map = isDelivery ? delivery : atendimento;
      const cur = map.get(restaurante) ?? { soma: 0, total: 0 };
      cur.soma += nota * qtd;
      cur.total += qtd;
      map.set(restaurante, cur);
    }
  }

  const toArr = (m: Map<string, { soma: number; total: number }>) =>
    Array.from(m.entries())
      .map(([restaurante, v]) => ({
        restaurante,
        media: v.total > 0 ? Math.round((v.soma / v.total) * 1000) / 1000 : 0,
        totalAvaliacoes: v.total,
      }))
      .sort((a, b) => b.media - a.media);

  const dados: NpsData = { atendimento: toArr(atendimento), delivery: toArr(delivery) };
  return { dados, linhas: dados.atendimento.length + dados.delivery.length };
}

// ============================================================
// Parser 3 — Avaliações 1-3 / Faturamento
// ============================================================
export interface AvalFatRow {
  loja: string;
  aval13: number;
  totalAval: number;
  pct: number;
  fatTotal: number;
  rsPorAval: number;
}
export interface AvalFatData {
  periodo: string;
  salao: AvalFatRow[];
  delivery: AvalFatRow[];
}

export function parseAvaliacoesFaturamento(wb: XLSX.WorkBook) {
  const grid = sheetToGrid(wb, wb.SheetNames[0]);
  const dados: AvalFatData = { periodo: "", salao: [], delivery: [] };
  if (grid.length < 4) return { dados, linhas: 0 };

  // tentar extrair período da linha 0 ou 1
  for (let i = 0; i < Math.min(3, grid.length); i++) {
    const j = grid[i].map(toStr).join(" ");
    const m = j.match(/(\d{2}\/\d{2}\/\d{4}.*?\d{2}\/\d{2}\/\d{4})|([A-ZÇÃ]+\s+\d{4})/i);
    if (m) {
      dados.periodo = m[0];
      break;
    }
  }

  // achar a linha de cabeçalho que tem "Loja"
  let headerRow = -1;
  for (let i = 0; i < Math.min(6, grid.length); i++) {
    const lojas = grid[i]
      .map((c, idx) => ({ idx, v: toStr(c) }))
      .filter((x) => /^loja$/i.test(x.v));
    if (lojas.length >= 1) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return { dados, linhas: 0 };

  const lojaIdx = grid[headerRow]
    .map((c, idx) => ({ idx, v: toStr(c) }))
    .filter((x) => /^loja$/i.test(x.v))
    .map((x) => x.idx);

  const salaoStart = lojaIdx[0];
  const deliveryStart = lojaIdx[1] ?? -1;

  const readBlock = (start: number): AvalFatRow[] => {
    const out: AvalFatRow[] = [];
    for (let r = headerRow + 1; r < grid.length; r++) {
      const loja = toStr(grid[r][start]);
      if (!loja) break;
      if (/total/i.test(loja)) continue;
      out.push({
        loja,
        aval13: toNum(grid[r][start + 1]),
        totalAval: toNum(grid[r][start + 2]),
        pct: toNum(grid[r][start + 3]),
        fatTotal: toNum(grid[r][start + 4]),
        rsPorAval: toNum(grid[r][start + 5]),
      });
    }
    return out;
  };

  dados.salao = readBlock(salaoStart);
  if (deliveryStart >= 0) dados.delivery = readBlock(deliveryStart);

  return { dados, linhas: dados.salao.length + dados.delivery.length };
}

// ============================================================
// Parser 4 — KDS Target Preto
// ============================================================
export interface KdsCategoria {
  categoria: string;
  totalPratos: number;
  qtnTarget: number;
  pct: number;
}
export interface KdsLoja {
  loja: string;
  totalGeral: { totalPratos: number; qtnTarget: number; pct: number };
  categorias: KdsCategoria[];
}
export interface KdsData {
  dataAtualizacao: string;
  lojas: KdsLoja[];
}

export function parseKdsTargetPreto(wb: XLSX.WorkBook) {
  const sheet = findSheet(wb, ["Salão", "Salao", "KDS"]);
  const grid = sheetToGrid(wb, sheet);
  const dados: KdsData = { dataAtualizacao: "", lojas: [] };

  if (grid.length === 0) return { dados, linhas: 0 };

  // Linha 0 — data
  const linha0 = grid[0].map(toStr).join(" ");
  const dm = linha0.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dm) dados.dataAtualizacao = dm[1];

  let currentLoja: KdsLoja | null = null;

  for (let r = 3; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    const loja = toStr(row[0]);
    const categoria = toStr(row[1]);
    const totalPratos = toNum(row[2]);
    const qtnTarget = toNum(row[3]);
    const pct = toNum(row[4]);

    if (loja && (!currentLoja || currentLoja.loja !== loja)) {
      currentLoja = { loja, totalGeral: { totalPratos: 0, qtnTarget: 0, pct: 0 }, categorias: [] };
      dados.lojas.push(currentLoja);
    }

    if (!currentLoja) continue;

    if (/total\s*geral/i.test(categoria)) {
      currentLoja.totalGeral = { totalPratos, qtnTarget, pct };
    } else if (categoria) {
      currentLoja.categorias.push({ categoria, totalPratos, qtnTarget, pct });
    }
  }

  return { dados, linhas: dados.lojas.length };
}

// ============================================================
// Parser 5 — Base de Avaliações (Reclamações)
// ============================================================
export interface AvaliacaoItem {
  loja: string;
  data: string;
  diaSemana: string;
  nota: number;
  autor: string;
  comentario: string;
}
export interface BaseAvaliacoesData {
  totalLinhas: number;
  avaliacoes: AvaliacaoItem[];
}

export function parseBaseAvaliacoes(wb: XLSX.WorkBook) {
  const sheet = findSheet(wb, ["Consolidado", "Google", "BASE", "Avaliações", "Avaliacoes"]);
  const grid = sheetToGrid(wb, sheet);
  const dados: BaseAvaliacoesData = { totalLinhas: 0, avaliacoes: [] };
  if (grid.length < 2) return { dados, linhas: 0 };

  // Detectar header
  let headerRow = 0;
  for (let i = 0; i < Math.min(5, grid.length); i++) {
    if (rowHas(grid[i], "loja") && rowHas(grid[i], "nota")) {
      headerRow = i;
      break;
    }
  }

  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    const loja = toStr(row[0]);
    if (!loja) continue;
    const dataCell = row[1];
    let dataStr = "";
    if (typeof dataCell === "number") {
      // serial date Excel
      const d = XLSX.SSF.parse_date_code(dataCell);
      if (d) dataStr = `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
    } else {
      dataStr = toStr(dataCell);
    }
    dados.avaliacoes.push({
      loja,
      data: dataStr,
      diaSemana: toStr(row[2]),
      nota: toNum(row[3]),
      autor: toStr(row[4]),
      comentario: toStr(row[5]),
    });
  }
  dados.totalLinhas = dados.avaliacoes.length;
  return { dados, linhas: dados.totalLinhas };
}

// ============================================================
// Mapa de parsers e labels
// ============================================================
export const INDICADOR_LABELS: Record<string, string> = {
  "ranking-supervisores": "Ranking Supervisores (Checklist)",
  nps: "NPS — Notas de Atendimento",
  "atendimento-medias": "Avaliações 1-3 / Faturamento",
  "kds-target-preto": "KDS — Target Preto",
  reclamacoes: "Base de Avaliações / Comentários",
};

export const PARSERS: Record<
  string,
  (wb: XLSX.WorkBook) => { dados: any; linhas: number }
> = {
  "ranking-supervisores": parseSupervisoresRanking,
  nps: parseNpsAtendimento,
  "atendimento-medias": parseAvaliacoesFaturamento,
  "kds-target-preto": parseKdsTargetPreto,
  reclamacoes: parseBaseAvaliacoes,
};

const MES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function formatReferenciaLabel(referenciaMes: string): string {
  const [y, m] = referenciaMes.split("-");
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return referenciaMes;
  return `${MES_PT[idx]} ${y}`;
}

export function formatReferenciaShort(referenciaMes: string): string {
  const short = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [y, m] = referenciaMes.split("-");
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return referenciaMes;
  return `${short[idx]} ${y}`;
}
