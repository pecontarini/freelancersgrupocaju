// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";
const MAX_PREVIEW_ROWS = 200;

type Destino = "store_performance" | "store_performance_entries" | "reclamacoes" | "misto";

interface ExtractRequest {
  fileBase64: string;
  fileName: string;
  mimeType: string;
  hintDestino?: Destino;
  origem?: "upload_manual" | "cron_sheets" | "api";
  sourceUrl?: string;
}

function normalizeName(s: string): string {
  return (s || "")
    .toUpperCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ");
}

function similarity(a: string, b: string): number {
  const A = normalizeName(a);
  const B = normalizeName(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.includes(B) || B.includes(A)) return 0.85;
  const tokensA = new Set(A.split(" "));
  const tokensB = new Set(B.split(" "));
  const inter = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union ? inter / union : 0;
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function detectKind(name: string, mime: string): "xlsx" | "csv" | "pdf" | "image" | "unknown" {
  const lower = (name || "").toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("spreadsheet"))
    return "xlsx";
  if (lower.endsWith(".csv") || mime === "text/csv") return "csv";
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "unknown";
}

function parseSpreadsheet(bytes: Uint8Array): { headers: string[]; rows: any[][] } {
  const wb = XLSX.read(bytes, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const arr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  if (!arr.length) return { headers: [], rows: [] };
  const headers = (arr[0] || []).map((h: any) => String(h ?? "").trim());
  const rows = arr.slice(1).filter((r) => r.some((c: any) => String(c ?? "").trim() !== ""));
  return { headers, rows };
}

function rowsToObjects(headers: string[], rows: any[][]): Record<string, any>[] {
  return rows.map((r) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] ?? "";
    });
    return obj;
  });
}

const SCHEMA_DEFINITIONS = `
DESTINOS DISPONÍVEIS:
- "store_performance": dados mensais agregados por unidade. Colunas-alvo: loja_nome, month_year (YYYY-MM), faturamento (numeric), num_reclamacoes (int), nps_score (0-100), supervisao_score (0-100), tempo_prato_avg (minutos).
- "store_performance_entries": dados diários por unidade. Colunas-alvo: loja_nome, entry_date (YYYY-MM-DD), faturamento_salao, faturamento_delivery, reclamacoes_salao, reclamacoes_ifood.
- "reclamacoes": lista individual de reclamações. Colunas-alvo: loja_nome, data_reclamacao (YYYY-MM-DD), fonte (google|ifood|tripadvisor|getin|manual|sheets), tipo_operacao (salao|delivery), nota_reclamacao (0-5), texto_original (string), is_grave (bool).
`;

async function callAIForExtraction(opts: {
  kind: "xlsx" | "csv" | "pdf" | "image";
  sample?: { headers: string[]; rowsObj: Record<string, any>[] };
  fileBase64?: string;
  mimeType?: string;
  hintDestino?: Destino;
}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

  const tool = {
    type: "function",
    function: {
      name: "extract_dataset",
      description:
        "Mapeia um dataset de planilha/PDF/imagem para um dos três destinos do sistema e devolve as linhas normalizadas.",
      parameters: {
        type: "object",
        properties: {
          tipo_destino: {
            type: "string",
            enum: ["store_performance", "store_performance_entries", "reclamacoes"],
            description: "Tipo de tabela-destino mais adequado para os dados.",
          },
          confianca: {
            type: "number",
            description: "Confiança 0..1 do mapeamento.",
          },
          mapeamento_colunas: {
            type: "object",
            description:
              "Objeto onde cada chave é o nome da coluna original e cada valor é o nome do campo-alvo (ex.: { 'Vendas Brutas': 'faturamento' }).",
            additionalProperties: { type: "string" },
          },
          linhas: {
            type: "array",
            description:
              "Linhas extraídas e normalizadas. Cada item deve usar APENAS os campos-alvo do tipo_destino escolhido. Datas YYYY-MM-DD ou meses YYYY-MM. Valores numéricos sem símbolo.",
            items: { type: "object", additionalProperties: true },
          },
        },
        required: ["tipo_destino", "confianca", "mapeamento_colunas", "linhas"],
        additionalProperties: false,
      },
    },
  };

  const systemPrompt = `Você é um extrator de dados operacionais de restaurantes. Receberá amostra de planilha (cabeçalho + linhas) ou conteúdo visual (PDF/imagem). Devolva os dados normalizados via tool calling.

${SCHEMA_DEFINITIONS}

REGRAS:
- Datas: SEMPRE formato YYYY-MM-DD; meses YYYY-MM. Aceite DD/MM/YYYY na entrada e converta.
- Números: sem R$, sem pontos de milhar, vírgula vira ponto.
- Se uma coluna não tiver correspondente claro, omita do mapeamento (não invente).
- Nome da loja deve vir no campo "loja_nome" como texto puro.
- Se o usuário deu uma dica de destino, prefira respeitá-la.`;

  const userParts: any[] = [];

  if (opts.kind === "xlsx" || opts.kind === "csv") {
    const headerLine = opts.sample!.headers.join(" | ");
    const sampleLines = opts.sample!.rowsObj
      .slice(0, 30)
      .map((r) => JSON.stringify(r))
      .join("\n");
    userParts.push({
      type: "text",
      text: `Tipo: planilha (${opts.kind}).
Cabeçalho: ${headerLine}
Amostra (até 30 linhas):
${sampleLines}

Dica de destino: ${opts.hintDestino ?? "auto-detectar"}.

Retorne TODAS as linhas que conseguir interpretar (não só as 30 da amostra — extrapole o padrão).`,
    });
  } else {
    userParts.push({
      type: "text",
      text: `Tipo: ${opts.kind === "pdf" ? "PDF" : "imagem"} de relatório operacional.
Extraia todas as linhas tabulares visíveis.
Dica de destino: ${opts.hintDestino ?? "auto-detectar"}.`,
    });
    userParts.push({
      type: "image_url",
      image_url: { url: `data:${opts.mimeType};base64,${opts.fileBase64}` },
    });
  }

  const body = {
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userParts },
    ],
    tools: [tool],
    tool_choice: { type: "function", function: { name: "extract_dataset" } },
  };

  const resp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    if (resp.status === 429) {
      throw new Error("RATE_LIMIT: Limite de IA atingido. Tente novamente em 1 minuto.");
    }
    if (resp.status === 402) {
      throw new Error("CREDITS: Créditos da IA esgotados. Adicione créditos em Settings → Workspace → Usage.");
    }
    throw new Error(`AI_ERROR ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const json = await resp.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("IA não retornou tool_call estruturado.");
  let args: any;
  try {
    args = typeof call.function.arguments === "string" ? JSON.parse(call.function.arguments) : call.function.arguments;
  } catch {
    throw new Error("IA retornou tool_call com argumentos inválidos.");
  }
  return args as {
    tipo_destino: Destino;
    confianca: number;
    mapeamento_colunas: Record<string, string>;
    linhas: Record<string, any>[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    // Auth: user from Bearer (optional for cron)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    }

    const body: ExtractRequest = await req.json();
    if (!body.fileBase64 || !body.fileName) {
      throw new Error("fileBase64 e fileName são obrigatórios");
    }

    const kind = detectKind(body.fileName, body.mimeType ?? "");
    if (kind === "unknown") throw new Error("Tipo de arquivo não suportado.");

    const origem = body.origem ?? "upload_manual";

    // Cria job em estado extracting
    const { data: jobRow, error: jobErr } = await supabase
      .from("import_jobs")
      .insert({
        origem,
        tipo_destino: body.hintDestino ?? null,
        file_name: body.fileName,
        file_mime: body.mimeType,
        source_url: body.sourceUrl ?? null,
        ai_model: AI_MODEL,
        status: "extracting",
        created_by: userId,
      })
      .select()
      .single();
    if (jobErr) throw jobErr;
    const jobId = jobRow.id;

    let aiResult: Awaited<ReturnType<typeof callAIForExtraction>>;

    try {
      const bytes = decodeBase64(body.fileBase64);
      if (kind === "xlsx" || kind === "csv") {
        const parsed = parseSpreadsheet(bytes);
        if (!parsed.headers.length || !parsed.rows.length) {
          throw new Error("Planilha vazia ou sem cabeçalho legível.");
        }
        const sampleObj = rowsToObjects(parsed.headers, parsed.rows.slice(0, 30));
        aiResult = await callAIForExtraction({
          kind,
          sample: { headers: parsed.headers, rowsObj: sampleObj },
          hintDestino: body.hintDestino,
        });
        // Reaplica mapeamento sobre TODAS as linhas localmente
        const allObj = rowsToObjects(parsed.headers, parsed.rows);
        const mapped = allObj.map((row) => {
          const out: Record<string, any> = {};
          for (const [src, dst] of Object.entries(aiResult.mapeamento_colunas || {})) {
            if (dst && row[src] !== undefined) out[dst] = row[src];
          }
          return out;
        });
        aiResult.linhas = mapped;
      } else {
        aiResult = await callAIForExtraction({
          kind,
          fileBase64: body.fileBase64,
          mimeType: body.mimeType,
          hintDestino: body.hintDestino,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from("import_jobs")
        .update({ status: "error", erro: msg, confirmed_at: new Date().toISOString() })
        .eq("id", jobId);
      const status = msg.startsWith("RATE_LIMIT") ? 429 : msg.startsWith("CREDITS") ? 402 : 500;
      return new Response(JSON.stringify({ success: false, jobId, error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fuzzy match de lojas
    const { data: lojas } = await supabase.from("config_lojas").select("id, nome");
    const lojaList = lojas ?? [];

    const matchCache = new Map<string, { id: string | null; name: string }>();
    const matchLoja = (raw: string): { id: string | null; name: string } => {
      if (matchCache.has(raw)) return matchCache.get(raw)!;
      let best = { id: null as string | null, score: 0, name: "" };
      for (const l of lojaList) {
        const s = similarity(raw, l.nome);
        if (s > best.score) best = { id: l.id, score: s, name: l.nome };
      }
      const result = best.score >= 0.7 ? { id: best.id, name: best.name } : { id: null, name: raw };
      matchCache.set(raw, result);
      return result;
    };

    const lojasNaoMapeadasSet = new Set<string>();
    let linhasValidas = 0;
    const enriched = (aiResult.linhas || []).map((row) => {
      const rawNome = String(row.loja_nome ?? row.unidade ?? row.loja ?? "").trim();
      const matched = rawNome ? matchLoja(rawNome) : { id: null, name: "" };
      if (rawNome && !matched.id) lojasNaoMapeadasSet.add(rawNome);
      if (matched.id) linhasValidas++;
      return { ...row, loja_nome: rawNome, _matched_loja_id: matched.id };
    });

    const previewLines = enriched.slice(0, MAX_PREVIEW_ROWS);

    const updatePayload = {
      tipo_destino: aiResult.tipo_destino,
      ai_confianca: aiResult.confianca,
      mapeamento_colunas: aiResult.mapeamento_colunas,
      preview_data: { all: enriched, preview: previewLines },
      total_linhas: enriched.length,
      linhas_validas: linhasValidas,
      lojas_nao_mapeadas: Array.from(lojasNaoMapeadasSet),
      status: "preview_ready" as const,
    };

    const { error: updErr } = await supabase
      .from("import_jobs")
      .update(updatePayload)
      .eq("id", jobId);
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        tipo_destino: aiResult.tipo_destino,
        confianca: aiResult.confianca,
        total_linhas: enriched.length,
        linhas_validas: linhasValidas,
        preview: previewLines,
        lojas_nao_mapeadas: Array.from(lojasNaoMapeadasSet),
        mapeamento_colunas: aiResult.mapeamento_colunas,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ai-import-extract error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
