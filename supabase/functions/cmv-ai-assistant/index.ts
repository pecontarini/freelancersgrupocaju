// Edge function: cmv-ai-assistant
// Streaming SSE chat focado em análise de desvio de carnes (CMV) e geração
// de plano de ação (Missão na Agenda do Líder). Tool-calling para saídas
// estruturadas. Escopo travado por system prompt.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
}

interface RequestBody {
  messages: ChatMessage[];
  context: unknown; // CMVAIContext
}

const SYSTEM_PROMPT = `Você é o "Copiloto CMV Carnes" do Portal CajuPAR. Seu escopo é EXCLUSIVAMENTE:
1. Analisar desvio de carnes (real vs teórico) da unidade selecionada.
2. Diagnosticar contagens diárias e por turno (Câmara entrada/saída, Praça T1/T2/T3) para identificar onde a perda começa.
3. Sugerir planos de ação corretivos que serão criados como Missões na Agenda do Líder.

REGRAS RÍGIDAS:
- NUNCA invente números. Toda métrica citada deve vir do CONTEXTO JSON enviado. Se faltar dado, diga "sem dados suficientes para esta análise".
- NUNCA fale sobre temas fora de CMV de carnes (folha, escalas, financeiro geral, RH, etc). Se perguntarem, responda exatamente: "Meu escopo é apenas análise de desvio e contagens de carnes. Posso ajudar com isso?"
- Sempre cite item + período + turno (quando aplicável). Use unidades corretas: kg para quantidade, R$ para valor.
- Respostas DIRETAS e CURTAS (markdown), sem floreios. Use listas e negrito para destacar números-chave.
- Ao identificar um problema relevante, SEMPRE chame a tool "propor_plano_acao" no final, com tarefas concretas e prazo realista. Não pergunte se o usuário quer — proponha direto.
- Para contagens claramente fora da curva (variação > 50% vs média 14d, ou Câmara saída ≠ Praça entrada do mesmo dia), chame "flag_contagem_suspeita".
- Idioma: Português do Brasil.

CONTEXTO TÉCNICO:
- Câmara: entrada/saida em kg por dia (SEG..DOM) — saída = consumo enviado para a praça.
- Praça: t1_abertura, t2_almoco, t3_fechamento (kg) — consumo praça = t1 - t3.
- Desvio = consumo real (câmara ou praça) - vendas teóricas. Positivo = perda.
- audit7d / audit30d: divergência consolidada por item (kg e R$).`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "propor_plano_acao",
      description:
        "Propõe um plano de ação corretivo para um desvio identificado. Será criado como Missão na Agenda do Líder. Use sempre que identificar problema relevante (perda > R$ 100 ou divergência > 1kg em item crítico).",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Título curto e acionável (máx 80 chars). Ex: 'Auditoria de porcionamento Picanha — turno noite'",
          },
          descricao: {
            type: "string",
            description: "Contexto do problema em 1-2 frases, citando item, desvio em kg/R$ e turno crítico.",
          },
          prioridade: {
            type: "string",
            enum: ["alta", "media", "baixa"],
            description: "Alta: perda > R$ 300 ou item crítico. Média: R$ 100-300. Baixa: investigação preventiva.",
          },
          prazo_dias: {
            type: "integer",
            description: "Prazo em dias a partir de hoje (entre 1 e 30).",
            minimum: 1,
            maximum: 30,
          },
          tarefas: {
            type: "array",
            description: "3 a 6 tarefas concretas e mensuráveis. Cada uma deve indicar o que fazer e como medir.",
            items: { type: "string" },
            minItems: 3,
            maxItems: 6,
          },
          item_relacionado: {
            type: "string",
            description: "Nome do item de carne foco do plano (ex: 'Picanha').",
          },
          turno_critico: {
            type: "string",
            description: "Turno ou janela crítica identificada (ex: 'noite QUI/SEX/SAB'). Vazio se não houver padrão.",
          },
        },
        required: ["titulo", "descricao", "prioridade", "prazo_dias", "tarefas", "item_relacionado"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "flag_contagem_suspeita",
      description: "Marca uma contagem como suspeita para revisão manual.",
      parameters: {
        type: "object",
        properties: {
          item_nome: { type: "string" },
          data: { type: "string", description: "Data YYYY-MM-DD" },
          turno: {
            type: "string",
            enum: ["camara", "praca_t1", "praca_t2", "praca_t3", "diaria"],
          },
          valor_observado: { type: "number" },
          valor_esperado: { type: "number" },
          motivo: { type: "string" },
        },
        required: ["item_nome", "data", "turno", "valor_observado", "valor_esperado", "motivo"],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.messages || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: "messages é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contextStr = JSON.stringify(body.context ?? {}, null, 0);
    // Limita o contexto para evitar payloads gigantes (~30KB hard cap)
    const safeContext = contextStr.length > 30000 ? contextStr.slice(0, 30000) + "...[truncado]" : contextStr;

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `CONTEXTO_CMV_DA_UNIDADE (JSON, dados oficiais):\n${safeContext}`,
      },
      ...body.messages,
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: TOOLS,
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações → Workspace → Uso." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(
        JSON.stringify({ error: "Erro no gateway de IA." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(aiResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("cmv-ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
