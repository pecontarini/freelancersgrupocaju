import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { failures, unitName, periodLabel, avgScore } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build sector summary
    const sectorCounts: Record<string, number> = {};
    const itemCounts: Record<string, number> = {};
    (failures || []).forEach((f: any) => {
      const sector = f.sector || "Outros";
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
      itemCounts[f.item_name] = (itemCounts[f.item_name] || 0) + 1;
    });

    const recurringItems = Object.entries(itemCounts)
      .filter(([, c]) => c >= 3)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => `${name} (${count}x)`);

    const sectorBreakdown = Object.entries(sectorCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => `${name}: ${count} falhas`)
      .join("\n");

    const systemPrompt = `Você é um consultor sênior de operações de restaurantes do Grupo Caju, especializado em auditorias operacionais e gestão de qualidade.

Analise os dados de auditoria fornecidos e retorne uma análise estruturada usando a ferramenta fornecida.

Contexto do negócio:
- Grupo Caju opera restaurantes com marcas Caminito, Nazo, Caju e Fosters
- Setores operacionais: Salão, Bar, Cozinha, Parrilla, Sushi, Estoque, DML, Delivery, ASG, Manutenção, Brinquedoteca, Recepção, Lavagem, Documentos
- Hierarquia: Chefes de Setor → Gerentes (Front/Back) → Diretoria
- Auditorias avaliam conformidade operacional, higiene, organização e processos`;

    const userPrompt = `Dados da auditoria:
- Unidade: ${unitName}
- Período: ${periodLabel}
- Nota média: ${avgScore !== null ? `${avgScore.toFixed(1)}%` : "N/A"}
- Total de falhas: ${(failures || []).length}

Distribuição por setor:
${sectorBreakdown || "Sem dados"}

Itens recorrentes (3+ vezes):
${recurringItems.length > 0 ? recurringItems.join("\n") : "Nenhum item recorrente"}

Lista de falhas (amostra das ${Math.min((failures || []).length, 50)} primeiras):
${(failures || [])
  .slice(0, 50)
  .map((f: any) => `- [${f.sector || "?"}] ${f.item_name}${f.detalhes ? `: ${f.detalhes}` : ""}`)
  .join("\n")}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "audit_analysis",
                description:
                  "Retorna a análise estruturada dos dados de auditoria",
                parameters: {
                  type: "object",
                  properties: {
                    resumo_executivo: {
                      type: "string",
                      description:
                        "Resumo executivo de 2-3 parágrafos para apresentação à diretoria. Tom profissional e direto.",
                    },
                    padroes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          titulo: { type: "string" },
                          descricao: { type: "string" },
                        },
                        required: ["titulo", "descricao"],
                        additionalProperties: false,
                      },
                      description:
                        "Padrões identificados (correlações temporais, setoriais, de processo)",
                    },
                    causas_raiz: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          causa: { type: "string" },
                          evidencia: { type: "string" },
                          setores_afetados: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        required: ["causa", "evidencia", "setores_afetados"],
                        additionalProperties: false,
                      },
                      description: "Causas raiz prováveis com evidências",
                    },
                    recomendacoes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          acao: { type: "string" },
                          prioridade: {
                            type: "string",
                            enum: ["alta", "media", "baixa"],
                          },
                          responsavel: { type: "string" },
                        },
                        required: ["acao", "prioridade", "responsavel"],
                        additionalProperties: false,
                      },
                      description:
                        "Recomendações priorizadas com responsáveis sugeridos",
                    },
                  },
                  required: [
                    "resumo_executivo",
                    "padroes",
                    "causas_raiz",
                    "recomendacoes",
                  ],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "audit_analysis" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao conectar com a IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: "A IA não retornou uma análise estruturada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-audit-patterns error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
