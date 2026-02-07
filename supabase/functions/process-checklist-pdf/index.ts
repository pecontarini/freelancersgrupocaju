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
    const { pdfBase64, pdfUrl } = await req.json();

    if (!pdfBase64 && !pdfUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "PDF base64 or URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing checklist PDF for data extraction");

    const extractionPrompt = `Você é um especialista em análise de relatórios de supervisão do Checklist Fácil.
    
Analise este PDF/planilha de auditoria de supervisão e extraia os seguintes dados em formato JSON:

{
  "global_score": <número entre 0 e 100 representando a nota global/percentual de conformidade>,
  "audit_date": "<data da auditoria no formato YYYY-MM-DD>",
  "unit_name": "<nome da unidade/loja auditada>",
  "area_scores": [
    {
      "area_name": "<nome da área/setor>",
      "score": <nota percentual da área>,
      "total_items": <total de itens avaliados na área>,
      "conforming_items": <itens conformes>
    }
  ],
  "failures": [
    {
      "item_name": "<nome do item não conforme>",
      "category": "<categoria/área do item conforme lista abaixo>",
      "detalhes_falha": "<texto do campo 'Comentário do item' ou 'Observação' que explica o problema encontrado>",
      "url_foto_evidencia": "<primeiro link/URL válido encontrado no campo 'Imagens' ou 'Fotos' ou 'Evidências'>"
    }
  ]
}

CATEGORIAS VÁLIDAS PARA CLASSIFICAÇÃO:
=== SETOR FRONT (Gerente de Front) ===
- SALÃO (Chefe de Salão): mesas, cadeiras, atendimento, ambiente, decoração, garçons
- DELIVERY (Chefe de APV): entregas, iFood, aplicativos, motoboys, expedição
- ASG (Chefe de APV): auxiliar serviços gerais, limpeza geral
- MANUTENÇÃO (Chefe de APV): ar condicionado, elétrica, hidráulica, equipamentos
- BRINQUEDOTECA (Chefe de APV): espaço kids, recreação infantil
- RECEPÇÃO (Chefe de APV): hostess, entrada, fila, reservas
- LAVAGEM (Chefe de APV): área de lavagem, louças, copa
- DOCUMENTOS (Chefe de APV): alvarás, licenças, certificados, registros
- ÁREA COMUM: corredores, banheiros, fachada, estacionamento

=== SETOR BACK (Gerente de Back) ===
- BAR (Chefe de Bar): bebidas, drinks, gelo, bartender
- COZINHA QUENTE (Chef de Cozinha): fogão, forno, fritadeira, cocção
- SALADAS/SOBREMESAS (Chef de Cozinha): frios, confeitaria, frutas
- PARRILLA (Chefe de Parrilla): churrasqueira, grelha, carnes
- SUSHI (Chefe de Sushi): culinária japonesa, peixe cru
- ESTOQUE: armazenamento, validade, recebimento, fornecedores
- DML: depósito material limpeza, produtos químicos

INSTRUÇÕES CRÍTICAS:
1. A nota global geralmente aparece como percentual de conformidade ou nota final
2. Extraia TODAS as áreas/setores com suas notas individuais
3. Extraia TODOS os itens marcados como "Não", "Não Conforme", "NC", "Reprovado" ou similares
4. Para cada falha, classifique na categoria mais apropriada da lista acima
5. MUITO IMPORTANTE: Capture o campo "Comentário do item" ou "Observação" que descreve o problema - salve em detalhes_falha
6. MUITO IMPORTANTE: Se houver coluna "Imagens" ou "Fotos" com URLs, extraia o PRIMEIRO link válido (http/https) e salve em url_foto_evidencia
7. Se o texto do item vier com um comentário entre parênteses (ex: "Pergunta...? (gordura acumulada)"), separe: item_name = "Pergunta..." e detalhes_falha = "gordura acumulada"
8. Identifique a unidade pelo nome da loja ou estabelecimento
9. Se não encontrar algum dado, use null
10. Retorne APENAS o JSON, sem explicações adicionais`;

    const messages: any[] = [
      { role: "system", content: extractionPrompt },
    ];

    if (pdfBase64) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise este PDF de checklist de supervisão e extraia os dados conforme solicitado.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:application/pdf;base64,${pdfBase64}`,
            },
          },
        ],
      });
    } else if (pdfUrl) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise este PDF de checklist de supervisão e extraia os dados conforme solicitado.",
          },
          {
            type: "image_url",
            image_url: {
              url: pdfUrl,
            },
          },
        ],
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
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
    
    console.log("AI extraction result:", content);

    // Parse the JSON from AI response
    let extractedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to parse extraction results",
          rawContent: content 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing checklist PDF:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
