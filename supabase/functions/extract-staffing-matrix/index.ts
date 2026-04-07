const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em leitura de quadros operacionais de restaurantes. Sua tarefa é analisar a imagem de uma tabela de efetivo mínimo (POP) e extrair os dados estruturados.

A tabela contém:
- Setores (ex: GARÇOM + CHEFIAS, CUMINS, HOSTESS, COZINHA, etc.)
- Turnos (ex: ALMOÇO, JANTAR)
- Dias da semana (SEG, TER, QUA, QUI, SEX, SÁB, DOM)
- Quantidade de efetivos e extras por célula

REGRAS DE INTERPRETAÇÃO:
1. "5+2" significa efetivos=5, extras=2
2. "5" ou "05" significa efetivos=5, extras=0
3. "0+3" significa efetivos=0, extras=3
4. Ignore colunas como "Nº PESSOAS NECESSÁRIAS", "Nº DOBRAS", totais, subtotais.
5. Os dias da semana devem ser mapeados como números: SEG=0, TER=1, QUA=2, QUI=3, SEX=4, SÁB=5, DOM=6.
6. Se houver um nome de unidade no cabeçalho, extraia-o.
7. Se não conseguir ler um valor, use efetivos=0, extras=0.

Retorne APENAS um JSON estrito no formato:
{
  "unit_name": "Nome da unidade ou null",
  "sectors": [
    {
      "name": "GARÇOM + CHEFIAS",
      "shifts": [
        {
          "type": "ALMOÇO",
          "days": [
            { "day": 0, "efetivos": 6, "extras": 0 },
            { "day": 1, "efetivos": 7, "extras": 0 },
            { "day": 2, "efetivos": 6, "extras": 0 },
            { "day": 3, "efetivos": 6, "extras": 0 },
            { "day": 4, "efetivos": 7, "extras": 2 },
            { "day": 5, "efetivos": 8, "extras": 3 },
            { "day": 6, "efetivos": 5, "extras": 2 }
          ]
        }
      ]
    }
  ]
}

Retorne APENAS o JSON, sem explicações, markdown ou comentários.`;

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, mimeType } = await req.json();
    if (!image || !mimeType) {
      return jsonResponse({ error: "image (base64) e mimeType são obrigatórios" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${image}` },
              },
              {
                type: "text",
                text: "Analise esta imagem de tabela de efetivo mínimo e extraia todos os setores, turnos, dias e quantidades (efetivos + extras).",
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("AI gateway error:", res.status, errText);
      if (res.status === 429) {
        return jsonResponse({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }, 429);
      }
      if (res.status === 402) {
        return jsonResponse({ error: "Créditos de IA esgotados." }, 402);
      }
      return jsonResponse({ error: "Erro ao processar imagem com IA" }, 500);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response (may have markdown fences)
    let jsonStr = raw;
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    } else {
      // Try to find first { ... } block
      const braceMatch = raw.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    return jsonResponse(parsed);
  } catch (err) {
    console.error("extract-staffing-matrix error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});
