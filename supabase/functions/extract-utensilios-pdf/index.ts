// Extracts a structured list of utensils (name, qty min, cost, supplier, sector)
// from a PDF using Lovable AI Gateway (Gemini multimodal).
// The PDF is sent as base64 inline_data to Gemini.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractedItem {
  nome: string;
  qtd_minima: number;
  custo_unitario: number | null;
  fornecedor: string | null;
  setor: string | null;
}

const SYSTEM_PROMPT = `Você é um extrator de dados de matrizes de estoque mínimo operacional de restaurantes.
Receberá um PDF que contém tabelas/cards com utensílios. Cada item tem:
- Nome do utensílio (ex: "COPO AMER. 140ml", "BARMAT 30X45", "PINÇA 30CM")
- Fornecedor (ex: "TRAMONTINA", "BARTENDER STORE", "MERCADO LIVRE")
- Quantidade mínima (ex: "Qtd. Mín.: 700", às vezes "1 KIT")
- Custo unitário em R$ (ex: "Custo un.: R$ 22,90")
- Setor (ex: "SETOR BAR", "SETOR PARRILLA", "SETOR FOGÃO", "SETOR SALÃO & APV", "SETOR SALADA", "SETOR PRODUÇÃO", "SETOR ESTOQUE", "SETOR FINALIZAÇÃO", "SETOR IFOOD / DELIVERY", "SETOR LAVAGEM", "SETOR APOIO À VENDA")

Extraia TODOS os itens encontrados no documento. Para cada item:
- nome: nome exato do utensílio (em maiúsculas se assim aparecer, preserve unidades como "140ml", "30CM")
- qtd_minima: número inteiro. Se vier "1 KIT" use 1.
- custo_unitario: número decimal em reais. Para "R$ 22,90" retorne 22.90. Use null se ausente.
- fornecedor: nome do fornecedor em texto. null se ausente.
- setor: o setor ao qual o item pertence (use o título da seção da página). null se incerto.

Ignore cabeçalhos, rodapés, e a página de "RESUMO FINANCEIRO POR SETOR".`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const pdfBase64: string | undefined = body?.pdf_base64;
    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ error: "Missing pdf_base64" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Extraia todos os utensílios do PDF anexo e retorne via tool call.",
                },
                {
                  type: "file",
                  file: {
                    filename: "matriz.pdf",
                    file_data: `data:application/pdf;base64,${pdfBase64}`,
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
                description:
                  "Reporta a lista completa de utensílios extraídos do PDF.",
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
      console.error("AI gateway error:", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições da IA atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos em Configurações > Workspace > Uso." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `AI gateway error [${aiResp.status}]` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "IA não retornou os itens estruturados." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: { items: ExtractedItem[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Falha ao interpretar a resposta da IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ items: parsed.items ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extract-utensilios-pdf failed:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
