// Extracts utensils from a PDF stored in `utensilios-imports` bucket.
// Strategy:
// 1) Send the full PDF directly to Gemini (multimodal — accepts application/pdf).
//    Ask for items + normalized bbox of their photo per page.
// 2) Lazy-render only pages that have items with valid bbox using pdfjs-serverless
//    (Deno-compatible PDF.js fork) and crop the photos.
// 3) Upload crops to public `utensilios-photos` bucket.
//
// Request body: { pdf_path: string }   (path inside `utensilios-imports` bucket)
// Response:     { items: ExtractedItem[], pages: number, took_ms: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RENDER_SCALE = 2.0;       // raster scale for cropping (higher = sharper crops)
const MODEL = "google/gemini-2.5-flash";
const PHOTO_BUCKET = "utensilios-photos";

interface BBox { x: number; y: number; w: number; h: number; page_index: number; }
interface ExtractedItem {
  nome: string;
  qtd_minima: number;
  custo_unitario: number | null;
  fornecedor: string | null;
  setor: string | null;
  bbox?: BBox | null;
  foto_url?: string | null;
}

const SYSTEM_PROMPT = `Você é um extrator de matrizes de estoque mínimo de restaurantes a partir de PDF.
Cada página tem cards/células com:
- Foto/imagem do utensílio
- Nome do utensílio (ex: "COPO AMER. 140ml", "PINÇA 30CM")
- Fornecedor (ex: "TRAMONTINA", "MERCADO LIVRE")
- Quantidade mínima (ex: "Qtd. Mín.: 700", às vezes "1 KIT" -> 1)
- Custo unitário em R$ (ex: "R$ 22,90" -> 22.90)
- Setor (ex: "SETOR BAR", "SETOR PARRILLA", "SETOR FOGÃO", "SETOR SALADA",
  "SETOR PRODUÇÃO", "SETOR ESTOQUE", "SETOR FINALIZAÇÃO", "SETOR DELIVERY",
  "SETOR LAVAGEM", "SETOR APOIO À VENDA", "SETOR SALÃO")

Para CADA item visível, retorne também o bounding box NORMALIZADO da FOTO/IMAGEM do produto
(coordenadas 0..1 relativas à página onde ele aparece):
  bbox: { x, y, w, h, page_index }
- (x,y) = canto superior esquerdo da foto
- (w,h) = largura e altura da foto
- page_index = índice 0-based da página no PDF (página 1 = 0)

Se a foto não estiver clara, retorne bbox=null. Use null para campos ausentes.
Ignore página de "RESUMO FINANCEIRO POR SETOR".`;

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
              { type: "text", text: "Extraia TODOS os utensílios deste PDF. Para cada um, inclua page_index (0-based) e bbox da foto." },
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
            description: "Reporta lista de utensílios extraídos com bbox da foto.",
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
                      bbox: {
                        type: ["object", "null"],
                        properties: {
                          x: { type: "number" },
                          y: { type: "number" },
                          w: { type: "number" },
                          h: { type: "number" },
                          page_index: { type: "number" },
                        },
                        required: ["x", "y", "w", "h", "page_index"],
                        additionalProperties: false,
                      },
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

// Render a single PDF page to PNG bytes (only pages we need for cropping)
async function renderPage(pdfDoc: any, pageIndex: number): Promise<Uint8Array | null> {
  try {
    const page = await pdfDoc.getPage(pageIndex + 1); // pdfjs is 1-based
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const w = Math.ceil(viewport.width);
    const h = Math.ceil(viewport.height);

    // pdfjs-serverless doesn't ship a canvas — we render to an OffscreenCanvas-like API
    // via the @napi-rs/canvas polyfill it bundles. If render fails, return null.
    // Lazy import to avoid top-level cost when no crops are needed.
    const { createCanvas } = await import("https://esm.sh/@napi-rs/canvas@0.1.53");
    const canvas: any = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx as any, viewport }).promise;
    const png = canvas.toBuffer("image/png");
    return new Uint8Array(png);
  } catch (e) {
    console.warn(`renderPage(${pageIndex}) failed:`, (e as Error).message);
    return null;
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

async function cropAndUpload(
  admin: ReturnType<typeof createClient>,
  pageImage: Uint8Array,
  bbox: BBox,
): Promise<string | null> {
  const x = Math.max(0, Math.min(1, bbox.x));
  const y = Math.max(0, Math.min(1, bbox.y));
  const w = Math.max(0, Math.min(1 - x, bbox.w));
  const h = Math.max(0, Math.min(1 - y, bbox.h));
  if (w < 0.02 || h < 0.02) return null;

  try {
    const img = await Image.decode(pageImage);
    const px = Math.floor(x * img.width);
    const py = Math.floor(y * img.height);
    const pw = Math.max(8, Math.floor(w * img.width));
    const ph = Math.max(8, Math.floor(h * img.height));
    const cropped = img.clone().crop(px, py, pw, ph);
    const png = await cropped.encode();
    const fname = `imports/${crypto.randomUUID()}.png`;
    const { error: upErr } = await admin.storage.from(PHOTO_BUCKET).upload(fname, png, {
      contentType: "image/png",
      upsert: false,
    });
    if (upErr) {
      console.warn("upload crop failed:", upErr.message);
      return null;
    }
    const { data: pub } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(fname);
    return pub.publicUrl;
  } catch (e) {
    console.warn("crop failed:", (e as Error).message);
    return null;
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

    // 1) Send PDF directly to Gemini
    const allItems = await callAIWithPdf(LOVABLE_API_KEY, pdfBytes);

    // Deduplicate
    const seen = new Map<string, ExtractedItem>();
    for (const it of allItems) {
      const key = `${(it.nome || "").trim().toLowerCase()}|${(it.setor || "").trim().toLowerCase()}`;
      const prev = seen.get(key);
      if (!prev) { seen.set(key, it); continue; }
      if (!prev.bbox && it.bbox) seen.set(key, it);
    }
    const dedup = Array.from(seen.values());
    console.log(`[dedup] ${allItems.length} -> ${dedup.length}`);

    // 2) Lazy-render only pages with valid bboxes for crops
    const neededPages = new Set<number>();
    for (const it of dedup) {
      if (it.bbox && Number.isFinite(it.bbox.page_index)) {
        neededPages.add(Math.max(0, Math.floor(it.bbox.page_index)));
      }
    }

    let pageCount = 0;
    let pageImageMap = new Map<number, Uint8Array>();
    if (neededPages.size > 0) {
      try {
        const pdfDoc = await getDocument({ data: pdfBytes, useSystemFonts: true }).promise;
        pageCount = pdfDoc.numPages;
        const renders = await processInPool(
          Array.from(neededPages),
          async (pIdx) => {
            const png = await renderPage(pdfDoc, pIdx);
            if (png) pageImageMap.set(pIdx, png);
            return null;
          },
          3,
        );
        void renders;
      } catch (e) {
        console.warn("pdfjs render setup failed (skipping crops):", (e as Error).message);
      }
    }

    // 3) Crop & upload photos
    if (pageImageMap.size > 0) {
      await processInPool(
        dedup,
        async (it) => {
          if (!it.bbox) { delete it.bbox; return; }
          const pageImg = pageImageMap.get(it.bbox.page_index);
          if (pageImg) {
            const url = await cropAndUpload(admin, pageImg, it.bbox);
            it.foto_url = url;
          }
          delete it.bbox;
        },
        6,
      );
    } else {
      // No renders available — strip bboxes anyway
      for (const it of dedup) delete it.bbox;
    }
    const withPhotos = dedup.filter(d => d.foto_url).length;
    console.log(`[photos] uploaded=${withPhotos}/${dedup.length}`);

    // Cleanup uploaded PDF (best-effort)
    admin.storage.from("utensilios-imports").remove([pdfPath])
      .catch((e) => console.warn("cleanup failed:", e?.message));

    const took = Date.now() - t0;
    console.log(`[done] items=${dedup.length} photos=${withPhotos} tookMs=${took}`);
    return new Response(
      JSON.stringify({ items: dedup, pages: pageCount, took_ms: took }),
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
