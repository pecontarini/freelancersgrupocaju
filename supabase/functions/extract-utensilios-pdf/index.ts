// Extracts utensils metadata from a PDF stored in `utensilios-imports` bucket.
// Strategy: send the full PDF directly to Gemini (multimodal — accepts application/pdf)
// and ask for structured items via tool calling. Photo cropping was removed because
// PDF rasterization libraries available on esm.sh are not compatible with the Deno
// edge runtime. Photos can be generated afterwards via `generate-utensilio-image`.
//
// Request body: { pdf_path: string }   (path inside `utensilios-imports` bucket)
// Response:     { items: ExtractedItem[], took_ms: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

interface ExtractedItem {
  nome: string;
  qtd_minima: number;
  custo_unitario: number | null;
  fornecedor: string | null;
  setor: string | null;
  foto_url?: string | null;
}

const SYSTEM_PROMPT = `Você é um extrator de matrizes de estoque mínimo de restaurantes a partir de PDF.
Cada página tem cards/células com:
- Foto/imagem do utensílio (ignore a foto, extraia só os dados textuais)
- Nome do utensílio (ex: "COPO AMER. 140ml", "PINÇA 30CM")
- Fornecedor (ex: "TRAMONTINA", "MERCADO LIVRE")
- Quantidade mínima (ex: "Qtd. Mín.: 700", às vezes "1 KIT" -> 1)
- Custo unitário em R$ (ex: "R$ 22,90" -> 22.90)
- Setor (ex: "SETOR BAR", "SETOR PARRILLA", "SETOR FOGÃO", "SETOR SALADA",
  "SETOR PRODUÇÃO", "SETOR ESTOQUE", "SETOR FINALIZAÇÃO", "SETOR DELIVERY",
  "SETOR LAVAGEM", "SETOR APOIO À VENDA", "SETOR SALÃO")

Use null para campos ausentes. Ignore a página de "RESUMO FINANCEIRO POR SETOR".
Retorne TODOS os utensílios visíveis no PDF.`;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

async function callAIWithPdf(
  apiKey: string,
  pdfBytes: Uint8Array,
): Promise<ExtractedItem[]> {
  const t0 = Date.now();
  const pdfBase64 = bytesToBase64(pdfBytes);

  const aiResp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia TODOS os utensílios deste PDF de matriz de estoque mínimo." },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_items",
            description: "Reporta lista de utensílios extraídos do PDF.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string" },
                      qtd_minima: { type: "number" },
                      custo_unitario: { type: ["number", "null"] },
                      fornecedor: { type: ["string", "null"] },
                      setor: { type: ["string", "null"] },
                    },
                    required: ["nome", "qtd_minima"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_items" } },
      }),
    },
  );

  if (!aiResp.ok) {
    const txt = await aiResp.text();
    console.error(`AI ${aiResp.status}:`, txt.slice(0, 500));
    if (aiResp.status === 429) throw new Error("RATE_LIMIT");
    if (aiResp.status === 402) throw new Error("NO_CREDITS");
    throw new Error(`AI_ERROR_${aiResp.status}`);
  }

  const data = await aiResp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.warn("no tool call in AI response");
    return [];
  }
  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    const items = (parsed.items || []) as ExtractedItem[];
    console.log(`[AI] ${items.length} items in ${Date.now() - t0}ms`);
    return items;
  } catch (e) {
    console.error("JSON parse failed", e);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "Server env not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const pdfPath: string | undefined = body?.pdf_path;
    if (!pdfPath) {
      return new Response(JSON.stringify({ error: "Missing pdf_path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    console.log(`[start] downloading ${pdfPath}`);
    const { data: blob, error: dlErr } = await admin.storage.from("utensilios-imports").download(pdfPath);
    if (dlErr || !blob) {
      console.error("download error:", dlErr);
      return new Response(JSON.stringify({ error: `Falha ao baixar PDF: ${dlErr?.message || "unknown"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const pdfBytes = new Uint8Array(await blob.arrayBuffer());
    console.log(`[downloaded] size=${(pdfBytes.length / 1024).toFixed(1)}KB`);

    if (pdfBytes.length > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "PDF muito grande (limite 20MB)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allItems = await callAIWithPdf(LOVABLE_API_KEY, pdfBytes);

    // Deduplicate by name + sector
    const seen = new Map<string, ExtractedItem>();
    for (const it of allItems) {
      const key = `${(it.nome || "").trim().toLowerCase()}|${(it.setor || "").trim().toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, { ...it, foto_url: null });
    }
    const dedup = Array.from(seen.values());
    console.log(`[dedup] ${allItems.length} -> ${dedup.length}`);

    // Cleanup uploaded PDF (best-effort)
    admin.storage.from("utensilios-imports").remove([pdfPath])
      .catch((e) => console.warn("cleanup failed:", e?.message));

    const took = Date.now() - t0;
    console.log(`[done] items=${dedup.length} tookMs=${took}`);
    return new Response(
      JSON.stringify({ items: dedup, took_ms: took }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("extract-utensilios-pdf failed:", e?.message || e);
    const msg = e?.message === "RATE_LIMIT"
      ? "Limite da IA atingido. Tente novamente em instantes."
      : e?.message === "NO_CREDITS"
      ? "Créditos da IA esgotados. Adicione créditos em Configurações > Workspace > Uso."
      : (e?.message || "Erro desconhecido");
    const status = e?.message === "RATE_LIMIT" ? 429
                 : e?.message === "NO_CREDITS" ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
