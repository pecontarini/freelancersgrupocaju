import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedData {
  cnpj?: string;
  fornecedor?: string;
  numero_nf?: string;
  data_servico?: string;
  valor?: string;
  chave_pix?: string;
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

    const systemPrompt = `Você é um especialista em extração de dados de Notas Fiscais brasileiras, boletos e documentos fiscais.
Analise a imagem fornecida e extraia os seguintes dados, se disponíveis:

1. CNPJ do Fornecedor/Emissor (formato: XX.XXX.XXX/XXXX-XX)
2. Nome/Razão Social do Fornecedor
3. Número da Nota Fiscal ou DANFE
4. Data de Emissão/Serviço (formato: DD/MM/YYYY)
5. Valor Total (apenas números com vírgula decimal, ex: 1.234,56)
6. Chave PIX (se houver)

IMPORTANTE:
- Retorne APENAS um JSON válido, sem markdown ou texto adicional
- Se não encontrar um campo, retorne null para ele
- Para valores monetários, mantenha o formato brasileiro (1.234,56)
- Para CNPJ, mantenha a formatação com pontos e traços
- Avalie a confiança geral da extração: "high" se todos os campos principais foram encontrados claramente, "medium" se alguns campos estão parciais, "low" se a imagem é de baixa qualidade ou difícil de ler

Formato de resposta (JSON):
{
  "cnpj": "00.000.000/0000-00" ou null,
  "fornecedor": "Nome da Empresa" ou null,
  "numero_nf": "123456" ou null,
  "data_servico": "15/01/2025" ou null,
  "valor": "1.234,56" ou null,
  "chave_pix": "chave@pix.com" ou null,
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
                text: "Extraia os dados desta Nota Fiscal/Boleto. Retorne apenas o JSON.",
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
    let extractedData: ExtractedData;
    try {
      // Remove markdown code blocks if present
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
    console.error("Extract invoice error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
