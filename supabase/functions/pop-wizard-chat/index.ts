// POP Wizard — chat com IA para sugerir/validar/ajustar mínimos de pessoas
// na tabela holding_staffing_config. Usa Lovable AI Gateway (Gemini 2.5 Pro)
// com tool calling para retornar mudanças estruturadas.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECTOR_LABELS: Record<string, string> = {
  chefe_subchefe_salao: "Chefe/Subchefe de Salão",
  garcom: "Garçom",
  cumin: "Cumin",
  hostess: "Hostess",
  caixa_delivery: "Caixa/Delivery",
  parrilla: "Parrilla",
  cozinha: "Cozinha",
  bar: "Bar",
  servicos_gerais_salao_bar: "Serviços Gerais Salão/Bar",
  producao: "Produção",
  sushi: "Sushi",
};

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface StaffingRow {
  sector_key: string;
  shift_type: "almoco" | "jantar";
  day_of_week: number;
  required_count: number;
  extras_count: number;
}

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

interface RequestBody {
  messages: Array<{ role: "user" | "assistant"; content: MessageContent }>;
  context: {
    brand: string;
    unitId: string;
    unitName?: string;
    monthYear: string;
    currentConfig: StaffingRow[];
    effectiveHeadcount: Record<string, number>;
    availableSectors: string[];
    sheetMatched?: boolean;
    sheetName?: string | null;
  };
  mode?: "wizard" | "validate" | "adjust";
}

function buildContextSummary(ctx: RequestBody["context"]): string {
  const sectorsList = ctx.availableSectors
    .map((k) => `- ${k} (${SECTOR_LABELS[k] ?? k}) — efetivo CLT atual: ${ctx.effectiveHeadcount[k] ?? 0}`)
    .join("\n");

  let configBlock = "Nenhuma configuração ainda — começar do zero.";
  if (ctx.currentConfig.length > 0) {
    const lines = ctx.currentConfig
      .sort((a, b) =>
        a.sector_key.localeCompare(b.sector_key) ||
        a.day_of_week - b.day_of_week ||
        a.shift_type.localeCompare(b.shift_type),
      )
      .map(
        (r) =>
          `${r.sector_key} | ${DAY_NAMES[r.day_of_week]} | ${r.shift_type} → mínimo=${r.required_count}, dobras=${r.extras_count}`,
      );
    configBlock = lines.join("\n");
  }

  return `
## Contexto operacional ativo
- Marca: ${ctx.brand}
- Unidade: ${ctx.unitName ?? ctx.unitId}
- Mês de referência: ${ctx.monthYear}

## Setores disponíveis nesta marca + efetivo CLT atual
${sectorsList}

## Configuração ATUAL de mínimos (holding_staffing_config)
${configBlock}
`.trim();
}

const POP_RULES = `
# REGRAS POP — MÍNIMOS DE PESSOAS (CajuPAR)

A "Tabela Mínima" define o piso obrigatório de colaboradores por setor + dia da semana + turno.
- required_count: mínimo de pessoas que DEVE estar no turno.
- extras_count: dobras autorizadas (reposição/cobertura). Usar SÓ quando necessário.
- Almoço = janela 12h-15h (mín 2h consecutivas). Jantar = janela 19h-22h.
- Almoço costuma ter required maior em SEX/SAB/DOM (alta demanda).
- Jantar concentra força em QUI/SEX/SAB.
- Setores essenciais que NÃO podem ficar sem alguém em nenhum turno aberto:
  garcom, cumin, cozinha, parrilla (quando houver), caixa_delivery.
- Hostess geralmente só no jantar e fim de semana no almoço.
- Bar reforça SEX/SAB à noite.
- O efetivo CLT contratado precisa ser >= soma dos picos semanais (caso contrário,
  sinalize o gap mas mantenha o mínimo necessário — NÃO reduza o mínimo só
  porque falta gente).
`.trim();

function buildSystemPrompt(ctx: RequestBody["context"], mode: string): string {
  const modeInstruction =
    mode === "validate"
      ? "MODO VALIDAÇÃO: revise a configuração atual, aponte furos (turnos zerados, picos sub-dimensionados, setores sem cobertura) e proponha correções diretamente (pode chamar a tool já na primeira resposta)."
      : mode === "adjust"
      ? "MODO AJUSTE: aplique exatamente o que o usuário pedir, mantendo as outras células inalteradas. Pode chamar a tool já na primeira resposta se o pedido estiver claro."
      : `MODO WIZARD (ENTREVISTA GUIADA): conduza uma entrevista curta antes de propor.

## Protocolo de entrevista (OBRIGATÓRIO neste modo)
- NUNCA chame a tool "propose_staffing_changes" na primeira resposta — exceto se o usuário disser explicitamente algo como "pode propor agora", "gere direto", "não me pergunte nada", "monte com o que tem".
- Faça UMA única pergunta por mensagem. Curta, objetiva, direto ao ponto. Nada de listas longas de perguntas.
- Cubra estes eixos antes de propor (PULE eixos que já estiverem claros pelas mensagens anteriores ou pelo contexto operacional):
  1. Objetivo principal (cobrir furos / reduzir custo / redimensionar para movimento novo / criar do zero)
  2. Escopo de setores (todos ou subconjunto — qual?)
  3. Escopo de dias da semana (todos / fim de semana / dias específicos)
  4. Escopo de turnos (almoço, jantar ou ambos)
  5. Restrições (não aumentar headcount, manter dobras atuais, teto de pessoas etc.)
  6. Particularidades de demanda (eventos, sazonalidade, dia atípico)
- Se o usuário responder com atalhos como "todos", "tudo", "qualquer", "você decide", "tanto faz" → marque o eixo como livre e PASSE PARA O PRÓXIMO eixo.
- Quando todos os eixos relevantes estiverem cobertos (ou o usuário pedir para propor), gere a proposta IMEDIATAMENTE chamando a tool no MESMO turno em que entrega a resposta. NÃO pergunte "posso gerar?" — apenas gere; o usuário revisa no painel de diff.
- Enquanto estiver perguntando, JAMAIS chame a tool. A tool só aparece junto com a proposta final.
- Mantenha cada pergunta com no máximo 2 linhas. Sem preâmbulos longos. Sem repetir contexto que o usuário já viu.`;

  return `Você é o POP Wizard, assistente especializado em planejar a Tabela Mínima de pessoas
da rede CajuPAR. Responde SEMPRE em português do Brasil, tom direto, sem emojis.

${modeInstruction}

${POP_RULES}

${buildContextSummary(ctx)}

## Regras gerais de saída
1. Quando for propor mudanças, explique brevemente o raciocínio (markdown conciso) e chame a tool "propose_staffing_changes" no mesmo turno, com APENAS as células que de fato mudam.
2. Use APENAS sector_key da lista de setores disponíveis. NUNCA invente setor novo.
3. day_of_week: 0=Domingo, 1=Segunda, ..., 6=Sábado.
4. shift_type: "almoco" ou "jantar".
5. Se for só pergunta ou conversa, responda no chat sem chamar a tool.

## Quando o usuário anexar um POP
- O anexo (texto rotulado como "## ANEXO: ..." ou imagem) é a FONTE PRIMÁRIA da Tabela Mínima.
- Mapeie cada linha/turno do POP para os \`sector_key\` válidos listados em "availableSectors". NÃO invente setor.
- Se um setor citado no POP não existir em \`availableSectors\` desta marca, IGNORE-O silenciosamente e mencione no \`summary\` como "não aplicável a esta marca" (típico em fluxo multi-unidade quando um POP corporativo cita setores que só existem em outra marca, ex.: Sushi fora do Nazo).
- Se o POP não detalhar algum dia/turno, use bom senso operacional (regras POP acima) e indique no \`reason\` da célula que foi inferido.
- Quando há anexo, NÃO faça entrevista — gere a proposta DIRETO na primeira resposta chamando a tool, cobrindo todos os 7 dias x 2 turnos para os setores presentes no POP e disponíveis nesta marca.
- No \`summary\` informe: setores cobertos, setores ignorados (se houver) e quantas células foram inferidas vs. extraídas literalmente.${
    ctx.sheetMatched
      ? `

## ATENÇÃO: ANEXO JÁ FILTRADO PARA ESTA UNIDADE
- O anexo foi pré-roteado client-side para a aba "${ctx.sheetName}" desta unidade.
- Confie 100% no conteúdo do anexo — NÃO procure por outras unidades nele.
- Os números desta aba são EXCLUSIVAMENTE da unidade "${ctx.unitName}".
- Notação "X+Y" em uma célula = X = required_count (CLT), Y = extras_count (dobra/freelancer planejado).`
      : ""
  }
`.trim();
}

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "propose_staffing_changes",
    description:
      "Propõe alterações na Tabela Mínima (holding_staffing_config). Inclua APENAS células que mudam.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Resumo curto (1-2 frases) das mudanças propostas.",
        },
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sector_key: { type: "string" },
              day_of_week: { type: "integer", minimum: 0, maximum: 6 },
              shift_type: { type: "string", enum: ["almoco", "jantar"] },
              required_count: { type: "integer", minimum: 0 },
              extras_count: { type: "integer", minimum: 0 },
              reason: { type: "string" },
            },
            required: [
              "sector_key",
              "day_of_week",
              "shift_type",
              "required_count",
              "extras_count",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "changes"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.messages?.length || !body?.context) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(body.context, body.mode ?? "adjust");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          ...body.messages,
        ],
        stream: true,
        tools: [TOOL_SCHEMA],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Aguarde alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (upstream.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos de IA esgotados. Adicione créditos em Configurações → Workspace.",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await upstream.text();
      console.error("AI gateway error:", upstream.status, txt);
      return new Response(
        JSON.stringify({ error: "Não consegui processar sua solicitação. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("pop-wizard-chat error:", e);
    return new Response(
      JSON.stringify({
        error: "Não consegui processar sua solicitação. Tente novamente.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
