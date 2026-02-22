import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64 } = await req.json();

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "PDF base64 is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting ALL checklist items from PDF");

    const extractionPrompt = `Você é um especialista em análise de checklists de supervisão do Checklist Fácil.

Analise este PDF de checklist de supervisão e extraia TODOS os itens/perguntas do checklist, independentemente se estão conformes ou não conformes.

IMPORTANTE: Extraia ABSOLUTAMENTE TODOS os itens, não apenas as falhas. Cada pergunta do checklist deve ser extraída.

Retorne um JSON com esta estrutura:
{
  "checklist_name": "<nome do checklist>",
  "total_items": <número total de itens>,
  "items": [
    {
      "item_text": "<texto completo da pergunta/item>",
      "category": "<categoria/seção onde o item se encontra no checklist>",
      "weight": <peso numérico do item, se disponível. Se não houver peso explícito, use 1>,
      "item_order": <número sequencial do item, começando em 1>
    }
  ]
}

INSTRUÇÕES:
1. Extraia TODOS os itens, conformes e não conformes
2. Mantenha o texto original de cada pergunta
3. Identifique a categoria/seção de cada item (ex: "Bar", "Cozinha", "Salão", etc.)
4. Se o checklist tiver pesos/pontuações por item, extraia o peso. Caso contrário, use 1
5. Mantenha a ordem original dos itens
6. Se houver subcategorias, inclua no campo category (ex: "Cozinha > Higiene")
7. Retorne APENAS o JSON, sem explicações adicionais`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: extractionPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia TODOS os itens deste checklist de supervisão, com seus pesos e categorias.",
              },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment required for AI service." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    let extractedData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse extraction results", rawContent: content }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Extracted ${extractedData.items?.length || 0} items from checklist`);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error extracting checklist items:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
