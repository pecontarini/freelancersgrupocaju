import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function normalizeSheetsUrl(raw: string): string | null {
  if (!raw) return null;
  const t = raw.trim();
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const gid = (t.match(/[#?&]gid=(\d+)/) || [, '0'])[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const UNIT_ALIAS: Record<string, string> = {
  'CP AN': 'CP_AN', 'CP AS': 'CP_AS', 'CP AC': 'CP_AC', 'CP SG': 'CP_SG',
  'NZ AS': 'NZ_AS', 'NZ AC': 'NZ_AC', 'NZ SG': 'NZ_SG', 'NZ GO': 'NZ_GO',
  'CJ AN': 'CJ_AN', 'CJ SG': 'CJ_SG',
};
function matchLoja(raw: string): string | null {
  const n = (raw || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (UNIT_ALIAS[n]) return UNIT_ALIAS[n];
  for (const [k, v] of Object.entries(UNIT_ALIAS)) if (n.includes(k)) return v;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { sourceId, classify } = await req.json();

    // Verifica se config está enabled
    const { data: cfg } = await supabase.from('reclamacoes_config').select('*').limit(1).maybeSingle();
    if (!cfg?.enabled) {
      return new Response(JSON.stringify({ success: false, error: 'Coleta de comentários está desligada.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const { data: source } = await supabase.from('sheets_sources').select('*').eq('id', sourceId).maybeSingle();
    if (!source) throw new Error('Fonte não encontrada.');

    const url = normalizeSheetsUrl(source.url);
    if (!url) throw new Error('URL inválida.');

    const csv = await (await fetch(url)).text();
    const grid = parseCSV(csv);
    if (grid.length < 2) throw new Error('Planilha vazia.');

    // Detecta header (data | loja | canal | nota | autor | comentario)
    const header = grid[0].map(h => h.toLowerCase());
    const idx = {
      data: header.findIndex(h => /data/.test(h)),
      loja: header.findIndex(h => /loja|unidade/.test(h)),
      canal: header.findIndex(h => /canal|fonte/.test(h)),
      nota: header.findIndex(h => /nota|estrela|rating/.test(h)),
      autor: header.findIndex(h => /autor|nome|cliente/.test(h)),
      comentario: header.findIndex(h => /coment[áa]rio|texto|review/.test(h)),
    };
    if (idx.comentario < 0) throw new Error('Coluna "comentario" não encontrada no header.');

    let inserted = 0, skipped = 0;
    for (let i = 1; i < grid.length; i++) {
      const r = grid[i];
      const comentario = (r[idx.comentario] || '').trim();
      if (!comentario) continue;

      const loja = idx.loja >= 0 ? matchLoja(r[idx.loja]) : null;
      const dataStr = idx.data >= 0 ? r[idx.data] : '';
      const canal = idx.canal >= 0 ? r[idx.canal] : null;
      const autor = idx.autor >= 0 ? r[idx.autor] : null;
      const notaRaw = idx.nota >= 0 ? r[idx.nota] : '';
      const nota = notaRaw ? Number(notaRaw.replace(',', '.')) : null;

      // Parse data dd/mm/yyyy or yyyy-mm-dd
      let dataIso: string | null = null;
      const m1 = dataStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      const m2 = dataStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m2) dataIso = dataStr;
      else if (m1) {
        const yyyy = m1[3].length === 2 ? `20${m1[3]}` : m1[3];
        dataIso = `${yyyy}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
      }

      const hash = await sha256([dataStr, loja || '', canal || '', autor || '', comentario].join('|'));

      const { error } = await supabase.from('reclamacoes_comentarios')
        .upsert({
          source_id: sourceId,
          loja_codigo: loja,
          canal: canal,
          nota: Number.isFinite(nota as number) ? nota : null,
          data_comentario: dataIso,
          autor: autor,
          comentario,
          source_hash: hash,
        }, { onConflict: 'source_hash', ignoreDuplicates: true });
      if (error) skipped++; else inserted++;
    }

    await supabase.from('sheets_sources')
      .update({ ultima_sincronizacao: new Date().toISOString() })
      .eq('id', sourceId);

    return new Response(JSON.stringify({
      success: true,
      message: `${inserted} comentário(s) sincronizados (${skipped} ignorados).`,
      inserted, skipped,
      classifyRequested: !!classify,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Erro' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
