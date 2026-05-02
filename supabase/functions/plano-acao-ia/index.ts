// Edge function: gera plano de ação operacional via Lovable AI (streaming SSE)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { unidade, frontScore, backScore, geralScore } = await req.json();

    if (!unidade) {
      return new Response(JSON.stringify({ error: "unidade is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fmt = (n: number | null | undefined) =>
      typeof n === "number" && !isNaN(n) ? `${n.toFixed(1)}%` : "N/D";

    const systemPrompt =
      "Você é um consultor operacional sênior especialista em restaurantes do Grupo CajuPAR (Caju Limão, Caminito Parrilla, Nazo Japanese, Foster's Burguer). Responda em português do Brasil, em Markdown, direto e acionável.";

    const userPrompt = `A unidade **${unidade}** apresenta os seguintes indicadores no checklist:
- Front Score: **${fmt(frontScore)}**
- Back Score: **${fmt(backScore)}**
- Geral: **${fmt(geralScore)}**

Crie um **plano de ação em 3 semanas** para elevar esses números acima de 85%. Estruture assim:

## Diagnóstico
2-3 frases sobre os pontos críticos.

## Semana 1 — Estabilização
Ações específicas por cargo:
- **Gerente de Front:** ...
- **Gerente de Back:** ...
- **Chefes de Setor:** ...

## Semana 2 — Padronização
Mesma estrutura por cargo.

## Semana 3 — Excelência
Mesma estrutura por cargo + indicador de sucesso mensurável.

## Acompanhamento
Como medir e revisar semanalmente.

Seja específico, evite genéricos. Use linguagem operacional de restaurante.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("Lovable AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("plano-acao-ia error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
