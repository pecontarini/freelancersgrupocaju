// Edge function: Agenda do Líder — chat conversacional para estruturar missões via IA
// Usa Lovable AI Gateway com tool calling. Não persiste no banco — devolve sugestões.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  tool_calls?: any;
  tool_call_id?: string;
}

interface AvailableUser {
  user_id: string;
  nome: string;
  cargo?: string | null;
  unidade?: string | null;
}

interface RequestBody {
  messages: ChatMessage[];
  available_users?: AvailableUser[];
  unidade_nome?: string | null;
}

const SYSTEM_PROMPT = (users: AvailableUser[], unidadeNome: string | null) => {
  const hoje = new Date().toISOString().slice(0, 10);
  return `Você é o assistente de governança operacional do Grupo CajuPAR (rede de restaurantes). Seu papel é traduzir o que o proprietário/gerente fala (ou cola de outra IA) em missões estruturadas, agrupadas por tópico e prontas para delegação.

CONTEXTO DA OPERAÇÃO:
- Unidade ativa: ${unidadeNome ?? "todas as unidades"}
- Cargos típicos: Proprietário, Gerente de Back, Gerente de Front, Chefe de Cozinha, Chefe de Parrilla, Chefe de Sushi, Chefe de Bar, Chefe de Salão, Supervisor Regional.
- Tópicos canônicos (use SEMPRE um destes em "topico"): "CMV", "Atendimento/NPS", "Manutenção", "Equipe/Escala", "Auditoria", "Treinamento", "Financeiro", "Outros".

USUÁRIOS DISPONÍVEIS PARA DELEGAÇÃO:
${users.length === 0 ? "(nenhum usuário cadastrado nesta unidade)" : users.map((u) => `- user_id=${u.user_id} | ${u.nome}${u.cargo ? ` (${u.cargo})` : ""}`).join("\n")}

COMO RESPONDER:
1. Acolha em português, tom direto e operacional (sem floreios).
2. Se o usuário COLOU um texto longo (>800 chars) ou estruturado (listas tipo "1. ... 2. ..." ou bullets), trate como BRIEFING JÁ ESTRUTURADO de outra IA: extraia TODOS os itens acionáveis (não resuma — pode gerar 5-15 missões), mantendo o agrupamento original quando fizer sentido.
3. Caso contrário, identifique de 1 a 5 missões claras.
4. Para cada missão preencha OBRIGATORIAMENTE:
   - topico: um dos tópicos canônicos acima.
   - titulo: curto (max 60 chars), começando por verbo no infinitivo ("Reduzir CMV de carnes").
   - descricao: 1-2 frases executivas com o "porquê".
   - prioridade: "alta" (bloqueia operação / risco financeiro), "media" (importante na semana), "baixa" (melhoria).
   - prazo: SEMPRE preencher data ISO YYYY-MM-DD. Se o usuário não disser, calcule a partir de hoje (${hoje}): alta=+3 dias, media=+7 dias, baixa=+14 dias.
   - responsavel_user_id: SEMPRE escolha o user_id mais aderente da lista. Só deixe vazio se REALMENTE nenhum cargo serve.
   - co_responsaveis: array (pode ser vazio).
   - plano_acao: SEMPRE 2 a 6 passos verificáveis no formato "verbo + objeto" ("Conferir saldo da câmara fria", "Treinar equipe no novo POP"). Cada passo com dia_semana (YYYY-MM-DD) distribuído entre hoje e o prazo.
5. SEMPRE use a ferramenta criar_missoes — nunca devolva missões só em texto.
6. No texto antes do tool_call, faça um resumo bem curto agrupado por tópico (ex: "Identifiquei 6 missões — CMV: 2, Atendimento: 1, Manutenção: 3.").
7. Se a fala for genuinamente vaga e curta (<100 chars sem anexo), faça UMA pergunta curta antes de inventar missões.
8. Se houver anexos (PDF de auditoria, prints de reclamação, relatórios, fotos), LEIA com atenção e priorize os pontos mais críticos como missões — cite trechos curtos do anexo na descrição quando ajudar.

Hoje é ${hoje}.`;
};

const TOOL_CRIAR_MISSOES = {
  type: "function",
  function: {
    name: "criar_missoes",
    description: "Estrutura missões operacionais a partir da conversa, com responsáveis e plano de ação.",
    parameters: {
      type: "object",
      properties: {
        missoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topico: {
                type: "string",
                enum: [
                  "CMV",
                  "Atendimento/NPS",
                  "Manutenção",
                  "Equipe/Escala",
                  "Auditoria",
                  "Treinamento",
                  "Financeiro",
                  "Outros",
                ],
                description: "Tópico/categoria que agrupa esta missão",
              },
              titulo: { type: "string" },
              descricao: { type: "string" },
              prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
              prazo: { type: "string", description: "YYYY-MM-DD (sempre preencher)" },
              responsavel_user_id: {
                type: "string",
                description: "user_id do responsável principal, ou string vazia se ninguém adequado",
              },
              co_responsaveis: {
                type: "array",
                items: { type: "string" },
                description: "Array de user_ids de co-responsáveis (pode ser vazio)",
              },
              plano_acao: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    descricao: { type: "string" },
                    dia_semana: { type: "string", description: "YYYY-MM-DD ou string vazia" },
                  },
                  required: ["descricao", "dia_semana"],
                  additionalProperties: false,
                },
              },
            },
            required: [
              "topico",
              "titulo",
              "descricao",
              "prioridade",
              "prazo",
              "responsavel_user_id",
              "co_responsaveis",
              "plano_acao",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["missoes"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fullMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT(body.available_users ?? [], body.unidade_nome ?? null) },
      ...body.messages,
    ];

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: fullMessages,
        tools: [TOOL_CRIAR_MISSOES],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições agora. Tente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Créditos do Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await upstream.text();
      console.error("AI gateway error", upstream.status, txt);
      return new Response(JSON.stringify({ error: "Falha no gateway de IA." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const choice = data?.choices?.[0]?.message ?? {};
    const text: string = choice?.content ?? "";
    let missoes: any[] = [];
    const toolCalls = choice?.tool_calls ?? [];
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        if (tc?.function?.name === "criar_missoes") {
          try {
            const parsed = JSON.parse(tc.function.arguments ?? "{}");
            if (Array.isArray(parsed?.missoes)) missoes = parsed.missoes;
          } catch (e) {
            console.error("Falha ao parsear missoes:", e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ text, missoes }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("agenda-lider-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
