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
  const s = String(v).replace(/%/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normUnit(s: string): string {
  return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

// Mapa "CP AN" / "NZ GO" / "CJ AN" → loja_codigo (CP_AN, NZ_GO, CJ_AN)
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
// PARSERS BY META
// ============================================================
type MetaRow = { loja_codigo: string; valor: number };

/**
 * Conformidade: a planilha tem múltiplos blocos de ranking (GERAL, GERENTE BACK, GERENTE FRONT...).
 * Usamos o primeiro bloco "GERAL" para popular metas_snapshot.conformidade.
 * Layout esperado: linhas com [..., posicao, "CP AN", "88,98%"]
 */
function parseConformidade(grid: string[][]): MetaRow[] {
  const rows: MetaRow[] = [];
  let inGeral = false;
  for (const r of grid) {
    const joined = r.join(' ').toUpperCase();
    if (joined.includes('RANKING') && joined.includes('GERAL') && !joined.includes('BACK') && !joined.includes('FRONT')) {
      inGeral = true; continue;
    }
    // Início de outro bloco → pára
    if (inGeral && (joined.includes('GERENTE BACK') || joined.includes('GERENTE FRONT') || joined.includes('PERIODO'))) {
      if (joined.includes('GERENTE BACK') || joined.includes('GERENTE FRONT')) break;
    }
    if (!inGeral) continue;
    // Procura colunas com unidade + percentual
    for (let i = 0; i < r.length - 1; i++) {
      const codigo = matchLojaCodigo(r[i]);
      const valor = parsePercentOrNumber(r[i + 1]);
      if (codigo && valor !== null && valor > 0 && valor <= 100) {
        if (!rows.find(x => x.loja_codigo === codigo)) {
          rows.push({ loja_codigo: codigo, valor });
        }
        break;
      }
    }
  }
  return rows;
}

/**
 * Layout genérico (fallback / NPS / KDS / CMV simples):
 * Espera-se header com colunas "Unidade" e "Valor" (ou nome da meta).
 * Pega a coluna "valor" (numérica) por linha.
 */
function parseGenericMeta(grid: string[][]): MetaRow[] {
  const rows: MetaRow[] = [];
  // tenta achar header
  let headerIdx = -1;
  let unitCol = -1;
  let valueCol = -1;
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const r = grid[i].map(c => c.toUpperCase());
    const u = r.findIndex(c => /UNIDADE|LOJA/.test(c));
    const v = r.findIndex(c => /VALOR|MEDIA|MÉDIA|SCORE|NPS|CMV|KDS|%/.test(c));
    if (u >= 0 && v >= 0) { headerIdx = i; unitCol = u; valueCol = v; break; }
  }
  if (headerIdx < 0) return rows;
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    const codigo = matchLojaCodigo(r[unitCol] || '');
    const valor = parsePercentOrNumber(r[valueCol] || '');
    if (codigo && valor !== null) rows.push({ loja_codigo: codigo, valor });
  }
  return rows;
}

function dispatchParser(metaKey: string, grid: string[][]): MetaRow[] {
  switch (metaKey) {
    case 'conformidade': return parseConformidade(grid);
    case 'nps':
    case 'kds':
    case 'cmv-salmao':
    case 'cmv-carnes':
    case 'visao-geral':
    default:
      return parseGenericMeta(grid);
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

// ============================================================
// HANDLER
// ============================================================
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

    // Busca a fonte (prioriza dados do banco sobre o body)
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
    const column = METRIC_COLUMN[metaKey];
    if (!column) throw new Error(`Meta "${metaKey}" não tem coluna mapeada em metas_snapshot.`);

    console.log('[sync] meta=', metaKey, 'col=', column, 'mes=', referenciaMes);

    const csvResp = await fetch(url);
    if (!csvResp.ok) throw new Error('Não foi possível acessar a planilha (verifique compartilhamento).');
    const csv = await csvResp.text();
    const grid = parseCSV(csv);

    const parsed = dispatchParser(metaKey, grid);
    if (parsed.length === 0) {
      throw new Error(`Layout não reconhecido para a meta "${metaKey}". Nenhuma linha extraída.`);
    }
    console.log('[sync] parsed rows=', parsed.length);

    // Mapeia loja_codigo → loja_id (config_lojas) para FK
    const { data: lojas } = await supabase.from('config_lojas').select('id, nome');
    const lojaIdByCodigo = new Map<string, string>();
    // Heurística simples: pega config_lojas existentes em metas_snapshot
    const { data: snapLojas } = await supabase
      .from('metas_snapshot')
      .select('loja_codigo, loja_id')
      .not('loja_id', 'is', null)
      .limit(1000);
    for (const s of (snapLojas || [])) {
      if (s.loja_codigo && s.loja_id) lojaIdByCodigo.set(s.loja_codigo, s.loja_id as string);
    }

    // Mês anterior — para preencher *_anterior
    const mesAnterior = shiftMonth(referenciaMes, -1);
    const colAnterior = `${column}_anterior`;

    let updated = 0;
    for (const row of parsed) {
      // Lê snapshot atual e mês anterior
      const { data: existing } = await supabase
        .from('metas_snapshot')
        .select('id, observacoes')
        .eq('loja_codigo', row.loja_codigo)
        .eq('mes_ref', referenciaMes)
        .maybeSingle();

      const { data: prevRow } = await supabase
        .from('metas_snapshot')
        .select(column)
        .eq('loja_codigo', row.loja_codigo)
        .eq('mes_ref', mesAnterior)
        .maybeSingle();
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
      if (upErr) {
        console.error('[sync] upsert error', row.loja_codigo, upErr.message);
        continue;
      }
      updated++;
    }

    // Marca última sincronização
    await supabase
      .from('sheets_sources')
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq('id', sourceId);

    // Log no histórico de sincronizações
    await supabase.from('sincronizacoes_sheets').insert({
      url,
      referencia_mes: referenciaMes,
      loja_id: null,
      status: 'success',
      linhas_importadas: updated,
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        meta: metaKey,
        column,
        mesRef: referenciaMes,
        rowsImported: updated,
        message: `${updated} loja(s) atualizada(s) em metas_snapshot.${column} para ${referenciaMes}.`,
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
