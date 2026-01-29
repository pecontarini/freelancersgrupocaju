import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  texto?: string;
  imageBase64?: string;
  mimeType?: string;
}

// System prompt for complaint analysis from screenshot
const VISION_SYSTEM_PROMPT = `Você é um assistente especializado em análise de reclamações de clientes de restaurantes a partir de screenshots de avaliações.

Analise a imagem da avaliação e extraia:
1. "nota_estrelas": Número de estrelas visíveis (1-5). Se não houver estrelas visíveis, infira pela negatividade do texto.
2. "texto_reclamacao": O texto completo da reclamação/avaliação
3. "fonte": A plataforma detectada - deve ser exatamente uma de: "google", "ifood", "tripadvisor", "getin", ou "manual" se não identificável
4. "tipo_operacao": "salao" ou "delivery" baseado no contexto (menção a entrega, iFood, app = delivery; menção a garçom, mesa, ambiente = salao)
5. "resumo": Um resumo curto (max 100 caracteres) do problema principal
6. "temas": Array de até 3 temas principais (ex: "demora", "atendimento", "comida fria", "pedido errado")
7. "palavras_chave": Array de palavras-chave importantes extraídas do texto
8. "confianca": "alta", "media" ou "baixa" indicando confiança na extração

Regras de detecção de fonte:
- Logo do Google ou "Google" visível = "google"
- Logo do iFood, cores laranja/vermelho do iFood, ou "iFood" = "ifood"  
- Logo TripAdvisor ou "TripAdvisor" = "tripadvisor"
- Logo Get In ou "Get In" = "getin"

Responda APENAS com o JSON, sem texto adicional.`;

const TEXT_SYSTEM_PROMPT = `Você é um assistente especializado em análise de reclamações de clientes de restaurantes.

Analise o texto da reclamação e retorne um JSON com:
1. "resumo": Um resumo curto (max 100 caracteres) do problema principal
2. "temas": Array de até 3 temas principais (ex: "demora", "atendimento", "comida fria")
3. "tipo_operacao": "salao" ou "delivery" baseado no contexto
4. "nota_sugerida": 1-5 baseado na gravidade (1=muito grave, 5=leve)
5. "palavras_chave": Array de palavras-chave importantes

Responda APENAS com o JSON, sem texto adicional.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texto, imageBase64, mimeType }: ProcessRequest = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Image analysis mode
    if (imageBase64 && mimeType) {
      console.log('Processing image for complaint extraction...');
      
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: VISION_SYSTEM_PROMPT },
            { 
              role: 'user', 
              content: [
                { 
                  type: 'image_url', 
                  image_url: { 
                    url: `data:${mimeType};base64,${imageBase64}` 
                  } 
                },
                { type: 'text', text: 'Analise esta imagem de avaliação de restaurante e extraia todas as informações.' }
              ]
            },
          ],
          temperature: 0.2,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', errorText);
        throw new Error('Erro ao processar imagem com IA.');
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content || '';

      // Parse JSON from response
      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        console.error('Failed to parse AI response:', content);
        return new Response(
          JSON.stringify({ 
            error: 'Não foi possível extrair informações da imagem. Tente com uma imagem mais clara.',
            success: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Normalize and validate response
      const result = {
        success: true,
        nota_estrelas: Math.min(5, Math.max(1, parseInt(parsed.nota_estrelas) || 3)),
        texto_reclamacao: parsed.texto_reclamacao || '',
        fonte: ['google', 'ifood', 'tripadvisor', 'getin', 'manual'].includes(parsed.fonte) 
          ? parsed.fonte 
          : 'manual',
        tipo_operacao: parsed.tipo_operacao === 'delivery' ? 'delivery' : 'salao',
        resumo: parsed.resumo || 'Reclamação extraída de imagem',
        temas: Array.isArray(parsed.temas) ? parsed.temas.slice(0, 3) : [],
        palavras_chave: Array.isArray(parsed.palavras_chave) ? parsed.palavras_chave : [],
        confianca: parsed.confianca || 'media',
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Text analysis mode (legacy)
    if (texto) {
      if (texto.trim().length < 10) {
        return new Response(
          JSON.stringify({ error: 'Texto muito curto para análise.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: TEXT_SYSTEM_PROMPT },
            { role: 'user', content: texto },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', errorText);
        throw new Error('Erro ao processar com IA.');
      }

      const aiResponse = await response.json();
      const content = aiResponse.choices?.[0]?.message?.content || '';

      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        console.error('Failed to parse AI response:', content);
        return new Response(
          JSON.stringify({ 
            resumo: 'Análise não disponível',
            temas: [],
            tipo_operacao: 'salao',
            nota_sugerida: 3,
            palavras_chave: [],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(parsed),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Forneça uma imagem ou texto para análise.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Process error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao processar.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
