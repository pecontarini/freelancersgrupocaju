// Edge function: gerar-escala-ia
// Recebe contexto operacional (funcionários, matriz POP, escalas existentes, ausências)
// + mensagens do chat e devolve uma proposta de escala via tool calling.
// O modelo é instruído a respeitar POP de Escalas + CLT, e a recusar
// qualquer pergunta fora desse escopo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const POP_RULES = `
# POP DE ESCALAS — REGRAS OBRIGATÓRIAS (Grupo Mult Foods / CajuPAR)

## Princípio
A escala existe para garantir o número MÍNIMO de colaboradores por setor/turno
da Tabela Mínima (POP 4.1). Nenhuma escala pode ficar abaixo desse piso.
Freelancer só depois de tentar realocação interna e banco de horas (POP 3.3.2 / 5.1.3).

## Tabela Mínima (POP 4.1) — piso obrigatório
- Define efetivo mínimo por setor + dia + turno (almoço/jantar).
- Reduzir é proibido. A escala parte SEMPRE da Tabela Mínima.

## Montagem (POP 4.2.5)
- Não escalar quem está em férias/aviso prévio/atestado/afastamento.
- Banco de horas perto de zero — nem positivo demais nem negativo.
- Equilibrar competência: não concentrar todos os experientes num único turno.

## Jornada (POP 4.2.5 + CLT)
- 44h/semana. Máx 10h/dia (8 + 2 extras), descontado intervalo.
- Dobra: intervalo entre os dois turnos do mesmo dia <= 4h.
- Intrajornada: 1h obrigatória se jornada > 6h (CLT art. 71).

## Descanso (POP 4.2.5 + CLT)
- 1 folga semanal (DSR). Pelo menos 1 domingo de folga no mês.
- Interjornada: mínimo 11h entre fim de um turno e início do próximo (CLT art. 66).

## Presença válida no turno (POP 5.2.4)
- Almoço: 2h consecutivas entre 12h-15h.
- Jantar: 2h consecutivas entre 19h-22h.

## Turnos canônicos
- T1 (almoço): 10:00-16:00 ou 09:30-17:30 com 1h pausa.
- T2 (jantar): 17:00-23:00 ou 18:00-00:00.
- T3 (corrido): 11:00-23:00 com pausa 15:00-18:00.
- meia: jornada curta (4-6h) sem pausa.
- off / vacation / sick_leave: sem trabalho.

## Prioridade ao faltar gente
1) Realocar de setor com sobra. 2) Banco de horas negativo. 3) Freelancer.
NUNCA reduzir abaixo do piso da Tabela Mínima sem comunicar.

## Escopo do assistente
- Você só responde sobre escalas. Para qualquer outra pergunta, responda exatamente:
  "Sou o assistente de escalas do POP CajuPAR. Só consigo ajudar com montagem
  de escala respeitando o POP e a CLT."
- Use APENAS funcionários da lista fornecida no contexto. Nunca invente nome/id.
- Sempre que propor escala, USE A FERRAMENTA propor_escala. Não devolva escala em texto.
- Antes da chamada da ferramenta, escreva 1-3 linhas explicando a estratégia
  (quem ficou de folga em qual dia, onde sobra/falta gente, etc.).
`.trim();

interface ContextEmployee {
  id: string;
  name: string;
  job_title: string | null;
  worker_type: string | null;
  weekly_hours_target: number;
}
interface ContextStaffing {
  sector_id: string;
  sector_name: string;
  day_of_week: number;
  shift_type: string;
  required_count: number;
}
interface ContextShift {
  employee_id: string;
  employee_name: string;
  date: string;
  schedule_type: string;
  shift_type?: string;
  start_time?: string | null;
  end_time?: string | null;
  break_min?: number;
  sector_id?: string | null;
}
interface ContextAbsence {
  employee_id: string;
  employee_name: string;
  date: string;
  reason: string;
}

interface RequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context: {
    weekDates: string[];
    sectorName: string;
    employees: ContextEmployee[];
    staffing: ContextStaffing[];
    existingShifts: ContextShift[];
    absences: ContextAbsence[];
  };
}

const TOOL_PROPOR_ESCALA = {
  type: "function",
  function: {
    name: "propor_escala",
    description:
      "Devolve a proposta de escala completa para a semana, respeitando POP de Escalas e CLT.",
    parameters: {
      type: "object",
      properties: {
        resumo: {
          type: "string",
          description:
            "1-3 frases explicando a lógica da escala proposta e onde, se houver, sobrou furo de cobertura.",
        },
        turnos: {
          type: "array",
          description: "Lista de turnos. Inclua TODOS os funcionários e TODOS os 7 dias da semana (off para folgas).",
          items: {
            type: "object",
            properties: {
              employee_id: { type: "string" },
              employee_name: { type: "string" },
              date: { type: "string", description: "YYYY-MM-DD" },
              schedule_type: {
                type: "string",
                enum: ["working", "off", "vacation", "sick_leave"],
              },
              shift_type: {
                type: "string",
                enum: ["T1", "T2", "T3", "meia"],
                description: "Obrigatório quando schedule_type=working.",
              },
              start_time: { type: "string", description: "HH:mm — vazio se off/férias/atestado." },
              end_time: { type: "string", description: "HH:mm — vazio se off/férias/atestado." },
              break_min: { type: "number", description: "Pausa em minutos (0 se sem pausa)." },
            },
            required: ["employee_id", "employee_name", "date", "schedule_type", "shift_type", "start_time", "end_time", "break_min"],
            additionalProperties: false,
          },
        },
        avisos: {
          type: "array",
          items: { type: "string" },
          description: "Avisos importantes (furos de cobertura, sugestões de freelancer, etc).",
        },
      },
      required: ["resumo", "turnos", "avisos"],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(ctx: RequestBody["context"]): string {
  const lines: string[] = [POP_RULES, "", "## CONTEXTO OPERACIONAL DESTA REQUISIÇÃO", ""];
  lines.push(`Setor: ${ctx.sectorName}`);
  lines.push(`Semana (segunda a domingo): ${ctx.weekDates.join(", ")}`);
  lines.push("");
  lines.push("### Funcionários disponíveis (use APENAS estes ids)");
  for (const e of ctx.employees) {
    lines.push(
      `- id=${e.id} | ${e.name} | ${e.job_title ?? "—"} | ${e.worker_type} | meta ${e.weekly_hours_target}h/sem`,
    );
  }
  lines.push("");
  lines.push("### Tabela Mínima POP (cobertura obrigatória)");
  const dowName = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  for (const r of ctx.staffing) {
    lines.push(`- ${dowName[r.day_of_week]} ${r.shift_type}: ${r.required_count} pessoa(s)`);
  }
  if (ctx.absences.length > 0) {
    lines.push("");
    lines.push("### Ausências confirmadas na semana (NÃO escalar)");
    for (const a of ctx.absences) {
      lines.push(`- ${a.employee_name} (${a.employee_id}) — ${a.date} — ${a.reason}`);
    }
  }
  if (ctx.existingShifts.length > 0) {
    lines.push("");
    lines.push("### Turnos já existentes (semana anterior/posterior — considere para interjornada 11h)");
    for (const s of ctx.existingShifts.slice(0, 60)) {
      lines.push(
        `- ${s.employee_name} ${s.date} ${s.start_time ?? "?"}-${s.end_time ?? "?"}${s.break_min ? ` pausa ${s.break_min}m` : ""}`,
      );
    }
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!Array.isArray(body.messages) || body.messages.length === 0 || !body.context) {
      return new Response(JSON.stringify({ error: "messages/context obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(body.context);

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          ...body.messages,
        ],
        tools: [TOOL_PROPOR_ESCALA],
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
            error:
              "Créditos do Lovable AI esgotados. Adicione créditos em Settings > Workspace > Usage.",
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
    let proposta: any = null;
    const toolCalls = choice?.tool_calls ?? [];
    if (Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        if (tc?.function?.name === "propor_escala") {
          try {
            proposta = JSON.parse(tc.function.arguments ?? "{}");
          } catch (e) {
            console.error("Falha ao parsear proposta:", e);
          }
        }
      }
    }

    return new Response(JSON.stringify({ text, proposta }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gerar-escala-ia error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
