// Extracts utensils from a PDF stored in `utensilios-imports` bucket.
// Splits PDF into chunks of N pages, processes them in parallel via Lovable AI Gateway (Gemini Flash).
//
// Request body: { pdf_path: string }   (path inside `utensilios-imports` bucket)
// Response:     { items: ExtractedItem[], chunks: number, took_ms: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CHUNK_PAGES = 6;        // pages per AI call
const MAX_PARALLEL = 4;       // concurrent AI calls
const MODEL = "google/gemini-2.5-flash";

interface ExtractedItem {
  nome: string;
  qtd_minima: number;
  custo_unitario: number | null;
  fornecedor: string | null;
  setor: string | null;
}

const SYSTEM_PROMPT = `Você é um extrator de matrizes de estoque mínimo de restaurantes.
O PDF tem cards/tabelas. Cada item possui:
- Nome do utensílio (ex: "COPO AMER. 140ml", "PINÇA 30CM")
- Fornecedor (ex: "TRAMONTINA", "MERCADO LIVRE")
- Quantidade mínima (ex: "Qtd. Mín.: 700", às vezes "1 KIT" -> 1)
- Custo unitário em R$ (ex: "R$ 22,90" -> 22.90)
- Setor (ex: "SETOR BAR", "SETOR PARRILLA", "SETOR FOGÃO", "SETOR SALADA",
  "SETOR PRODUÇÃO", "SETOR ESTOQUE", "SETOR FINALIZAÇÃO", "SETOR DELIVERY",
  "SETOR LAVAGEM", "SETOR APOIO À VENDA", "SETOR SALÃO")

Extraia TODOS os itens. Use null quando ausente. Ignore página de "RESUMO FINANCEIRO POR SETOR".`;

function base64FromBytes(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

async function extractChunk(
  apiKey: string,
  chunkBase64: string,
  chunkLabel: string,
): Promise<ExtractedItem[]> {
  const t0 = Date.now();
  const aiResp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Extraia todos os utensílios deste trecho (${chunkLabel}).` },
              {
                type: "file",
                file: {
                  filename: "matriz.pdf",
                  file_data: `data:application/pdf;base64,${chunkBase64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_items",
              description: "Reporta lista de utensílios extraídos.",
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
          },
        ],
        tool_choice: { type: "function", function: { name: "report_items" } },
      }),
    },
  );

  if (!aiResp.ok) {
    const txt = await aiResp.text();
    console.error(`[${chunkLabel}] AI error ${aiResp.status}:`, txt.slice(0, 300));
    if (aiResp.status === 429) throw new Error("RATE_LIMIT");
    if (aiResp.status === 402) throw new Error("NO_CREDITS");
    throw new Error(`AI_ERROR_${aiResp.status}`);
  }

  const data = await aiResp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.warn(`[${chunkLabel}] No tool call returned. content=`,
      String(data?.choices?.[0]?.message?.content || "").slice(0, 200));
    return [];
  }
  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    const items = (parsed.items || []) as ExtractedItem[];
    console.log(`[${chunkLabel}] extracted ${items.length} items in ${Date.now() - t0}ms`);
    return items;
  } catch (e) {
    console.error(`[${chunkLabel}] JSON parse failed`, e);
    return [];
  }
}

async function processInPool<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  poolSize: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(poolSize, items.length) }, runner);
  await Promise.all(workers);
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = Date.now();
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({ error: "Server env not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const pdfPath: string | undefined = body?.pdf_path;
    if (!pdfPath) {
      return new Response(
        JSON.stringify({ error: "Missing pdf_path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[start] downloading utensilios-imports/${pdfPath}`);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: blob, error: dlErr } = await admin
      .storage.from("utensilios-imports").download(pdfPath);
    if (dlErr || !blob) {
      console.error("download error:", dlErr);
      return new Response(
        JSON.stringify({ error: `Falha ao baixar PDF: ${dlErr?.message || "unknown"}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const pdfBytes = new Uint8Array(await blob.arrayBuffer());
    console.log(`[downloaded] size=${(pdfBytes.length / 1024).toFixed(1)}KB`);

    // Split PDF into chunks
    const srcDoc = await PDFDocument.load(pdfBytes);
    const totalPages = srcDoc.getPageCount();
    console.log(`[pdf] totalPages=${totalPages}`);

    const chunkRanges: Array<[number, number]> = [];
    for (let s = 0; s < totalPages; s += CHUNK_PAGES) {
      chunkRanges.push([s, Math.min(s + CHUNK_PAGES, totalPages)]);
    }
    console.log(`[chunks] count=${chunkRanges.length} pagesPerChunk=${CHUNK_PAGES}`);

    const chunkBlobs = await Promise.all(chunkRanges.map(async ([start, end]) => {
      const sub = await PDFDocument.create();
      const indices = Array.from({ length: end - start }, (_, i) => start + i);
      const copied = await sub.copyPages(srcDoc, indices);
      copied.forEach(p => sub.addPage(p));
      const bytes = await sub.save();
      return { label: `pp ${start + 1}-${end}`, b64: base64FromBytes(bytes) };
    }));

    // Process chunks with bounded concurrency
    const allResults = await processInPool(
      chunkBlobs,
      (c) => extractChunk(LOVABLE_API_KEY, c.b64, c.label).catch((e) => {
        console.error(`chunk ${c.label} failed:`, e?.message || e);
        if (e?.message === "RATE_LIMIT" || e?.message === "NO_CREDITS") throw e;
        return [] as ExtractedItem[];
      }),
      MAX_PARALLEL,
    );

    const allItems = allResults.flat();

    // Deduplicate by normalized name + setor (chunks may overlap content visually)
    const seen = new Map<string, ExtractedItem>();
    for (const it of allItems) {
      const key = `${(it.nome || "").trim().toLowerCase()}|${(it.setor || "").trim().toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, it);
    }
    const items = Array.from(seen.values());

    // Best-effort cleanup of the uploaded PDF
    admin.storage.from("utensilios-imports").remove([pdfPath])
      .catch((e) => console.warn("cleanup failed:", e?.message));

    const took = Date.now() - t0;
    console.log(`[done] items=${items.length} (raw=${allItems.length}) tookMs=${took}`);
    return new Response(
      JSON.stringify({ items, chunks: chunkRanges.length, took_ms: took }),
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
    return new Response(
      JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
