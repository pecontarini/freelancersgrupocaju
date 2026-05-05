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

function parsePercentOrNumber(v: string | undefined): number | null {
  if (!v) return null;
  const s = String(v).replace(/%/g, '').replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normUnit(s: string): string {
  return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

const UNIT_ALIAS: Record<string, string> = {
  'CP AN': 'CP_AN', 'CPAN': 'CP_AN', 'CAMINITO ASA NORTE': 'CP_AN',
  'CP AS': 'CP_AS', 'CPAS': 'CP_AS', 'CAMINITO ASA SUL': 'CP_AS',
  'CP AC': 'CP_AC', 'CPAC': 'CP_AC', 'CAMINITO AGUAS CLARAS': 'CP_AC',
  'CP SG': 'CP_SG', 'CPSG': 'CP_SG', 'CAMINITO SIG': 'CP_SG',
  'NZ AS': 'NZ_AS', 'NZAS': 'NZ_AS', 'NAZO ASA SUL': 'NZ_AS',
  'NZ AC': 'NZ_AC', 'NZAC': 'NZ_AC', 'NAZO AGUAS CLARAS': 'NZ_AC',
  'NZ SG': 'NZ_SG', 'NZSG': 'NZ_SG', 'NAZO SIG': 'NZ_SG',
  'NZ GO': 'NZ_GO', 'NZGO': 'NZ_GO', 'NAZO GO': 'NZ_GO', 'NAZO GOIANIA': 'NZ_GO',
  'CJ AN': 'CJ_AN', 'CJAN': 'CJ_AN', 'CAJU ASA NORTE': 'CJ_AN',
  'CJ SG': 'CJ_SG', 'CJSG': 'CJ_SG', 'CAJU SIG': 'CJ_SG',
};

function matchLojaCodigo(raw: string): string | null {
  const n = normUnit(raw);
  if (UNIT_ALIAS[n]) return UNIT_ALIAS[n];
  for (const [alias, code] of Object.entries(UNIT_ALIAS)) {
    if (n.includes(alias)) return code;
  }
  return null;
}

function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeSheetsUrl(raw: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/\/spreadsheets\/d\/[a-zA-Z0-9-_]+\/gviz\/tq/.test(t)) return t;
  const idMatch = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = t.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
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

/**
 * CONFORMIDADE — múltiplos rankings: GERAL, BACK, FRONT.
 */
function parseConformidade(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];
  const sections: Array<{ key: string; label: string; rank: Array<{ loja: string; valor: number; pos: number }> }> = [];
  let current: { key: string; label: string; rank: Array<{ loja: string; valor: number; pos: number }> } | null = null;
  let pos = 0;

  for (const r of grid) {
    const joined = r.join(' ').toUpperCase().trim();
    if (!joined) continue;

    let newKey: string | null = null;
    let newLabel: string | null = null;
    if (joined.includes('RANKING') && joined.includes('GERAL')) { newKey = 'geral'; newLabel = 'Ranking Geral'; }
    else if (joined.includes('GERENTE BACK') || (joined.includes('BACK') && joined.includes('RANKING'))) { newKey = 'back'; newLabel = 'Gerente Back'; }
    else if (joined.includes('GERENTE FRONT') || (joined.includes('FRONT') && joined.includes('RANKING'))) { newKey = 'front'; newLabel = 'Gerente Front'; }

    if (newKey) {
      if (current) sections.push(current);
      current = { key: newKey, label: newLabel!, rank: [] };
      pos = 0;
      continue;
    }
    if (!current) continue;

    for (let i = 0; i < r.length - 1; i++) {
      const codigo = matchLojaCodigo(r[i]);
      const valor = parsePercentOrNumber(r[i + 1]);
      if (codigo && valor !== null && valor > 0 && valor <= 100) {
        if (!current.rank.find(x => x.loja === codigo)) {
          pos++;
          current.rank.push({ loja: codigo, valor, pos });
        }
        break;
      }
    }
  }
  if (current) sections.push(current);

  // KPI agregado: usa GERAL
  const geral = sections.find(s => s.key === 'geral');
  if (geral) {
    for (const r of geral.rank) rows.push({ loja_codigo: r.loja, valor: r.valor });
  }

  for (const s of sections) {
    blocks.push({
      block_key: `ranking_${s.key}`,
      block_type: 'ranking',
      payload: { label: s.label, items: s.rank.map(r => ({ loja_codigo: r.loja, valor: r.valor, posicao: r.pos })) },
      ordem: s.key === 'geral' ? 0 : s.key === 'back' ? 1 : 2,
    });
  }
  return { rows, blocks };
}

/**
 * Parser genérico (header com Unidade/Loja + Valor/etc).
 */
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
    const valor = parsePercentOrNumber(r[valueCol] || '');
    if (codigo && valor !== null) rows.push({ loja_codigo: codigo, valor });
  }
  const ranking: Block = {
    block_key: 'ranking_principal',
    block_type: 'ranking',
    payload: {
      label: 'Ranking',
      items: [...rows].sort((a, b) => b.valor - a.valor).map((r, idx) => ({
        loja_codigo: r.loja_codigo, valor: r.valor, posicao: idx + 1,
      })),
    },
    ordem: 0,
  };
  return { rows, blocks: rows.length ? [ranking] : [] };
}

/**
 * TARGET PRETO — matriz Categoria × Loja
 * Espera header: ["Categoria", "CP AN", "CP AS", ...] e linhas com % por categoria.
 */
function parseTargetPreto(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];

  let headerIdx = -1;
  let categoryCol = -1;
  const lojaCols: Array<{ idx: number; codigo: string }> = [];

  for (let i = 0; i < Math.min(grid.length, 25); i++) {
    const r = grid[i];
    const cat = r.findIndex(c => /CATEGORIA|SETOR|GRUPO/i.test(c));
    if (cat < 0) continue;
    const lojas: Array<{ idx: number; codigo: string }> = [];
    for (let j = 0; j < r.length; j++) {
      if (j === cat) continue;
      const code = matchLojaCodigo(r[j]);
      if (code) lojas.push({ idx: j, codigo: code });
    }
    if (lojas.length >= 2) {
      headerIdx = i; categoryCol = cat; lojaCols.push(...lojas);
      break;
    }
  }
  if (headerIdx < 0) return parseGenericMeta(grid);

  const matrix: Array<{ categoria: string; valores: Record<string, number | null> }> = [];
  const sumByLoja: Record<string, { sum: number; count: number }> = {};

  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    const cat = (r[categoryCol] || '').trim();
    if (!cat) continue;
    const valores: Record<string, number | null> = {};
    for (const { idx, codigo } of lojaCols) {
      const v = parsePercentOrNumber(r[idx]);
      valores[codigo] = v;
      if (v !== null) {
        sumByLoja[codigo] ??= { sum: 0, count: 0 };
        sumByLoja[codigo].sum += v;
        sumByLoja[codigo].count++;
      }
    }
    matrix.push({ categoria: cat, valores });
  }

  for (const [codigo, agg] of Object.entries(sumByLoja)) {
    if (agg.count > 0) rows.push({ loja_codigo: codigo, valor: agg.sum / agg.count });
  }

  blocks.push({
    block_key: 'matrix_categoria_loja',
    block_type: 'matrix',
    payload: {
      label: 'Target Preto por Categoria',
      lojas: lojaCols.map(l => l.codigo),
      categorias: matrix,
    },
    ordem: 0,
  });
  return { rows, blocks };
}

/**
 * ATENDIMENTO/MÉDIAS (Google/TripAdvisor/iFood) — placeholder tolerante.
 */
function parseAtendimentoMedias(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];
  let headerIdx = -1, lojaCol = -1;
  const channelCols: Array<{ idx: number; canal: string }> = [];
  const channelRegex = /GOOGLE|TRIPADVISOR|IFOOD|TRIP|ZOMATO/i;

  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const r = grid[i];
    const lc = r.findIndex(c => /LOJA|UNIDADE/i.test(c));
    if (lc < 0) continue;
    const ch: Array<{ idx: number; canal: string }> = [];
    for (let j = 0; j < r.length; j++) {
      if (channelRegex.test(r[j])) ch.push({ idx: j, canal: r[j].trim() });
    }
    if (ch.length) { headerIdx = i; lojaCol = lc; channelCols.push(...ch); break; }
  }

  const items: Array<Record<string, unknown>> = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      const codigo = matchLojaCodigo(r[lojaCol] || '');
      if (!codigo) continue;
      const valores: Record<string, number | null> = {};
      let avgSum = 0, avgCount = 0;
      for (const { idx, canal } of channelCols) {
        const v = parsePercentOrNumber(r[idx]);
        valores[canal] = v;
        if (v !== null) { avgSum += v; avgCount++; }
      }
      items.push({ loja_codigo: codigo, valores });
      if (avgCount > 0) rows.push({ loja_codigo: codigo, valor: avgSum / avgCount });
    }
  }

  blocks.push({
    block_key: 'medias_canais',
    block_type: 'item_table',
    payload: {
      label: 'Médias por canal',
      empty: items.length === 0,
      canais: channelCols.map(c => c.canal),
      items,
    },
    ordem: 0,
  });
  return { rows, blocks };
}

/**
 * RECLAMAÇÕES — distribuição de notas 1-5 + ranking de volume.
 */
function parseReclamacoesDistribuicao(grid: string[][]): ParseResult {
  const rows: MetaRow[] = [];
  const blocks: Block[] = [];
  let headerIdx = -1, lojaCol = -1;
  const notaCols: Array<{ idx: number; nota: number }> = [];

  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const r = grid[i];
    const lc = r.findIndex(c => /LOJA|UNIDADE/i.test(c));
    if (lc < 0) continue;
    const ncols: Array<{ idx: number; nota: number }> = [];
    for (let j = 0; j < r.length; j++) {
      const m = r[j].match(/^\s*(\d)\s*(★|ESTRELA|NOTA)?/i);
      if (m && Number(m[1]) >= 1 && Number(m[1]) <= 5) ncols.push({ idx: j, nota: Number(m[1]) });
    }
    if (ncols.length >= 3) { headerIdx = i; lojaCol = lc; notaCols.push(...ncols); break; }
  }

  const dist: Array<Record<string, unknown>> = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      const codigo = matchLojaCodigo(r[lojaCol] || '');
      if (!codigo) continue;
      const counts: Record<string, number> = {};
      let weighted = 0, total = 0;
      for (const { idx, nota } of notaCols) {
        const v = parsePercentOrNumber(r[idx]) ?? 0;
        counts[String(nota)] = v;
        weighted += nota * v; total += v;
      }
      const media = total > 0 ? weighted / total : null;
      dist.push({ loja_codigo: codigo, counts, total, media });
      if (media !== null) rows.push({ loja_codigo: codigo, valor: media });
    }
  } else {
    return parseGenericMeta(grid);
  }

  blocks.push({
    block_key: 'distribuicao_notas',
    block_type: 'distribution',
    payload: { label: 'Distribuição de notas', notas: [1, 2, 3, 4, 5], items: dist },
    ordem: 0,
  });
  return { rows, blocks };
}

/**
 * CMV SALMÃO — série diária por loja.
 */
function parseCmvSalmao(grid: string[][]): ParseResult {
  const generic = parseGenericMeta(grid);
  // Tenta detectar série temporal: header com datas
  let headerIdx = -1, lojaCol = -1;
  const dateCols: Array<{ idx: number; data: string }> = [];
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const r = grid[i];
    const lc = r.findIndex(c => /LOJA|UNIDADE/i.test(c));
    if (lc < 0) continue;
    const dc: Array<{ idx: number; data: string }> = [];
    for (let j = 0; j < r.length; j++) {
      if (/^\d{1,2}[\/\-]\d{1,2}/.test(r[j])) dc.push({ idx: j, data: r[j] });
    }
    if (dc.length >= 3) { headerIdx = i; lojaCol = lc; dateCols.push(...dc); break; }
  }
  if (headerIdx < 0) return generic;

  const series: Array<Record<string, unknown>> = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    const codigo = matchLojaCodigo(r[lojaCol] || '');
    if (!codigo) continue;
    const points = dateCols.map(d => ({ x: d.data, y: parsePercentOrNumber(r[d.idx]) }));
    series.push({ loja_codigo: codigo, points });
  }

  return {
    rows: generic.rows,
    blocks: [{
      block_key: 'serie_diaria',
      block_type: 'series',
      payload: { label: 'Evolução diária', series },
      ordem: 0,
    }],
  };
}

/**
 * CMV CARNES — tabela itemizada (item × loja × desvio).
 */
function parseCmvCarnes(grid: string[][]): ParseResult {
  return parseTargetPreto(grid);
}

function dispatchParser(metaKey: string, grid: string[][]): ParseResult {
  switch (metaKey) {
    case 'conformidade': return parseConformidade(grid);
    case 'kds':
    case 'target-preto': return parseTargetPreto(grid);
    case 'atendimento-medias': return parseAtendimentoMedias(grid);
    case 'reclamacoes':
    case 'nps': return parseReclamacoesDistribuicao(grid);
    case 'cmv-salmao': return parseCmvSalmao(grid);
    case 'cmv-carnes': return parseCmvCarnes(grid);
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

    const url = normalizeSheetsUrl(source.url || body.url || '');
    if (!url) throw new Error('URL inválida.');
    const metaKey = source.meta_key;
    if (!metaKey) throw new Error('Esta fonte não tem `meta_key` definido.');

    console.log('[sync] meta=', metaKey, 'mes=', referenciaMes);

    const csvResp = await fetch(url);
    if (!csvResp.ok) throw new Error('Não foi possível acessar a planilha (verifique compartilhamento).');
    const csv = await csvResp.text();
    const grid = parseCSV(csv);

    const parsed = dispatchParser(metaKey, grid);
    console.log('[sync] parsed rows=', parsed.rows.length, 'blocks=', parsed.blocks.length);

    // ===== Atualiza metas_snapshot (KPI agregado) se houver coluna mapeada =====
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
      const { error: bErr } = await supabase
        .from('sheets_blocks_snapshot')
        .upsert({
          source_id: source.id,
          meta_key: metaKey,
          block_key: block.block_key,
          block_type: block.block_type,
          mes_ref: referenciaMes,
          loja_codigo: block.loja_codigo ?? null,
          payload: block.payload,
          ordem: block.ordem ?? 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'meta_key,mes_ref,block_key,loja_codigo' });
      if (bErr) {
        console.error('[sync] block upsert err', block.block_key, bErr.message);
      } else {
        blocksWritten++;
      }
    }

    await supabase.from('sheets_sources')
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq('id', sourceId);

    await supabase.from('sincronizacoes_sheets').insert({
      url, referencia_mes: referenciaMes, loja_id: null,
      status: 'success', linhas_importadas: updated,
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        meta: metaKey,
        column: column || null,
        mesRef: referenciaMes,
        rowsImported: updated,
        blocksImported: blocksWritten,
        message: `${updated} loja(s) atualizada(s) · ${blocksWritten} bloco(s) estruturado(s) gravado(s).`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[sync] error', e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
