// @ts-nocheck
// Endpoint público para n8n enviar reclamações automaticamente.
// Auth: Bearer token + slug na URL. Idempotente via índice de dedupe.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FONTES_VALIDAS = ["google", "ifood", "tripadvisor", "getin", "manual", "sheets"];
const TIPOS_VALIDOS = ["salao", "delivery"];

// ---------- helpers ----------
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatchLoja(nome: string, lojas: { id: string; nome: string }[]): string | null {
  if (!nome) return null;
  const target = normalize(nome);
  if (!target) return null;
  // exact
  const exact = lojas.find((l) => normalize(l.nome) === target);
  if (exact) return exact.id;
  // contains
  const contains = lojas.find(
    (l) => normalize(l.nome).includes(target) || target.includes(normalize(l.nome)),
  );
  return contains?.id ?? null;
}

function refMesFromDate(d: string): string {
  // d em YYYY-MM-DD
  return d.slice(0, 7);
}

// ---------- main ----------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    // slug está no path: /functions/v1/ingest-reclamacoes/<slug>
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];

    if (!slug || slug === "ingest-reclamacoes") {
      return jsonResponse(
        { success: false, error: "Slug do endpoint ausente. Use /ingest-reclamacoes/<slug>" },
        400,
      );
    }

    // bearer token
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) {
      return jsonResponse({ success: false, error: "Authorization Bearer token ausente" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // resolve endpoint
    const { data: endpoint, error: endpointErr } = await supabase
      .from("n8n_webhook_endpoints")
      .select("id, slug, secret_token, ativo, tipo_dado, loja_id_default, total_recebido")
      .eq("slug", slug)
      .maybeSingle();

    if (endpointErr || !endpoint) {
      return jsonResponse({ success: false, error: "Endpoint não encontrado" }, 404);
    }
    if (!endpoint.ativo) {
      return jsonResponse({ success: false, error: "Endpoint desativado" }, 403);
    }
    if (endpoint.secret_token !== token) {
      return jsonResponse({ success: false, error: "Token inválido" }, 401);
    }

    // parse payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: "JSON inválido" }, 400);
    }

    // aceita: { reclamacoes: [...] } ou um array direto ou um único objeto
    let lista: any[] = [];
    if (Array.isArray(body)) lista = body;
    else if (Array.isArray(body?.reclamacoes)) lista = body.reclamacoes;
    else if (body && typeof body === "object") lista = [body];

    if (!lista.length) {
      return jsonResponse(
        { success: false, error: "Payload vazio. Use { reclamacoes: [...] } ou um objeto." },
        400,
      );
    }

    // carrega lojas para fuzzy match
    const { data: lojas } = await supabase.from("config_lojas").select("id, nome");
    const lojasArr = (lojas || []) as { id: string; nome: string }[];

    let inseridas = 0;
    let duplicadas = 0;
    let invalidas = 0;
    const erros: any[] = [];

    for (let i = 0; i < lista.length; i++) {
      const raw = lista[i] || {};
      try {
        // resolve loja
        let lojaId: string | null = raw.loja_id || endpoint.loja_id_default || null;
        if (!lojaId && raw.loja) {
          lojaId = fuzzyMatchLoja(String(raw.loja), lojasArr);
        }
        if (!lojaId) {
          invalidas++;
          erros.push({ linha: i, motivo: "loja não identificada", recebido: raw.loja ?? null });
          continue;
        }

        const fonte = String(raw.fonte || "").toLowerCase();
        if (!FONTES_VALIDAS.includes(fonte) || fonte === "manual") {
          invalidas++;
          erros.push({
            linha: i,
            motivo: `fonte inválida (use: ${FONTES_VALIDAS.filter((f) => f !== "manual").join(", ")})`,
            recebido: raw.fonte,
          });
          continue;
        }

        const tipo = String(raw.tipo_operacao || "").toLowerCase();
        if (!TIPOS_VALIDOS.includes(tipo)) {
          invalidas++;
          erros.push({ linha: i, motivo: "tipo_operacao inválido (salao|delivery)", recebido: raw.tipo_operacao });
          continue;
        }

        const nota = Number(raw.nota_reclamacao);
        if (!Number.isFinite(nota) || nota < 1 || nota > 5) {
          invalidas++;
          erros.push({ linha: i, motivo: "nota_reclamacao deve ser 1..5", recebido: raw.nota_reclamacao });
          continue;
        }

        const dataRec = String(raw.data_reclamacao || new Date().toISOString().slice(0, 10));
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRec)) {
          invalidas++;
          erros.push({ linha: i, motivo: "data_reclamacao deve ser YYYY-MM-DD", recebido: raw.data_reclamacao });
          continue;
        }

        const row = {
          loja_id: lojaId,
          fonte,
          tipo_operacao: tipo,
          data_reclamacao: dataRec,
          nota_reclamacao: nota,
          texto_original: raw.texto_original ?? null,
          resumo_ia: raw.resumo_ia ?? null,
          temas: Array.isArray(raw.temas) ? raw.temas : [],
          palavras_chave: Array.isArray(raw.palavras_chave) ? raw.palavras_chave : [],
          anexo_url: raw.anexo_url ?? null,
          referencia_mes: refMesFromDate(dataRec),
        };

        // ON CONFLICT DO NOTHING via upsert no índice de dedupe
        const { data: inserted, error: insErr } = await supabase
          .from("reclamacoes")
          .insert(row)
          .select("id")
          .maybeSingle();

        if (insErr) {
          // 23505 = unique violation → considera duplicada
          if ((insErr as any).code === "23505") {
            duplicadas++;
          } else {
            invalidas++;
            erros.push({ linha: i, motivo: insErr.message });
          }
          continue;
        }

        if (inserted) inseridas++;
        else duplicadas++;
      } catch (e) {
        invalidas++;
        erros.push({ linha: i, motivo: e instanceof Error ? e.message : String(e) });
      }
    }

    const status = invalidas === 0 && erros.length === 0
      ? "success"
      : inseridas > 0
        ? "partial"
        : "error";

    // log da execução
    await supabase.from("n8n_webhook_executions").insert({
      endpoint_id: endpoint.id,
      status,
      payload_recebido: body,
      linhas_processadas: lista.length,
      linhas_inseridas: inseridas,
      linhas_duplicadas: duplicadas,
      linhas_invalidas: invalidas,
      erros: erros.slice(0, 100),
    });

    // atualiza endpoint
    await supabase
      .from("n8n_webhook_endpoints")
      .update({
        ultima_execucao_at: new Date().toISOString(),
        total_recebido: (endpoint.total_recebido || 0) + inseridas,
      })
      .eq("id", endpoint.id);

    return jsonResponse({
      success: true,
      status,
      processadas: lista.length,
      inseridas,
      duplicadas,
      invalidas,
      erros: erros.slice(0, 20),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ingest-reclamacoes error:", msg);
    return jsonResponse({ success: false, error: msg }, 500);
  }
});
