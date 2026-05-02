// Receives a rendered PDF page as a JPEG/PNG data URL and asks Gemini to identify
// each utensil card visible: returns { nome, bbox: [x,y,w,h] in % of the image }.
// Cropping is done by the client to keep this function fast and small.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você analisa páginas de uma matriz visual de utensílios de restaurante.
Cada página contém vários cards/células, cada um com:
- uma FOTO do utensílio
- um NOME impresso (ex: "COPO AMER. 140ml", "PINÇA 30CM", "FACA DO CHEF 8\"")
- demais textos (fornecedor, qtd, preço, setor)

Para CADA card visível, retorne:
- nome: o nome impresso do utensílio (apenas o nome, sem fornecedor/setor)
- bbox: caixa delimitadora APENAS DA FOTO (não do card inteiro, não do texto), em PORCENTAGEM da imagem total: [x, y, largura, altura], com x,y do canto superior esquerdo.

Ignore páginas de "RESUMO FINANCEIRO POR SETOR" ou similares (sem utensílios).
Se não houver fotos identificáveis, retorne items vazio.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { image_data_url } = await req.json();
    if (!image_data_url || typeof image_data_url !== "string" || !image_data_url.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "Missing image_data_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Identifique cada utensílio nesta página: nome impresso e bbox da foto (% da imagem)." },
              { type: "image_url", image_url: { url: image_data_url } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_locations",
            description: "Lista de utensílios localizados na página.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      nome: { type: "string" },
                      bbox: {
                        type: "array",
                        items: { type: "number" },
                        minItems: 4, maxItems: 4,
                        description: "[x, y, width, height] em porcentagem 0-100",
                      },
                    },
                    required: ["nome", "bbox"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_locations" } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI error", aiResp.status, txt.slice(0, 300));
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
      const msg = aiResp.status === 429 ? "Limite de IA atingido"
        : aiResp.status === 402 ? "Créditos de IA esgotados"
        : "Erro na IA";
      return new Response(JSON.stringify({ error: msg }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const tc = data?.choices?.[0]?.message?.tool_calls?.[0];
    let items: any[] = [];
    if (tc) {
      try { items = JSON.parse(tc.function.arguments).items || []; }
      catch (e) { console.error("parse failed", e); }
    }
    return new Response(JSON.stringify({ items }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("locate-utensilios-in-page failed:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
