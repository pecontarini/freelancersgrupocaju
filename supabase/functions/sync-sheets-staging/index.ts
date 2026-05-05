import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  sourceId: string;
  url?: string;
  referenciaMes?: string;
}

// ============================================================
// CSV utilities
// ============================================================
function parseCSV(csv: string): string[][] {
  const lines = csv.split(/\r?\n/);
  const out: string[][] = [];
  for (const line of lines) {
    if (!line.length) { out.push([]); continue; }
    const row: string[] = [];
    let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { row.push(cur); cur = ''; }
      else cur += c;
    }
    row.push(cur);
    out.push(row.map(s => s.trim()));
  }
  return out;
}

/** Parse "12,5" / "12.5" / "12,5%" / "1.234,56" → number. */
function parseNum(v: string | undefined | null): number | null {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (!s || s === '-' || s === '—') return null;
  s = s.replace(/%/g, '').replace(/R\$/gi, '').replace(/\s/g, '');
  // Handle "1.234,56" (BR) vs "1,234.56" (US)
  if (s.includes(',') && s.includes('.')) {
    // assume "." is thousand sep, "," is decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normTxt(s: string): string {
  return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const UNIT_ALIAS: Record<string, string> = {
  'CP AN': 'CP_AN', 'CPAN': 'CP_AN', 'CAMINITO ASA NORTE': 'CP_AN', 'CAMINITO NORTE': 'CP_AN',
  'CP AS': 'CP_AS', 'CPAS': 'CP_AS', 'CAMINITO ASA SUL': 'CP_AS', 'CAMINITO SUL': 'CP_AS',
  'CP AC': 'CP_AC', 'CPAC': 'CP_AC', 'CAMINITO AGUAS CLARAS': 'CP_AC', 'CAMINITO PARRILLA AGUAS CLARAS': 'CP_AC',
  'CP SG': 'CP_SG', 'CPSG': 'CP_SG', 'CAMINITO SIG': 'CP_SG', 'CAMINITO SUDOESTE': 'CP_SG', 'CAMINITO PARRILLA SUDOESTE': 'CP_SG',
  'NZ AS': 'NZ_AS', 'NZAS': 'NZ_AS', 'NAZO ASA SUL': 'NZ_AS',
  'NZ AC': 'NZ_AC', 'NZAC': 'NZ_AC', 'NAZO AGUAS CLARAS': 'NZ_AC', 'NAZO JAPANESE FOOD AGUAS CLARAS': 'NZ_AC',
  'NZ SG': 'NZ_SG', 'NZSG': 'NZ_SG', 'NAZO SIG': 'NZ_SG', 'NAZO SUDOESTE': 'NZ_SG', 'NAZO JAPANESE FOOD SUDOESTE': 'NZ_SG',
  'NZ GO': 'NZ_GO', 'NZGO': 'NZ_GO', 'NAZO GO': 'NZ_GO', 'NAZO GOIANIA': 'NZ_GO',
  'CJ AN': 'CJ_AN', 'CJAN': 'CJ_AN', 'CAJU ASA NORTE': 'CJ_AN',
  'CJ SG': 'CJ_SG', 'CJSG': 'CJ_SG', 'CAJU SIG': 'CJ_SG', 'CAJU SUDOESTE': 'CJ_SG',
  // For salmao sheet (just neighborhood names; assume Nazo)
  'AGUAS CLARAS': 'NZ_AC',
  'SIG': 'NZ_SG',
  'ASA SUL': 'NZ_AS',
  'GOIANIA': 'NZ_GO',
};

// Mapa Depara dinâmico (preenchido por sincronização a partir da aba "Depara")
let DEPARA_MAP: Record<string, string> = {};

function matchLojaCodigo(raw: string): string | null {
  const n = normTxt(raw);
  if (!n) return null;
  // 1) Depara da planilha (case-insensitive, sem acento)
  const deparaHit = DEPARA_MAP[n] ?? DEPARA_MAP[(raw || '').trim().toLowerCase()];
  if (deparaHit) return deparaHit;
  if (UNIT_ALIAS[n]) return UNIT_ALIAS[n];
  const sorted = Object.keys(UNIT_ALIAS).sort((a, b) => b.length - a.length);
  for (const alias of sorted) {
    if (n.includes(alias)) return UNIT_ALIAS[alias];
  }
  return null;
}

// ============================================================
// Google Sheets — gviz/tq helpers
// ============================================================
function extractSheetParams(url: string): { sheetId: string; gid: string | null; sheetName: string | null } {
  const idMatch = (url || '').match(/\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = (url || '').match(/[#&?]gid=(\d+)/);
  const sheetMatch = (url || '').match(/[#&?]sheet=([^&]+)/);
  return {
    sheetId: idMatch?.[1] ?? '',
    gid: gidMatch?.[1] ?? null,
    sheetName: sheetMatch ? decodeURIComponent(sheetMatch[1]) : null,
  };
}

function buildGvizUrl(sheetId: string, gidOrName: string | null): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
  if (!gidOrName) return base;
  return isNaN(Number(gidOrName))
    ? `${base}&sheet=${encodeURIComponent(gidOrName)}`
    : `${base}&gid=${gidOrName}`;
}

async function fetchGvizGrid(url: string): Promise<string[][]> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ao buscar planilha`);
  const text = await resp.text();
  const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
  if (!m) throw new Error('Formato gviz inesperado — planilha pode estar privada ou com link inválido.');
  const json = JSON.parse(m[1]);
  if (!json?.table) throw new Error('Resposta gviz sem tabela.');
  const cols = (json.table.cols || []) as Array<{ label?: string }>;
  const rows = (json.table.rows || []) as Array<{ c: Array<{ v: unknown; f?: string } | null> }>;
  const header = cols.map(c => (c?.label ?? '').toString());
  const body = rows.map(r =>
    (r.c || []).map(cell => (cell?.f ?? (cell?.v == null ? '' : String(cell.v))))
  );
  return [header, ...body];
}

function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeSheetsUrl(raw: string): string | null {
  if (!raw) return null;
  const { sheetId, gid } = extractSheetParams(raw.trim());
  if (!sheetId) return null;
  return buildGvizUrl(sheetId, gid);
}

function parseDateBR(s: string): string | null {
  const m = (s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// ============================================================
// PARSERS — retornam { rows: MetaRow[], blocks: Block[] }
// ============================================================
type MetaRow = { loja_codigo: string; valor: number };
type Block = {
  block_key: string;
  block_type: 'ranking' | 'matrix' | 'series' | 'distribution' | 'item_table' | 'kpi_strip';
  loja_codigo?: string | null;
  payload: Record<string, unknown>;
  ordem?: number;
};
type ParseResult = { rows: MetaRow[]; blocks: Block[] };

// ──────────────────────────────────────────────────────────────
// 1) CONFORMIDADE — 3 rankings (Geral / Back / Front) empilhados
// ──────────────────────────────────────────────────────────────
function parseConformidade(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];
  type Sec = { key: string; label: string; rank: Array<{ loja: string; valor: number; pos: number }> };
  const sections: Sec[] = [];
  let current: Sec | null = null;

  for (const r of grid) {
    const joined = normTxt(r.join(' '));
    if (!joined) continue;

    let newKey: string | null = null;
    let newLabel: string | null = null;
    if (joined.includes('RANKING') && joined.includes('GERAL')) { newKey = 'geral'; newLabel = 'Ranking Geral'; }
    else if (joined.includes('RANKING') && joined.includes('BACK')) { newKey = 'back'; newLabel = 'Gerente Back'; }
    else if (joined.includes('RANKING') && joined.includes('FRONT')) { newKey = 'front'; newLabel = 'Gerente Front'; }

    if (newKey) {
      if (current) sections.push(current);
      current = { key: newKey, label: newLabel!, rank: [] };
      continue;
    }
    if (!current) continue;

    // Find a "1°" / "2°" pattern then loja then value
    for (let i = 0; i < r.length - 2; i++) {
      if (/^\d{1,2}\s*[°º]/.test(r[i])) {
        const pos = parseInt(r[i], 10);
        const codigo = matchLojaCodigo(r[i + 1]);
        const valor = parseNum(r[i + 2]);
        if (codigo && valor !== null && pos > 0) {
          if (!current.rank.find(x => x.loja === codigo)) {
            current.rank.push({ loja: codigo, valor, pos });
          }
        }
        break;
      }
    }
  }
  if (current) sections.push(current);

  const geral = sections.find(s => s.key === 'geral');
  if (geral) for (const r of geral.rank) rows.push({ loja_codigo: r.loja, valor: r.valor });

  for (const s of sections) {
    if (!s.rank.length) continue;
    blocks.push({
      block_key: `ranking_${s.key}`,
      block_type: 'ranking',
      payload: {
        label: s.label,
        suffix: '%',
        polarity: 'higher',
        items: s.rank.map(r => ({ loja_codigo: r.loja, valor: r.valor, posicao: r.pos })),
      },
      ordem: s.key === 'geral' ? 0 : s.key === 'back' ? 1 : 2,
    });
  }
  return { rows, blocks };
}

// ──────────────────────────────────────────────────────────────
// 2) TARGET PRETO / KDS — 3 blocos lado a lado (Caminito / Nazo / Caju)
//    Cada bloco: Loja | Categoria | Total de Pratos | Qtn Target Preto | %
// ──────────────────────────────────────────────────────────────
function parseTargetPretoKds(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];

  // Encontra todos os "headers" — linhas onde aparecem múltiplas células contendo "Categoria"
  let headerRow = -1;
  const headerCols: number[] = []; // col index where "Loja" starts
  for (let i = 0; i < Math.min(grid.length, 30); i++) {
    const r = grid[i];
    const cats: number[] = [];
    for (let j = 0; j < r.length; j++) {
      if (/categoria/i.test(r[j])) {
        // "Loja" should be at j-1
        cats.push(Math.max(0, j - 1));
      }
    }
    if (cats.length >= 1) { headerRow = i; headerCols.push(...cats); break; }
  }
  if (headerRow < 0) return { rows, blocks };

  // For each block, columns are: lojaCol=col, catCol=col+1, totalCol=col+2, qtnCol=col+3, pctCol=col+4
  type Item = { loja: string; loja_codigo: string; categoria: string; total: number; qtn: number; pct: number };
  const items: Item[] = [];
  const totalGeralByLoja = new Map<string, { loja: string; codigo: string; total: number; qtn: number; pct: number }>();

  for (const col of headerCols) {
    let currentLojaName = '';
    let currentLojaCodigo: string | null = null;
    for (let i = headerRow + 1; i < grid.length; i++) {
      const r = grid[i];
      const lojaCell = r[col] || '';
      const catCell = r[col + 1] || '';
      const totalCell = r[col + 2] || '';
      const qtnCell = r[col + 3] || '';
      const pctCell = r[col + 4] || '';

      // Detecta "Total Geral" row
      if (/total\s*geral/i.test(catCell)) {
        if (currentLojaCodigo) {
          const total = parseNum(totalCell) ?? 0;
          const qtn = parseNum(qtnCell) ?? 0;
          const pct = parseNum(pctCell) ?? 0;
          totalGeralByLoja.set(currentLojaCodigo, { loja: currentLojaName, codigo: currentLojaCodigo, total, qtn, pct });
        }
        continue;
      }

      // Nova loja
      if (lojaCell) {
        const code = matchLojaCodigo(lojaCell);
        if (code) {
          currentLojaName = lojaCell;
          currentLojaCodigo = code;
        }
      }

      if (currentLojaCodigo && catCell) {
        const total = parseNum(totalCell);
        const qtn = parseNum(qtnCell);
        const pct = parseNum(pctCell);
        if (total !== null || qtn !== null || pct !== null) {
          items.push({
            loja: currentLojaName,
            loja_codigo: currentLojaCodigo,
            categoria: catCell,
            total: total ?? 0,
            qtn: qtn ?? 0,
            pct: pct ?? 0,
          });
        }
      }
    }
  }

  // KPI agregado por loja: % do total geral
  for (const [code, g] of totalGeralByLoja) {
    rows.push({ loja_codigo: code, valor: g.pct });
  }

  // Block 1: Ranking Total Geral por loja
  const ranking = Array.from(totalGeralByLoja.values())
    .sort((a, b) => a.pct - b.pct)
    .map((g, idx) => ({ loja_codigo: g.codigo, valor: g.pct, posicao: idx + 1, hint: `${g.qtn}/${g.total}` }));
  if (ranking.length) {
    blocks.push({
      block_key: 'ranking_target_preto',
      block_type: 'ranking',
      payload: { label: 'Target Preto · % por loja', suffix: '%', polarity: 'lower', items: ranking },
      ordem: 0,
    });
  }

  // Block 2: Matrix Categoria × Loja (% Target Preto) — heatmap
  const allCats = Array.from(new Set(items.map(i => i.categoria)));
  const allLojas = Array.from(new Set(items.map(i => i.loja_codigo)));
  if (allCats.length && allLojas.length) {
    const catRows = allCats.map(cat => {
      const valores: Record<string, number | null> = {};
      for (const loja of allLojas) {
        const it = items.find(x => x.categoria === cat && x.loja_codigo === loja);
        valores[loja] = it ? it.pct : null;
      }
      return { categoria: cat, valores };
    });
    blocks.push({
      block_key: 'matrix_categoria_loja',
      block_type: 'matrix',
      payload: {
        label: 'Target Preto por Categoria × Loja',
        lojas: allLojas,
        categorias: catRows,
        suffix: '%',
        polarity: 'lower',  // menor é melhor
        scale: { min: 0, mid: 10, max: 30 },
      },
      ordem: 1,
    });
  }

  // Block 3: Item table
  const tableItems = items
    .sort((a, b) => b.qtn - a.qtn)
    .slice(0, 50)
    .map(i => ({
      Loja: i.loja_codigo,
      Categoria: i.categoria,
      'Total Pratos': i.total,
      'Qtn Target Preto': i.qtn,
      '% Target Preto': i.pct,
    }));
  if (tableItems.length) {
    blocks.push({
      block_key: 'top_categorias',
      block_type: 'item_table',
      payload: {
        label: 'Categorias com mais Target Preto',
        columns: [
          { key: 'Loja', label: 'Loja', type: 'text' },
          { key: 'Categoria', label: 'Categoria', type: 'text' },
          { key: 'Total Pratos', label: 'Total Pratos', type: 'number' },
          { key: 'Qtn Target Preto', label: 'Qtn Target', type: 'number' },
          { key: '% Target Preto', label: '%', type: 'percent' },
        ],
        rows: tableItems,
      },
      ordem: 2,
    });
  }

  return { rows, blocks };
}

// ──────────────────────────────────────────────────────────────
// 3) ATENDIMENTO MÉDIAS (Google+TripAdvisor / iFood)
//    Layout: blocos por loja com nota de cada canal
// ──────────────────────────────────────────────────────────────
function parseAtendimentoMedias(grid: string[][]): ParseResult {
  // O layout real é livre demais — extraímos por busca de pares "Loja → nota"
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];
  // Procura linhas com nome de loja seguidas de nota (1.0–5.0)
  const lojaNotas = new Map<string, { google?: number; trip?: number; ifood?: number }>();

  for (let i = 0; i < grid.length; i++) {
    const r = grid[i];
    for (let j = 0; j < r.length; j++) {
      const code = matchLojaCodigo(r[j]);
      if (!code) continue;
      // Olha próximas células nessa linha e nas próximas 5 procurando notas próximas
      for (let dy = 0; dy <= 5; dy++) {
        const rr = grid[i + dy] || [];
        for (let k = j; k < Math.min(r.length, j + 8); k++) {
          const v = parseNum(rr[k]);
          if (v !== null && v >= 1 && v <= 5) {
            const cur = lojaNotas.get(code) || {};
            // Sem distinguir canal aqui — agregamos como nota geral
            if (cur.google === undefined) cur.google = v;
            else if (cur.trip === undefined) cur.trip = v;
            else if (cur.ifood === undefined) cur.ifood = v;
            lojaNotas.set(code, cur);
          }
        }
      }
    }
  }

  const items: Array<{ loja_codigo: string; valores: Record<string, number | null> }> = [];
  for (const [code, n] of lojaNotas) {
    const vals: Record<string, number | null> = {
      'Google': n.google ?? null,
      'TripAdvisor': n.trip ?? null,
      'iFood': n.ifood ?? null,
    };
    items.push({ loja_codigo: code, valores: vals });
    const arr = [n.google, n.trip, n.ifood].filter((x): x is number => typeof x === 'number');
    if (arr.length) {
      rows.push({ loja_codigo: code, valor: arr.reduce((a, b) => a + b, 0) / arr.length });
    }
  }

  if (items.length) {
    blocks.push({
      block_key: 'medias_canais',
      block_type: 'item_table',
      payload: {
        label: 'Médias por canal',
        canais: ['Google', 'TripAdvisor', 'iFood'],
        items,
      },
      ordem: 0,
    });
    // Ranking média geral
    const ranking = [...rows].sort((a, b) => b.valor - a.valor).map((r, i) => ({
      loja_codigo: r.loja_codigo, valor: r.valor, posicao: i + 1,
    }));
    blocks.push({
      block_key: 'ranking_medias',
      block_type: 'ranking',
      payload: { label: 'Ranking · Média geral', suffix: '★', polarity: 'higher', items: ranking, decimals: 2 },
      ordem: 1,
    });
  }

  return { rows, blocks };
}

// ──────────────────────────────────────────────────────────────
// 4) RECLAMAÇÕES — Distribuição 1-5 por loja, com canais
// ──────────────────────────────────────────────────────────────
function parseReclamacoesDist(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];

  // Header padrão: ", LojaName, iFood, Google, TripAdvisor, Get In, Instagram, Whatsapp, Total, % do Total"
  const channels = ['iFood', 'Google', 'TripAdvisor', 'Get In', 'Instagram', 'Whatsapp'];

  type LojaDist = {
    nome: string;
    codigo: string;
    counts: Record<string, number>; // "1"..."5" → total
    porCanal: Record<string, Record<string, number>>; // canal → { "1":n, ... }
    total: number;
  };
  const lojas: LojaDist[] = [];
  let geral: LojaDist | null = null;

  for (let i = 0; i < grid.length; i++) {
    const r = grid[i];
    // Procura uma célula com "iFood" — header de bloco
    const iFoodCol = r.findIndex(c => /^ifood$/i.test(c));
    if (iFoodCol < 0) continue;
    // O nome da loja está na célula imediatamente anterior (mesma linha) OU em r[1]
    const nomeCell = r[iFoodCol - 1] || r[1] || '';
    const isGeral = /geral\s*grupo/i.test(nomeCell);
    const codigo = isGeral ? '__GERAL__' : matchLojaCodigo(nomeCell);
    if (!codigo) continue;

    // Mapeia colunas dos canais a partir desse iFoodCol
    const channelCols: Record<string, number> = {};
    for (let k = 0; k < channels.length; k++) {
      const idx = iFoodCol + k;
      const headerVal = r[idx] || '';
      // Sanity check
      if (normTxt(headerVal).startsWith(normTxt(channels[k]).substring(0, 4))) {
        channelCols[channels[k]] = idx;
      } else {
        channelCols[channels[k]] = idx; // assume sequential
      }
    }
    const totalCol = iFoodCol + channels.length;

    const dist: LojaDist = {
      nome: nomeCell,
      codigo,
      counts: {},
      porCanal: {},
      total: 0,
    };
    for (const c of channels) dist.porCanal[c] = {};

    // Lê linhas seguintes até encontrar "Total" ou linha em branco
    for (let j = i + 1; j < Math.min(i + 10, grid.length); j++) {
      const rr = grid[j];
      if (!rr || !rr.length) break;
      const notaCell = rr[iFoodCol - 1] || rr[1] || '';
      if (/total/i.test(notaCell)) {
        // Total row — captura totais por canal
        for (const c of channels) {
          const v = parseNum(rr[channelCols[c]]);
          if (v !== null) {
            dist.porCanal[c]['__total__'] = v;
          }
        }
        const t = parseNum(rr[totalCol]);
        if (t !== null) dist.total = t;
        break;
      }
      const nota = parseNum(notaCell);
      if (nota === null || nota < 1 || nota > 5) continue;
      const notaKey = String(Math.round(nota));
      let rowSum = 0;
      for (const c of channels) {
        const v = parseNum(rr[channelCols[c]]);
        if (v !== null) {
          dist.porCanal[c][notaKey] = v;
          rowSum += v;
        }
      }
      const t = parseNum(rr[totalCol]);
      dist.counts[notaKey] = t !== null ? t : rowSum;
    }

    if (Object.keys(dist.counts).length) {
      if (isGeral) geral = dist;
      else lojas.push(dist);
    }
  }

  // Build blocks
  if (lojas.length) {
    const items = lojas.map(l => {
      const counts = l.counts;
      const total = l.total || Object.values(counts).reduce((a, b) => a + b, 0);
      let weighted = 0;
      for (let n = 1; n <= 5; n++) weighted += n * (counts[String(n)] ?? 0);
      const media = total > 0 ? weighted / total : null;
      const insat = total > 0 ? ((counts['1'] ?? 0) + (counts['2'] ?? 0)) / total * 100 : 0;
      if (media !== null) rows.push({ loja_codigo: l.codigo, valor: media });
      return { loja_codigo: l.codigo, counts, total, media, insatisfacao: insat };
    });
    blocks.push({
      block_key: 'distribuicao_notas',
      block_type: 'distribution',
      payload: { label: 'Distribuição de notas por loja', notas: [1, 2, 3, 4, 5], items },
      ordem: 1,
    });

    // Ranking insatisfação (lower is better)
    const ranking = [...items].sort((a, b) => b.insatisfacao - a.insatisfacao).map((it, i) => ({
      loja_codigo: it.loja_codigo, valor: it.insatisfacao, posicao: i + 1,
      hint: `${it.total} avaliações`,
    }));
    blocks.push({
      block_key: 'ranking_insatisfacao',
      block_type: 'ranking',
      payload: { label: 'Insatisfação (% notas 1-2)', suffix: '%', polarity: 'lower', items: ranking, decimals: 2 },
      ordem: 2,
    });
  }

  // KPI strip do Geral Grupo
  if (geral) {
    const total = geral.total || Object.values(geral.counts).reduce((a, b) => a + b, 0);
    const cinco = geral.counts['5'] ?? 0;
    const insat = total > 0 ? ((geral.counts['1'] ?? 0) + (geral.counts['2'] ?? 0)) / total * 100 : 0;
    let weighted = 0;
    for (let n = 1; n <= 5; n++) weighted += n * (geral.counts[String(n)] ?? 0);
    const media = total > 0 ? weighted / total : 0;
    blocks.unshift({
      block_key: 'kpi_geral_grupo',
      block_type: 'kpi_strip',
      payload: {
        label: 'Geral Grupo',
        kpis: [
          { label: 'Avaliações totais', value: total, format: 'int' },
          { label: 'Média', value: media, format: 'decimal', decimals: 2, suffix: '★' },
          { label: '% Notas 5', value: total > 0 ? (cinco / total) * 100 : 0, format: 'percent' },
          { label: '% Insatisfação (1-2)', value: insat, format: 'percent', tone: 'danger' },
        ],
      },
      ordem: 0,
    });
  }

  return { rows, blocks };
}

// ──────────────────────────────────────────────────────────────
// 5) CMV SALMÃO — Lojas em colunas, datas em linhas
// ──────────────────────────────────────────────────────────────
function parseCmvSalmaoSeries(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];

  // Header: encontra linha com "Unidade" e nomes de loja
  let unitRow = -1;
  const lojaCols: Array<{ col: number; codigo: string; nome: string }> = [];
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const r = grid[i];
    const u = r.findIndex(c => /unidade/i.test(c));
    if (u < 0) continue;
    const cols: typeof lojaCols = [];
    for (let j = u + 1; j < r.length; j++) {
      const code = matchLojaCodigo(r[j]);
      if (code) cols.push({ col: j, codigo: code, nome: r[j] });
    }
    if (cols.length >= 2) { unitRow = i; lojaCols.push(...cols); break; }
  }
  if (unitRow < 0) return { rows, blocks };

  // Linha de "Data | Dia da Semana" geralmente +1
  let dataRow = -1;
  for (let i = unitRow + 1; i < unitRow + 5 && i < grid.length; i++) {
    const r = grid[i];
    if (r.some(c => /^data$/i.test(c))) { dataRow = i; break; }
  }
  const startRow = dataRow >= 0 ? dataRow + 1 : unitRow + 1;

  // Lê dados
  const series: Array<{ loja_codigo: string; nome: string; points: Array<{ x: string; y: number | null }> }> =
    lojaCols.map(l => ({ loja_codigo: l.codigo, nome: l.nome, points: [] }));
  const sumByLoja: Record<string, { sum: number; count: number; over: number }> = {};

  // Limites: tenta extrair os thresholds da própria planilha (texto "Verde / Amarelo / Vermelho")
  let thresholdGood = 1.55;
  let thresholdMid = 1.65;
  for (const r of grid) {
    const joined = normTxt(r.join(' '));
    const mGood = joined.match(/ATE\s*([\d,\.]+)\s*VERDE/);
    if (mGood) thresholdGood = parseNum(mGood[1]) ?? thresholdGood;
    const mMid = joined.match(/ENTRE\s*([\d,\.]+)\s*E\s*([\d,\.]+)\s*AMARELO/);
    if (mMid) thresholdMid = parseNum(mMid[2]) ?? thresholdMid;
  }

  for (let i = startRow; i < grid.length; i++) {
    const r = grid[i];
    if (!r || !r.length) continue;
    const dataStr = r.find(c => /^\d{1,2}\/\d{1,2}\/\d{4}/.test(c));
    if (!dataStr) continue;
    const iso = parseDateBR(dataStr);
    const xLabel = dataStr.substring(0, 5); // "01/04"
    for (const lc of lojaCols) {
      const v = parseNum(r[lc.col]);
      const s = series.find(x => x.loja_codigo === lc.codigo)!;
      s.points.push({ x: xLabel, y: v });
      if (v !== null) {
        sumByLoja[lc.codigo] ??= { sum: 0, count: 0, over: 0 };
        sumByLoja[lc.codigo].sum += v;
        sumByLoja[lc.codigo].count++;
        if (v > thresholdMid) sumByLoja[lc.codigo].over++;
      }
    }
    void iso;
  }

  // KPI rows
  for (const [code, agg] of Object.entries(sumByLoja)) {
    if (agg.count > 0) rows.push({ loja_codigo: code, valor: agg.sum / agg.count });
  }

  // Block: série temporal com thresholds
  blocks.push({
    block_key: 'serie_diaria',
    block_type: 'series',
    payload: {
      label: 'Salmão · kg por R$1.000 faturado (diário)',
      series,
      thresholds: {
        good: { lte: thresholdGood, color: '#10b981', label: `≤ ${thresholdGood}` },
        mid: { gt: thresholdGood, lte: thresholdMid, color: '#f59e0b', label: `${thresholdGood}–${thresholdMid}` },
        bad: { gt: thresholdMid, color: '#ef4444', label: `> ${thresholdMid}` },
      },
      polarity: 'lower',
      decimals: 3,
    },
    ordem: 1,
  });

  // Block: Ranking média mensal
  const ranking = Object.entries(sumByLoja)
    .map(([code, agg]) => ({ loja_codigo: code, valor: agg.sum / agg.count, dias_acima: agg.over }))
    .sort((a, b) => a.valor - b.valor)
    .map((r, i) => ({
      loja_codigo: r.loja_codigo, valor: r.valor, posicao: i + 1,
      hint: `${r.dias_acima} dia(s) acima do limite`,
    }));
  blocks.push({
    block_key: 'ranking_media_mes',
    block_type: 'ranking',
    payload: { label: 'Média do mês por loja', suffix: 'kg/R$1k', polarity: 'lower', items: ranking, decimals: 3 },
    ordem: 0,
  });

  return { rows, blocks };
}

// ──────────────────────────────────────────────────────────────
// 6) CMV CARNES — blocos lado a lado por loja, item × indicadores
// ──────────────────────────────────────────────────────────────
function parseCmvCarnesItens(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];

  // Detecta blocos: linha com número (cod loja) + nome loja + "Checklist"
  type LojaBlock = {
    lojaCol: number;        // coluna onde está o nome da loja
    lojaName: string;
    lojaCodigo: string;
    headerRow: number;
    cols: { item: number; envios: number; envios_rs: number; vendas: number; era: number; final: number; diff: number; vlrTotal: number; diffPct: number };
  };
  const blocksFound: LojaBlock[] = [];

  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const r = grid[i];
    for (let j = 0; j < r.length; j++) {
      if (!/^\d+$/.test(r[j])) continue;
      const lojaName = r[j + 1] || '';
      const checklistCell = r[j + 2] || '';
      if (!/checklist/i.test(checklistCell)) continue;
      const codigo = matchLojaCodigo(lojaName);
      if (!codigo) continue;

      // Header geralmente +1
      const hr = i + 1;
      const hrow = grid[hr] || [];
      // Encontra colunas pelos nomes
      const findCol = (re: RegExp, from: number) => {
        for (let k = from; k < Math.min(hrow.length, from + 14); k++) {
          if (re.test(hrow[k])) return k;
        }
        return -1;
      };
      const itemCol = j + 1; // mesma coluna do nome loja, mas linhas seguintes
      const enviosCol = findCol(/^envios$/i, j);
      const enviosRsCol = findCol(/envios.*r\$/i, j);
      const vendasCol = findCol(/vendas/i, j);
      const eraCol = findCol(/era pra ter/i, j);
      const finalCol = findCol(/^\d{2}\/\d{2}$/, eraCol > 0 ? eraCol + 1 : j);
      const diffCol = findCol(/^diferen[çc]a$/i, j);
      const vlrTotalCol = findCol(/vlr\s*total/i, j);
      const diffPctCol = findCol(/diferen[çc]a.*%|%$/i, j);

      blocksFound.push({
        lojaCol: j + 1,
        lojaName,
        lojaCodigo: codigo,
        headerRow: hr,
        cols: {
          item: itemCol,
          envios: enviosCol,
          envios_rs: enviosRsCol,
          vendas: vendasCol,
          era: eraCol,
          final: finalCol,
          diff: diffCol,
          vlrTotal: vlrTotalCol,
          diffPct: diffPctCol,
        },
      });
    }
  }

  type ItemRow = { Loja: string; Item: string; Envios: number | null; Vendas: number | null; 'Era pra Ter': number | null; Final: number | null; Diferenca: number | null; 'Vlr Total': number | null; '% Desvio': number | null };
  const allItems: ItemRow[] = [];
  const lossByLoja = new Map<string, { perda: number; itensProblematicos: number; somaAbsDiffPct: number; n: number }>();

  for (const b of blocksFound) {
    for (let i = b.headerRow + 1; i < grid.length; i++) {
      const r = grid[i];
      const item = r[b.cols.item] || '';
      if (!item || /total/i.test(item)) continue;
      // Item válido tem letras
      if (!/[A-Za-z]/.test(item)) continue;
      const envios = parseNum(r[b.cols.envios]);
      const vendas = parseNum(r[b.cols.vendas]);
      const era = parseNum(r[b.cols.era]);
      const finalQ = parseNum(r[b.cols.final]);
      const diff = parseNum(r[b.cols.diff]);
      const vlr = parseNum(r[b.cols.vlrTotal]);
      const dpct = parseNum(r[b.cols.diffPct]);

      allItems.push({
        Loja: b.lojaCodigo,
        Item: item,
        Envios: envios,
        Vendas: vendas,
        'Era pra Ter': era,
        Final: finalQ,
        Diferenca: diff,
        'Vlr Total': vlr,
        '% Desvio': dpct,
      });

      const cur = lossByLoja.get(b.lojaCodigo) || { perda: 0, itensProblematicos: 0, somaAbsDiffPct: 0, n: 0 };
      if (vlr !== null && vlr < 0) { cur.perda += Math.abs(vlr); cur.itensProblematicos++; }
      if (dpct !== null) { cur.somaAbsDiffPct += Math.abs(dpct); cur.n++; }
      lossByLoja.set(b.lojaCodigo, cur);
    }
  }

  // KPI por loja: média ponderada |% desvio|
  for (const [code, agg] of lossByLoja) {
    if (agg.n > 0) rows.push({ loja_codigo: code, valor: agg.somaAbsDiffPct / agg.n });
  }

  // Ranking perda R$ por loja (lower=better)
  const ranking = Array.from(lossByLoja.entries())
    .sort((a, b) => b[1].perda - a[1].perda)
    .map(([code, agg], i) => ({
      loja_codigo: code, valor: agg.perda, posicao: i + 1,
      hint: `${agg.itensProblematicos} item(ns) com perda`,
    }));
  if (ranking.length) {
    blocks.push({
      block_key: 'ranking_perda_rs',
      block_type: 'ranking',
      payload: { label: 'Perda total R$ por loja', suffix: 'R$', polarity: 'lower', items: ranking, decimals: 2 },
      ordem: 0,
    });
  }

  // Item table
  if (allItems.length) {
    blocks.push({
      block_key: 'tabela_itens',
      block_type: 'item_table',
      payload: {
        label: 'Itens — Desvios de Carnes',
        columns: [
          { key: 'Loja', label: 'Loja', type: 'text' },
          { key: 'Item', label: 'Item', type: 'text' },
          { key: 'Envios', label: 'Envios', type: 'number' },
          { key: 'Vendas', label: 'Vendas', type: 'number' },
          { key: 'Era pra Ter', label: 'Era pra Ter', type: 'number' },
          { key: 'Final', label: 'Final', type: 'number' },
          { key: 'Diferenca', label: 'Diferença', type: 'number' },
          { key: 'Vlr Total', label: 'Vlr Total', type: 'currency' },
          { key: '% Desvio', label: '% Desvio', type: 'percent' },
        ],
        rows: allItems
          .filter(i => i['Vlr Total'] !== null)
          .sort((a, b) => Math.abs(a['Vlr Total']!) < Math.abs(b['Vlr Total']!) ? 1 : -1)
          .slice(0, 100),
      },
      ordem: 1,
    });
  }

  // Matrix Item × Loja (% desvio) — só itens com >=2 lojas
  const itemSet = Array.from(new Set(allItems.map(i => i.Item)));
  const lojaSet = Array.from(new Set(allItems.map(i => i.Loja)));
  if (itemSet.length && lojaSet.length >= 2) {
    const catRows = itemSet.slice(0, 30).map(item => {
      const valores: Record<string, number | null> = {};
      for (const loja of lojaSet) {
        const it = allItems.find(x => x.Item === item && x.Loja === loja);
        valores[loja] = it ? it['% Desvio'] : null;
      }
      return { categoria: item, valores };
    });
    blocks.push({
      block_key: 'matrix_item_loja',
      block_type: 'matrix',
      payload: {
        label: '% Desvio por Item × Loja',
        lojas: lojaSet,
        categorias: catRows,
        suffix: '%',
        polarity: 'lower',
        scale: { min: -30, mid: 0, max: 30 },
      },
      ordem: 2,
    });
  }

  return { rows, blocks };
}

// ──────────────────────────────────────────────────────────────
// NEW PARSERS (V2) — leem layouts reais das planilhas
// ──────────────────────────────────────────────────────────────

function _parseBRL(s: string | undefined | null): number | null {
  if (s == null) return null;
  let t = String(s).trim();
  if (!t) return null;
  t = t.replace(/R\$\s?/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}
function _parsePct(s: string | undefined | null): number | null {
  if (s == null) return null;
  let t = String(s).trim();
  if (!t) return null;
  t = t.replace('%', '').replace(',', '.').trim();
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}
function _parseInt(s: unknown): number | null {
  if (s == null) return null;
  const n = parseInt(String(s).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// 1) parseSupervisoresRanking — aba "GERAL E GERENTES"
function parseSupervisoresRanking(grid: string[][]): ParseResult {
  type Item = { posicao: number; loja_codigo: string; valor: number };
  type Sec = { key: 'geral' | 'back' | 'front'; label: string; periodo: string; itens: Item[] };
  const sections: Sec[] = [];
  let current: Sec | null = null;

  for (let i = 0; i < grid.length; i++) {
    const r = grid[i];
    const joined = normTxt(r.join(' '));
    if (!joined) continue;

    let key: Sec['key'] | null = null;
    let label = '';
    if (/GERENTE\s*BACK/.test(joined)) { key = 'back'; label = 'Gerente Back'; }
    else if (/GERENTE\s*FRONT/.test(joined)) { key = 'front'; label = 'Gerente Front'; }
    else if (/\bGERAL\b/.test(joined) && !/TOTAL\s*GERAL/.test(joined)) {
      if (!current || current.key !== 'geral') { key = 'geral'; label = 'Geral'; }
    }

    if (key) {
      if (current) sections.push(current);
      const periodMatch = r.join(' ').match(/per[ií]odo[:\s]+([^\|]+)/i);
      current = { key, label, periodo: periodMatch?.[1]?.trim() ?? '', itens: [] };
      continue;
    }
    if (!current) continue;
    if (/TOTAL\s*GERAL|PERIODO|POSICAO/.test(joined)) continue;

    for (let j = 0; j < r.length - 2; j++) {
      const posCell = (r[j] || '').trim();
      if (!/[ºo°]/i.test(posCell)) continue;
      const pos = parseInt(posCell, 10);
      if (!Number.isFinite(pos) || pos < 1) continue;
      const unidadeRaw = (r[j + 1] || '').trim();
      const code = matchLojaCodigo(unidadeRaw);
      const valor = _parsePct(r[j + 2]);
      if (code && valor !== null) {
        if (!current.itens.find(x => x.loja_codigo === code)) {
          current.itens.push({ posicao: pos, loja_codigo: code, valor });
        }
      }
      break;
    }
  }
  if (current) sections.push(current);

  const rows: MetaRow[] = [];
  const blocks: Block[] = [];
  for (const s of sections) {
    if (!s.itens.length) continue;
    blocks.push({
      block_key: `ranking_${s.key}`,
      block_type: 'ranking',
      payload: { label: s.label, periodo: s.periodo, suffix: '%', polarity: 'higher', items: s.itens },
      ordem: s.key === 'geral' ? 0 : s.key === 'back' ? 1 : 2,
    });
    if (s.key === 'geral') {
      for (const it of s.itens) rows.push({ loja_codigo: it.loja_codigo, valor: it.valor });
    }
  }
  return { rows, blocks };
}

// 2) parseNpsAtendimento — aba "BASE dados"
function parseNpsAtendimento(grid: string[][]): ParseResult {
  type Agg = { sumNotaQtd: number; sumQtd: number };
  const atendimento = new Map<string, Agg>();
  const delivery = new Map<string, Agg>();

  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || !r.length) continue;
    for (let g = 0; g < 4; g++) {
      const off = g * 4;
      const restRaw = (r[off + 1] || '').trim();
      const nota = _parseInt(r[off + 2]);
      const qtd = _parseInt(r[off + 3]);
      if (!restRaw || !qtd || qtd <= 0 || nota === null) continue;
      const code = matchLojaCodigo(restRaw);
      if (!code) continue;
      const target = g <= 1 ? atendimento : delivery;
      const cur = target.get(code) || { sumNotaQtd: 0, sumQtd: 0 };
      cur.sumNotaQtd += nota * qtd;
      cur.sumQtd += qtd;
      target.set(code, cur);
    }
  }

  const buildRanking = (m: Map<string, Agg>) =>
    Array.from(m.entries())
      .map(([code, a]) => ({
        loja_codigo: code,
        valor: a.sumQtd > 0 ? a.sumNotaQtd / a.sumQtd : 0,
        totalAvaliacoes: a.sumQtd,
      }))
      .sort((a, b) => b.valor - a.valor)
      .map((it, idx) => ({ ...it, posicao: idx + 1 }));

  const atItems = buildRanking(atendimento);
  const dlItems = buildRanking(delivery);

  const rows: MetaRow[] = [];
  for (const it of atItems) rows.push({ loja_codigo: it.loja_codigo, valor: it.valor });

  const blocks: Block[] = [];
  if (atItems.length) blocks.push({
    block_key: 'ranking_atendimento',
    block_type: 'ranking',
    payload: { label: 'Atendimento (Google + TripAdvisor)', suffix: '★', polarity: 'higher', decimals: 2, items: atItems },
    ordem: 0,
  });
  if (dlItems.length) blocks.push({
    block_key: 'ranking_delivery',
    block_type: 'ranking',
    payload: { label: 'Delivery (iFood + iFood Dark)', suffix: '★', polarity: 'higher', decimals: 2, items: dlItems },
    ordem: 1,
  });

  return { rows, blocks };
}

// 3) parseAvaliacoesFaturamento — aba "01/04 - 30/04"
function parseAvaliacoesFaturamento(grid: string[][]): ParseResult {
  type Row = { loja: string; loja_codigo: string; aval13: number; totalAval: number; pct: number; fatTotal: number; rsPorAval: number };
  const salao: Row[] = [];
  const delivery: Row[] = [];

  let periodo = '';
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const j = grid[i].join(' ');
    const m = j.match(/(\d{1,2}\/\d{1,2})\s*[-–]\s*(\d{1,2}\/\d{1,2})/);
    if (m) { periodo = `${m[1]} - ${m[2]}`; break; }
  }

  const readBlock = (startCol: number, target: Row[]) => {
    for (let i = 2; i < grid.length; i++) {
      const r = grid[i];
      const lojaRaw = (r[startCol] || '').trim();
      if (!lojaRaw) break;
      if (/total/i.test(lojaRaw)) continue;
      const code = matchLojaCodigo(lojaRaw);
      if (!code) continue;
      const aval13 = _parseInt(r[startCol + 1]) ?? 0;
      const totalAval = _parseInt(r[startCol + 2]) ?? 0;
      const pct = _parsePct(r[startCol + 3]) ?? 0;
      const fatTotal = _parseBRL(r[startCol + 4]) ?? 0;
      const rsPorAval = _parseBRL(r[startCol + 5]) ?? 0;
      target.push({ loja: lojaRaw, loja_codigo: code, aval13, totalAval, pct, fatTotal, rsPorAval });
    }
  };
  readBlock(1, salao);
  readBlock(7, delivery);

  const rows: MetaRow[] = [];
  for (const r of salao) rows.push({ loja_codigo: r.loja_codigo, valor: r.pct });

  const blocks: Block[] = [];
  if (salao.length || delivery.length) {
    blocks.push({
      block_key: 'tabela_aval_fat',
      block_type: 'item_table',
      payload: { label: 'Avaliações & Faturamento', periodo, salao, delivery },
      ordem: 0,
    });
  }
  return { rows, blocks };
}

// 4) parseKdsTargetPretoV2 — aba "Salão"
function parseKdsTargetPretoV2(grid: string[][]): ParseResult {
  let dataAtualizacao = '';
  if (grid[0]) {
    const m = grid[0].join(' ').match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (m) dataAtualizacao = m[1];
  }

  type Cat = { categoria: string; totalPratos: number; qtnTarget: number; pct: number };
  type LojaData = { loja: string; loja_codigo: string; categorias: Cat[]; totalGeral: { totalPratos: number; qtnTarget: number; pct: number } };
  const lojasMap = new Map<string, LojaData>();

  let currentLoja: LojaData | null = null;
  for (let i = 3; i < grid.length; i++) {
    const r = grid[i];
    if (!r || !r.length) continue;
    const lojaCell = (r[0] || '').trim();
    const catCell = (r[1] || '').trim();

    if (lojaCell) {
      const code = matchLojaCodigo(lojaCell);
      if (code) {
        if (!lojasMap.has(code)) {
          lojasMap.set(code, {
            loja: lojaCell, loja_codigo: code, categorias: [],
            totalGeral: { totalPratos: 0, qtnTarget: 0, pct: 0 },
          });
        }
        currentLoja = lojasMap.get(code)!;
      }
    }
    if (!currentLoja) continue;

    if (/total\s*geral/i.test(catCell)) {
      currentLoja.totalGeral = {
        totalPratos: _parseInt(r[2]) ?? 0,
        qtnTarget: _parseInt(r[3]) ?? 0,
        pct: _parsePct(r[4]) ?? 0,
      };
      continue;
    }
    if (catCell && !lojaCell) {
      const total = _parseInt(r[2]);
      const qtn = _parseInt(r[3]);
      const pct = _parsePct(r[4]);
      if (total !== null || qtn !== null || pct !== null) {
        currentLoja.categorias.push({
          categoria: catCell,
          totalPratos: total ?? 0,
          qtnTarget: qtn ?? 0,
          pct: pct ?? 0,
        });
      }
    }
  }

  const lojas = Array.from(lojasMap.values());
  const rows: MetaRow[] = lojas.map(l => ({ loja_codigo: l.loja_codigo, valor: l.totalGeral.pct }));

  const blocks: Block[] = [];
  if (lojas.length) {
    const ranking = [...lojas]
      .sort((a, b) => a.totalGeral.pct - b.totalGeral.pct)
      .map((l, idx) => ({
        loja_codigo: l.loja_codigo, valor: l.totalGeral.pct, posicao: idx + 1,
        hint: `${l.totalGeral.qtnTarget}/${l.totalGeral.totalPratos}`,
      }));
    blocks.push({
      block_key: 'ranking_target_preto',
      block_type: 'ranking',
      payload: { label: 'Target Preto · % por loja', suffix: '%', polarity: 'lower', items: ranking, dataAtualizacao },
      ordem: 0,
    });

    const allCats = Array.from(new Set(lojas.flatMap(l => l.categorias.map(c => c.categoria))));
    if (allCats.length) {
      const catRows = allCats.map(cat => {
        const valores: Record<string, number | null> = {};
        for (const l of lojas) {
          const c = l.categorias.find(x => x.categoria === cat);
          valores[l.loja_codigo] = c ? c.pct : null;
        }
        return { categoria: cat, valores };
      });
      blocks.push({
        block_key: 'matrix_categoria_loja',
        block_type: 'matrix',
        payload: {
          label: 'Target Preto por Categoria × Loja',
          lojas: lojas.map(l => l.loja_codigo),
          categorias: catRows,
          suffix: '%', polarity: 'lower',
          scale: { min: 0, mid: 10, max: 30 },
          dataAtualizacao,
        },
        ordem: 1,
      });
    }
  }
  return { rows, blocks };
}

// 5) parseBaseAvaliacoes — aba "Consolidado"
function parseBaseAvaliacoes(grid: string[][]): ParseResult {
  type Recl = { loja_codigo: string; loja: string; data: string; diaSemana: string; nota: number; autor: string; comentario: string };
  const reclamacoes: Recl[] = [];
  let totalLinhas = 0;

  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || !r.length) continue;
    const loja = (r[0] || '').trim();
    const dataStr = (r[1] || '').trim();
    const diaSemana = (r[2] || '').trim();
    const autor = (r[4] || '').trim();
    const comentario = (r[5] || '').trim();
    if (!loja || !dataStr) continue;
    totalLinhas++;
    if (!comentario) continue;
    const nota = _parseInt(r[3]);
    if (nota === null || nota > 3) continue;
    const code = matchLojaCodigo(loja);
    if (!code) continue;
    const iso = parseDateBR(dataStr) ?? dataStr;
    reclamacoes.push({ loja_codigo: code, loja, data: iso, diaSemana, nota, autor, comentario });
  }

  const rows: MetaRow[] = [];
  const countByLoja = new Map<string, number>();
  for (const r of reclamacoes) countByLoja.set(r.loja_codigo, (countByLoja.get(r.loja_codigo) || 0) + 1);
  for (const [code, count] of countByLoja) rows.push({ loja_codigo: code, valor: count });

  const blocks: Block[] = [];
  if (reclamacoes.length) {
    blocks.push({
      block_key: 'mural_reclamacoes',
      block_type: 'item_table',
      payload: { label: 'Mural de Reclamações (notas ≤ 3)', totalLinhas, items: reclamacoes },
      ordem: 0,
    });
  }
  return { rows, blocks };
}

// ──────────────────────────────────────────────────────────────
// Fallback genérico
// ──────────────────────────────────────────────────────────────
function parseGenericMeta(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  let headerIdx = -1, unitCol = -1, valueCol = -1;
  for (let i = 0; i < Math.min(grid.length, 25); i++) {
    const r = grid[i].map(c => c.toUpperCase());
    const u = r.findIndex(c => /UNIDADE|LOJA/.test(c));
    const v = r.findIndex(c => /VALOR|MEDIA|MÉDIA|SCORE|NPS|CMV|KDS|%/.test(c));
    if (u >= 0 && v >= 0) { headerIdx = i; unitCol = u; valueCol = v; break; }
  }
  if (headerIdx < 0) return { rows, blocks: [] };
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    const codigo = matchLojaCodigo(r[unitCol] || '');
    const valor = parseNum(r[valueCol] || '');
    if (codigo && valor !== null) rows.push({ loja_codigo: codigo, valor });
  }
  if (!rows.length) return { rows, blocks: [] };
  const ranking: Block = {
    block_key: 'ranking_principal',
    block_type: 'ranking',
    payload: {
      label: 'Ranking',
      polarity: 'higher',
      items: [...rows].sort((a, b) => b.valor - a.valor).map((r, idx) => ({
        loja_codigo: r.loja_codigo, valor: r.valor, posicao: idx + 1,
      })),
    },
    ordem: 0,
  };
  return { rows, blocks: [ranking] };
}

function dispatchParser(metaKey: string, grid: string[][]): ParseResult {
  switch (metaKey) {
    case 'conformidade': return parseConformidade(grid);
    case 'kds':
    case 'kds-target-preto':
    case 'target-preto': return parseKdsTargetPretoV2(grid);
    case 'nps': return parseNpsAtendimento(grid);
    case 'atendimento-medias': return parseAvaliacoesFaturamento(grid);
    case 'reclamacoes': return parseBaseAvaliacoes(grid);
    case 'cmv-salmao': return parseCmvSalmaoSeries(grid);
    case 'cmv-carnes': return parseCmvCarnesItens(grid);
    case 'ranking-supervisores': return parseSupervisoresRanking(grid);
    default: return parseGenericMeta(grid);
  }
}

// metaKey → coluna em metas_snapshot
const METRIC_COLUMN: Record<string, string> = {
  'conformidade': 'conformidade',
  'nps': 'nps',
  'kds': 'kds',
  'cmv-salmao': 'cmv_salmao',
  'cmv-carnes': 'cmv_carnes',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body: SyncRequest = await req.json();
    const { sourceId } = body;
    const referenciaMes = body.referenciaMes
      || `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;

    const { data: source, error: srcErr } = await supabase
      .from('sheets_sources')
      .select('id, url, meta_key, nome')
      .eq('id', sourceId)
      .maybeSingle();
    if (srcErr || !source) throw new Error('Fonte não encontrada.');

    const sourceUrl = source.url || body.url || '';
    const { sheetId, gid, sheetName } = extractSheetParams(sourceUrl);
    if (!sheetId) throw new Error('URL inválida — não foi possível extrair o sheetId.');
    const metaKey = source.meta_key;
    if (!metaKey) throw new Error('Esta fonte não tem `meta_key` definido.');

    console.log('[sync] meta=', metaKey, 'mes=', referenciaMes);

    // Aba Depara (opcional)
    DEPARA_MAP = {};
    try {
      const deparaGrid = await fetchGvizGrid(buildGvizUrl(sheetId, 'Depara'));
      for (const r of deparaGrid.slice(1)) {
        if (r[0] && r[1]) {
          const k = r[0].trim().toLowerCase();
          DEPARA_MAP[k] = r[1].trim();
          // também versão normTxt
          DEPARA_MAP[normTxt(r[0])] = r[1].trim();
        }
      }
      console.log('[sync] Depara entries:', Object.keys(DEPARA_MAP).length);
    } catch (e) {
      console.warn('[sync] Aba Depara ausente/inválida em', sheetId, e instanceof Error ? e.message : e);
    }

    // Grid principal via gviz
    const grid = await fetchGvizGrid(buildGvizUrl(sheetId, gid ?? sheetName));

    const parsed = dispatchParser(metaKey, grid);
    console.log('[sync] parsed rows=', parsed.rows.length, 'blocks=', parsed.blocks.length);

    // ===== Atualiza metas_snapshot (KPI agregado) =====
    const column = METRIC_COLUMN[metaKey];
    let updated = 0;
    if (column && parsed.rows.length > 0) {
      const { data: snapLojas } = await supabase
        .from('metas_snapshot')
        .select('loja_codigo, loja_id')
        .not('loja_id', 'is', null)
        .limit(1000);
      const lojaIdByCodigo = new Map<string, string>();
      for (const s of (snapLojas || [])) {
        if (s.loja_codigo && s.loja_id) lojaIdByCodigo.set(s.loja_codigo, s.loja_id as string);
      }
      const mesAnterior = shiftMonth(referenciaMes, -1);
      const colAnterior = `${column}_anterior`;

      for (const row of parsed.rows) {
        if (row.loja_codigo === '__GERAL__') continue;
        const { data: prevRow } = await supabase
          .from('metas_snapshot').select(column)
          .eq('loja_codigo', row.loja_codigo).eq('mes_ref', mesAnterior).maybeSingle();
        const prevValue = prevRow ? (prevRow as Record<string, unknown>)[column] : null;

        const upsertPayload: Record<string, unknown> = {
          loja_codigo: row.loja_codigo,
          loja_id: lojaIdByCodigo.get(row.loja_codigo) ?? null,
          mes_ref: referenciaMes,
          [column]: row.valor,
          [colAnterior]: prevValue ?? null,
        };
        const { error: upErr } = await supabase
          .from('metas_snapshot')
          .upsert(upsertPayload, { onConflict: 'loja_codigo,mes_ref' });
        if (!upErr) updated++;
      }
    }

    // ===== Grava blocos estruturados =====
    let blocksWritten = 0;
    for (const block of parsed.blocks) {
      // Delete existing then insert (constraint usa COALESCE, não compatível com onConflict por colunas)
      const delQ = supabase
        .from('sheets_blocks_snapshot')
        .delete()
        .eq('meta_key', metaKey)
        .eq('mes_ref', referenciaMes)
        .eq('block_key', block.block_key);
      if (block.loja_codigo) await delQ.eq('loja_codigo', block.loja_codigo);
      else await delQ.is('loja_codigo', null);

      const { error: bErr } = await supabase
        .from('sheets_blocks_snapshot')
        .insert({
          source_id: source.id,
          meta_key: metaKey,
          block_key: block.block_key,
          block_type: block.block_type,
          mes_ref: referenciaMes,
          loja_codigo: block.loja_codigo ?? null,
          payload: block.payload,
          ordem: block.ordem ?? 0,
          updated_at: new Date().toISOString(),
        });
      if (bErr) {
        console.error('[sync] block insert err', block.block_key, bErr.message);
      } else {
        blocksWritten++;
      }
    }

    const now = new Date().toISOString();
    const hasData = grid.length > 1 && (parsed.rows.length + parsed.blocks.length) > 0;

    if (!hasData) {
      const erroMsg = 'Parser não retornou linhas ou blocos válidos. Verifique se a planilha está pública e se o formato da aba está correto.';
      await supabase.from('sheets_sources')
        .update({ ultimo_status: 'erro', ultimo_erro: erroMsg })
        .eq('id', sourceId);
      await supabase.from('sincronizacoes_sheets').insert({
        url: sourceUrl, referencia_mes: referenciaMes, loja_id: null,
        status: 'error', linhas_importadas: 0,
        completed_at: now,
      });
      return new Response(
        JSON.stringify({ success: false, error: erroMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 422 }
      );
    }

    await supabase.from('sheets_sources')
      .update({
        ultima_sincronizacao: now,
        ultimo_status: 'ok',
        ultimo_erro: null,
      })
      .eq('id', sourceId);

    await supabase.from('sincronizacoes_sheets').insert({
      url: sourceUrl, referencia_mes: referenciaMes, loja_id: null,
      status: 'success', linhas_importadas: updated,
      completed_at: now,
    });

    return new Response(
      JSON.stringify({
        success: true,
        meta: metaKey,
        column: column || null,
        mesRef: referenciaMes,
        rowsImported: updated,
        blocksImported: blocksWritten,
        message: `${updated} loja(s) · ${blocksWritten} bloco(s) gravado(s).`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[sync] error', e);
    // Tenta marcar erro na source se temos sourceId no escopo
    try {
      const body2 = await req.clone().json().catch(() => ({}));
      const sId = (body2 as { sourceId?: string })?.sourceId;
      if (sId) {
        const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await sb.from('sheets_sources').update({
          ultimo_status: 'erro',
          ultimo_erro: e instanceof Error ? e.message : 'Erro desconhecido',
        }).eq('id', sId);
      }
    } catch { /* noop */ }
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Erro desconhecido', fallback: true }),
      // Retornamos 200 para que o supabase-js não lance exceção e a UI consiga ler o corpo do erro
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
