// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfirmRequest {
  jobId: string;
  lojaOverrides?: Record<string, string>; // { rawName: lojaId }
}

function parseNumber(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v)
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseInt0(v: any): number {
  return Math.round(parseNumber(v));
}

function normMonth(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  // DD/MM/YYYY → YYYY-MM
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}`;
  // MM/YYYY
  const m2 = s.match(/^(\d{2})\/(\d{4})/);
  if (m2) return `${m2[2]}-${m2[1]}`;
  return null;
}

function normDate(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const { jobId, lojaOverrides = {} }: ConfirmRequest = await req.json();
    if (!jobId) throw new Error("jobId é obrigatório.");

    const { data: job, error: jobErr } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (jobErr || !job) throw new Error("Job não encontrado.");
    if (job.status === "confirmed") {
      return new Response(
        JSON.stringify({ success: true, alreadyConfirmed: true, linhas_importadas: job.linhas_importadas }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    if (job.status !== "preview_ready") {
      throw new Error(`Job está em status '${job.status}', não pode ser confirmado.`);
    }

    const tipo = job.tipo_destino;
    const allRows: any[] = job.preview_data?.all ?? [];

    // Aplica overrides do usuário
    const enriched = allRows.map((r) => {
      let lojaId = r._matched_loja_id;
      const rawName = r.loja_nome;
      if (!lojaId && rawName && lojaOverrides[rawName]) {
        lojaId = lojaOverrides[rawName];
      }
      return { ...r, _matched_loja_id: lojaId };
    });

    let imported = 0;
    const errors: string[] = [];

    if (tipo === "store_performance") {
      const payload: any[] = [];
      for (const r of enriched) {
        if (!r._matched_loja_id) continue;
        const month = normMonth(r.month_year ?? r.mes ?? r.referencia_mes);
        if (!month) continue;
        payload.push({
          loja_id: r._matched_loja_id,
          month_year: month,
          faturamento: parseNumber(r.faturamento),
          num_reclamacoes: parseInt0(r.num_reclamacoes ?? r.reclamacoes),
          nps_score: r.nps_score != null ? parseNumber(r.nps_score) : null,
          supervisao_score: r.supervisao_score != null ? parseNumber(r.supervisao_score) : null,
          tempo_prato_avg: r.tempo_prato_avg != null ? parseNumber(r.tempo_prato_avg) : null,
        });
      }
      if (payload.length) {
        const { error } = await supabase
          .from("store_performance")
          .upsert(payload, { onConflict: "loja_id,month_year" });
        if (error) errors.push(error.message);
        else imported = payload.length;
      }
    } else if (tipo === "store_performance_entries") {
      const payload: any[] = [];
      for (const r of enriched) {
        if (!r._matched_loja_id) continue;
        const date = normDate(r.entry_date ?? r.data ?? r.data_referencia);
        if (!date) continue;
        payload.push({
          loja_id: r._matched_loja_id,
          entry_date: date,
          faturamento_salao: parseNumber(r.faturamento_salao ?? r.faturamento),
          faturamento_delivery: parseNumber(r.faturamento_delivery),
          reclamacoes_salao: parseInt0(r.reclamacoes_salao ?? r.reclamacoes),
          reclamacoes_ifood: parseInt0(r.reclamacoes_ifood),
          notes: `Importado via IA (job ${jobId})`,
        });
      }
      if (payload.length) {
        const { error } = await supabase
          .from("store_performance_entries")
          .upsert(payload, { onConflict: "loja_id,entry_date" });
        if (error) errors.push(error.message);
        else imported = payload.length;
      }
    } else if (tipo === "reclamacoes") {
      const payload: any[] = [];
      for (const r of enriched) {
        if (!r._matched_loja_id) continue;
        const date = normDate(r.data_reclamacao ?? r.data);
        if (!date) continue;
        const fonte = (r.fonte ?? "manual").toString().toLowerCase();
        const tipo_op = (r.tipo_operacao ?? "salao").toString().toLowerCase();
        payload.push({
          loja_id: r._matched_loja_id,
          data_reclamacao: date,
          referencia_mes: date.slice(0, 7),
          fonte: ["google", "ifood", "tripadvisor", "getin", "manual", "sheets"].includes(fonte) ? fonte : "manual",
          tipo_operacao: ["salao", "delivery"].includes(tipo_op) ? tipo_op : "salao",
          nota_reclamacao: parseNumber(r.nota_reclamacao ?? r.nota),
          texto_original: r.texto_original ?? r.texto ?? null,
          is_grave: !!r.is_grave,
        });
      }
      if (payload.length) {
        // Insert simples (não há unique constraint natural)
        const { error } = await supabase.from("reclamacoes").insert(payload);
        if (error) errors.push(error.message);
        else imported = payload.length;
      }
    } else {
      throw new Error("tipo_destino do job não é suportado.");
    }

    await supabase
      .from("import_jobs")
      .update({
        status: errors.length ? "error" : "confirmed",
        erro: errors.length ? errors.join("; ") : null,
        linhas_importadas: imported,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        linhas_importadas: imported,
        errors,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: errors.length ? 207 : 200,
      }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ai-import-confirm error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
