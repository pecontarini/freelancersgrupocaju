// Extracts utensils from a PDF stored in `utensilios-imports` bucket.
// 1) Renders each page to PNG via pdfium-deno.
// 2) Sends page images to Gemini Flash and asks for items WITH normalized bbox of their photo.
// 3) Crops bbox out of the rendered page and uploads to public `utensilios-photos` bucket.
// 4) Returns items with `foto_url` pre-filled.
//
// Request body: { pdf_path: string }   (path inside `utensilios-imports` bucket)
// Response:     { items: ExtractedItem[], pages: number, took_ms: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as mupdf from "https://esm.sh/mupdf@1.3.0";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAGES_PER_CALL = 2;       // imagens por chamada à IA
const MAX_PARALLEL = 4;         // chamadas concorrentes à IA
const RENDER_DPI = 144;         // qualidade do raster (px = pt * dpi/72)
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

const SYSTEM_PROMPT = `Você é um extrator de matrizes de estoque mínimo de restaurantes a partir de IMAGENS de páginas.
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
- page_index = índice 0-based da imagem na sequência enviada

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

async function renderAllPages(pdfBytes: Uint8Array): Promise<Uint8Array[]> {
  // pdfium-deno: PDFiumDocument.load + page.render
  const doc = await pdfium.PDFiumDocument.fromBytes(pdfBytes);
  const out: Uint8Array[] = [];
  const scale = RENDER_DPI / 72;
  for (let i = 0; i < doc.pageCount; i++) {
    const page = doc.getPage(i);
    const { width, height } = page.size; // points
    const px = Math.round(width * scale);
    const py = Math.round(height * scale);
    const png = await page.render({ width: px, height: py, format: "png" });
    out.push(png);
    page.close?.();
  }
  doc.close?.();
  return out;
}

async function callAI(
  apiKey: string,
  pageImages: Uint8Array[],
  startIndex: number,
  label: string,
): Promise<ExtractedItem[]> {
  const t0 = Date.now();
  const content: any[] = [
    { type: "text", text: `Extraia todos os utensílios destas ${pageImages.length} páginas (${label}). page_index 0 = primeira imagem desta lista.` },
  ];
  for (const png of pageImages) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${bytesToBase64(png)}` },
    });
  }

  const aiResp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
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
    console.error(`[${label}] AI ${aiResp.status}:`, txt.slice(0, 300));
    if (aiResp.status === 429) throw new Error("RATE_LIMIT");
    if (aiResp.status === 402) throw new Error("NO_CREDITS");
    throw new Error(`AI_ERROR_${aiResp.status}`);
  }

  const data = await aiResp.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.warn(`[${label}] no tool call`);
    return [];
  }
  try {
    const parsed = JSON.parse(toolCall.function.arguments);
    const items = (parsed.items || []) as ExtractedItem[];
    // re-base page_index para o índice global
    for (const it of items) {
      if (it.bbox && Number.isFinite(it.bbox.page_index)) {
        it.bbox.page_index = startIndex + Math.max(0, Math.floor(it.bbox.page_index));
      }
    }
    console.log(`[${label}] ${items.length} items in ${Date.now() - t0}ms`);
    return items;
  } catch (e) {
    console.error(`[${label}] JSON parse failed`, e);
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

async function cropAndUpload(
  admin: ReturnType<typeof createClient>,
  pageImages: Uint8Array[],
  item: ExtractedItem,
): Promise<string | null> {
  const b = item.bbox;
  if (!b) return null;
  if (b.page_index < 0 || b.page_index >= pageImages.length) return null;
  const x = Math.max(0, Math.min(1, b.x));
  const y = Math.max(0, Math.min(1, b.y));
  let w = Math.max(0, Math.min(1 - x, b.w));
  let h = Math.max(0, Math.min(1 - y, b.h));
  if (w < 0.02 || h < 0.02) return null; // bbox degenerado

  try {
    const img = await Image.decode(pageImages[b.page_index]);
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

    // Render all pages first (used for both AI input and cropping)
    let pageImages: Uint8Array[] = [];
    try {
      pageImages = await renderAllPages(pdfBytes);
      console.log(`[rendered] pages=${pageImages.length} dpi=${RENDER_DPI}`);
    } catch (e) {
      console.error("pdfium render failed:", (e as Error).message);
      return new Response(JSON.stringify({ error: "Falha ao rasterizar PDF." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group pages into AI calls
    const groups: { start: number; pages: Uint8Array[]; label: string }[] = [];
    for (let s = 0; s < pageImages.length; s += PAGES_PER_CALL) {
      const slice = pageImages.slice(s, s + PAGES_PER_CALL);
      groups.push({ start: s, pages: slice, label: `pp ${s + 1}-${s + slice.length}` });
    }
    console.log(`[groups] count=${groups.length} pagesPerCall=${PAGES_PER_CALL}`);

    const allResults = await processInPool(
      groups,
      (g) => callAI(LOVABLE_API_KEY, g.pages, g.start, g.label).catch((e) => {
        console.error(`group ${g.label} failed:`, e?.message || e);
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
      const prev = seen.get(key);
      if (!prev) { seen.set(key, it); continue; }
      // prefer the one with a bbox
      if (!prev.bbox && it.bbox) seen.set(key, it);
    }
    const dedup = Array.from(seen.values());
    console.log(`[dedup] ${allItems.length} -> ${dedup.length}`);

    // Crop & upload photos in parallel (bounded)
    await processInPool(
      dedup,
      async (it) => {
        const url = await cropAndUpload(admin, pageImages, it);
        it.foto_url = url;
        delete it.bbox;
      },
      6,
    );
    const withPhotos = dedup.filter(d => d.foto_url).length;
    console.log(`[photos] uploaded=${withPhotos}/${dedup.length}`);

    // Cleanup uploaded PDF (best-effort)
    admin.storage.from("utensilios-imports").remove([pdfPath])
      .catch((e) => console.warn("cleanup failed:", e?.message));

    const took = Date.now() - t0;
    console.log(`[done] items=${dedup.length} photos=${withPhotos} tookMs=${took}`);
    return new Response(
      JSON.stringify({ items: dedup, pages: pageImages.length, took_ms: took }),
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
