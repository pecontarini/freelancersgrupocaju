// Edge function: gerar-escala-ia
// Lê turno_config + escala_minima da unidade/setor, chama Lovable AI Gateway (gpt-5),
// valida, persiste em escala_template e retorna { template_id, escala }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { setor, semana_inicio, unidade_id, modelo_folga } = await req.json();

    if (!setor || !semana_inicio || !unidade_id) {
      return json({ error: "Parâmetros obrigatórios: setor, semana_inicio, unidade_id" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: pop }, { data: config }] = await Promise.all([
      supabase
        .from("escala_minima")
        .select("dia_semana, turno, qtd_efetivos, qtd_extras")
        .eq("unidade_id", unidade_id)
        .eq("setor", setor),
      supabase
        .from("turno_config")
        .select("*")
        .eq("unidade_id", unidade_id)
        .eq("setor", setor)
        .maybeSingle(),
    ]);

    if (!pop?.length || !config) {
      return json({ error: "Configuração não encontrada para este setor." }, 404);
    }

    const tabelaMinima = DIAS.map((dia) => {
      const al = pop.find((r) => r.dia_semana === dia && (r.turno === "ALMOCO" || r.turno === "TARDE"));
      const ja = pop.find((r) => r.dia_semana === dia && r.turno === "JANTAR");
      return {
        dia,
        almoco_efetivos: al?.qtd_efetivos ?? 0,
        almoco_extras: al?.qtd_extras ?? 0,
        jantar_efetivos: ja?.qtd_efetivos ?? 0,
        jantar_extras: ja?.qtd_extras ?? 0,
      };
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const userPrompt = buildUserPrompt({
      setor,
      semana: semana_inicio,
      modeloFolga: (modelo_folga === "5x2" || modelo_folga === "6x1") ? modelo_folga : (config.modelo_folga ?? "6x1"),
      config: {
        qtd_abridores: config.qtd_abridores,
        qtd_fechadores: config.qtd_fechadores,
        qtd_intermediarios: config.qtd_intermediarios,
        observacoes: config.observacoes,
      },
      tabelaMinima,
    });

    const callGateway = async () => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 32000,
        response_format: { type: "json_object" },
      }),
    });

    let aiResp: Response | null = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        aiResp = await callGateway();
        if (aiResp.ok) break;
        if (aiResp.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
        if (aiResp.status === 402) return json({ error: "Créditos da Lovable AI esgotados." }, 402);
        lastErr = await aiResp.text();
        console.error(`AI gateway error (tentativa ${attempt}):`, aiResp.status, lastErr);
        // Retry apenas em 5xx
        if (aiResp.status < 500) break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.error(`AI gateway fetch falhou (tentativa ${attempt}):`, lastErr);
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    if (!aiResp || !aiResp.ok) {
      return json({ error: "Erro no AI Gateway", detail: lastErr || "Falha após 3 tentativas." }, 502);
    }


    const aiData = await aiResp.json();
    const rawText = aiData.choices?.[0]?.message?.content ?? "";
    const finishReason = aiData.choices?.[0]?.finish_reason;

    if (finishReason === "length") {
      return json({
        error: "Resposta da IA truncada (limite de tokens). Tente novamente — o setor pode ter muitos slots.",
        finish_reason: finishReason,
      }, 422);
    }

    let escala: any;
    try { escala = JSON.parse(rawText); }
    catch {
      // Tenta extrair JSON mesmo com texto extra ao redor
      try {
        const start = rawText.indexOf("{");
        const end = rawText.lastIndexOf("}");
        if (start !== -1 && end > start) {
          escala = JSON.parse(rawText.slice(start, end + 1));
        } else {
          throw new Error("no json");
        }
      } catch {
        return json({ error: "IA retornou JSON inválido.", raw: rawText, finish_reason: finishReason }, 422);
      }
    }

    const cltAlerts = escala?.validacao?.alertas_clt ?? [];
    if (!escala?.validacao?.aprovado || cltAlerts.length > 0) {
      return json({ error: "Violações CLT detectadas.", alertas: cltAlerts, escala }, 422);
    }

    // Validação extra: plano_folgas deve respeitar 6x1/5x2, demanda diária E mínimos por papel
    const plano = escala?.plano_folgas;
    const modeloUsado = (modelo_folga === "5x2" || modelo_folga === "6x1")
      ? modelo_folga
      : (config.modelo_folga ?? "6x1");
    const folgasPorVaga = modeloUsado === "5x2" ? 2 : 1;
    const alertasFolga: string[] = [];

    const papelDe = (tipo: string): "abridor" | "fechador" | "intermediario" | "outro" => {
      const t = String(tipo ?? "").toUpperCase();
      if (t.startsWith("ABRIDOR")) return "abridor";
      if (t.startsWith("FECHADOR")) return "fechador";
      if (t.startsWith("INTERMEDIARIO") || t.startsWith("INTERMEDIÁRIO")) return "intermediario";
      return "outro";
    };

    const minimos = {
      abridor: Number(config.qtd_abridores ?? 0),
      fechador: Number(config.qtd_fechadores ?? 0),
      intermediario: Number(config.qtd_intermediarios ?? 0),
    };

    if (!plano || !Array.isArray(plano.vagas) || plano.vagas.length === 0) {
      alertasFolga.push("plano_folgas.vagas ausente ou vazio.");
    } else {
      // Extras (reforços situacionais) não entram no ciclo semanal de folgas
      const isExtra = (v: any) => String(v.tipo ?? "").toUpperCase().startsWith("EXTRA");
      const vagasRegulares = plano.vagas.filter((v: any) => !isExtra(v));

      // Aviso (não-fatal) sobre divergência de folgas/vaga vs modelo.
      // Regra dura é o mínimo POP por papel/dia, validado abaixo.
      const avisosFolgaVaga: string[] = [];
      for (const v of vagasRegulares) {
        const f = Array.isArray(v.folgas) ? v.folgas.length : 0;
        if (f !== folgasPorVaga) {
          avisosFolgaVaga.push(`Vaga ${v.id_vaga ?? v.tipo}: ${f} folga(s), esperado ${folgasPorVaga} (${modeloUsado}).`);
        }
      }
      plano.avisos_folga_vaga = avisosFolgaVaga;
      const cobertura: Record<string, any> = {};
      for (const dia of DIAS) {
        const vagasNoDia = vagasRegulares.filter((v: any) => !(Array.isArray(v.folgas) && v.folgas.includes(dia)));
        const emCampo = vagasNoDia.length;
        const porPapel = { abridor: 0, fechador: 0, intermediario: 0, outro: 0 };
        for (const v of vagasNoDia) {
          porPapel[papelDe(v.papel ?? v.tipo)]++;
        }
        cobertura[dia] = { ...porPapel, headcount_total: emCampo };
        // Apenas abridor/fechador são mínimos POP duros (abertura/fechamento).
        // Intermediário é flexível: cobre demanda variável + folgas via headcount total.
        for (const p of ["abridor", "fechador"] as const) {
          if (minimos[p] > 0 && porPapel[p] < minimos[p]) {
            alertasFolga.push(`${dia}: ${porPapel[p]} ${p}(es) em campo < mínimo ${minimos[p]} (POP de abertura/fechamento).`);
          }
        }
      }
      plano.cobertura_por_dia_calc = cobertura;
      plano.minimos_por_papel_calc = minimos;
    }
    if (alertasFolga.length > 0) {
      escala.validacao = escala.validacao ?? {};
      escala.validacao.alertas_folga = alertasFolga;
      return json({
        error: "Plano de folgas viola mínimos POP por papel ou demanda diária.",
        alertas_folga: alertasFolga,
        escala,
      }, 422);
    }

    const { data: template, error: saveError } = await supabase
      .from("escala_template")
      .upsert(
        {
          unidade_id,
          setor,
          semana_inicio,
          status: "pendente_aprovacao",
          payload: escala,
          gerado_em: new Date().toISOString(),
        },
        { onConflict: "unidade_id,setor,semana_inicio" },
      )
      .select()
      .single();

    if (saveError) {
      console.error("save error", saveError);
      return json({ error: "Erro ao salvar.", detail: saveError.message }, 500);
    }

    return json({ template_id: template.id, escala });
  } catch (err) {
    console.error("gerar-escala-ia error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
