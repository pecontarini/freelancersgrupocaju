// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AUTO_CONFIRM_THRESHOLD = 0.85;

function csvToBase64(csv: string): string {
  // CSV → arquivo CSV "puro" base64 para reaproveitar a edge ai-import-extract
  const bytes = new TextEncoder().encode(csv);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const { data: sources, error } = await supabase
      .from("sheets_sources")
      .select("id, nome, url, gid, tipo_dado")
      .eq("ativo", true)
      .eq("sync_diario", true);
    if (error) throw error;

    const results: any[] = [];

    for (const src of sources ?? []) {
      try {
        const csvUrl = src.url.includes("export?format=csv")
          ? src.url
          : `${src.url}${src.url.includes("?") ? "&" : "?"}format=csv${src.gid ? `&gid=${src.gid}` : ""}`;

        const csvResp = await fetch(csvUrl);
        if (!csvResp.ok) throw new Error(`HTTP ${csvResp.status} ao baixar CSV`);
        const csv = await csvResp.text();
        if (!csv.trim()) throw new Error("CSV vazio");

        // Chama a edge function de extração
        const extractResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-import-extract`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE}`,
          },
          body: JSON.stringify({
            fileBase64: csvToBase64(csv),
            fileName: `${src.nome}.csv`,
            mimeType: "text/csv",
            hintDestino: src.tipo_dado,
            origem: "cron_sheets",
            sourceUrl: src.url,
          }),
        });
        const extractJson = await extractResp.json();
        if (!extractJson.success) throw new Error(extractJson.error || "Falha ao extrair");

        // Auto-confirma se confiança alta e sem lojas pendentes
        const canAutoConfirm =
          extractJson.confianca >= AUTO_CONFIRM_THRESHOLD &&
          (extractJson.lojas_nao_mapeadas?.length ?? 0) === 0;

        let confirmed = false;
        let imported = 0;
        if (canAutoConfirm) {
          const confirmResp = await fetch(`${SUPABASE_URL}/functions/v1/ai-import-confirm`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE}`,
            },
            body: JSON.stringify({ jobId: extractJson.jobId }),
          });
          const confirmJson = await confirmResp.json();
          confirmed = confirmJson.success;
          imported = confirmJson.linhas_importadas ?? 0;
        }

        await supabase
          .from("sheets_sources")
          .update({ ultima_execucao_cron: new Date().toISOString(), ultima_sincronizacao: new Date().toISOString() })
          .eq("id", src.id);

        results.push({
          source: src.nome,
          jobId: extractJson.jobId,
          confianca: extractJson.confianca,
          confirmed,
          imported,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`Erro na fonte ${src.nome}:`, msg);
        results.push({ source: src.nome, error: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("cron-import-sheets error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
