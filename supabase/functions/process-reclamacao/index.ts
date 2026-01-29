import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  texto: string;
}

// System prompt for complaint analysis
const SYSTEM_PROMPT = `Você é um assistente especializado em análise de reclamações de clientes de restaurantes.

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
    const { texto }: ProcessRequest = await req.json();

    if (!texto || texto.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Texto muito curto para análise.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use Lovable AI (Gemini)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lovable.dev',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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

    // Parse JSON from response
    let parsed;
    try {
      // Extract JSON from potential markdown code blocks
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

  } catch (error) {
    console.error('Process error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao processar.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
