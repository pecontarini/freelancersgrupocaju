import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedNFeItem {
  nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  unidade?: string;
}

interface ExtractedNFeData {
  numero_nf?: string;
  data_emissao?: string;
  fornecedor?: string;
  cnpj_fornecedor?: string;
  items: ExtractedNFeItem[];
  valor_total_nota?: number;
  confidence: "high" | "medium" | "low";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um especialista em extração de dados de Notas Fiscais Eletrônicas (NFe) brasileiras, especialmente de produtos alimentícios e carnes.
Analise a imagem fornecida e extraia os seguintes dados:

1. Número da Nota Fiscal
2. Data de Emissão (formato: DD/MM/YYYY)
3. Nome/Razão Social do Fornecedor
4. CNPJ do Fornecedor (formato: XX.XXX.XXX/XXXX-XX)
5. Lista de Itens com:
   - Nome do produto
   - Quantidade
   - Unidade de medida (kg, un, pc, etc.)
   - Valor Unitário
   - Valor Total do item
6. Valor Total da Nota

FOCO ESPECIAL EM:
- Cortes de carne (picanha, alcatra, costela, etc.)
- Porcionados e embalados
- Identificar corretamente a unidade (kg vs unidade)

IMPORTANTE:
- Retorne APENAS um JSON válido, sem markdown ou texto adicional
- Se não encontrar um campo, retorne null para ele
- Para valores monetários, retorne apenas números (sem R$)
- Para quantidades, retorne números decimais
- Avalie a confiança: "high" se texto claro e legível, "medium" se parcialmente legível, "low" se difícil de ler

Formato de resposta (JSON):
{
  "numero_nf": "123456" ou null,
  "data_emissao": "15/01/2025" ou null,
  "fornecedor": "Nome da Empresa" ou null,
  "cnpj_fornecedor": "00.000.000/0000-00" ou null,
  "items": [
    {
      "nome": "Picanha Angus 1kg",
      "quantidade": 10,
      "unidade": "kg",
      "valor_unitario": 89.90,
      "valor_total": 899.00
    }
  ],
  "valor_total_nota": 1500.00 ou null,
  "confidence": "high" | "medium" | "low"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia todos os itens e informações desta Nota Fiscal. Retorne apenas o JSON.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao processar documento com IA");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    // Parse the JSON response, handling potential markdown code blocks
    let extractedData: ExtractedNFeData;
    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }
      extractedData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Formato de resposta inválido");
    }

    return new Response(JSON.stringify(extractedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Extract NFe error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
