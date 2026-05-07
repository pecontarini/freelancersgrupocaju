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

    const [{ data: pop }, { data: config }, { data: sectorRow }] = await Promise.all([
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
      supabase
        .from("sectors")
        .select("id, name")
        .eq("unit_id", unidade_id),
    ]);

    if (!pop?.length || !config) {
      return json({ error: "Configuração não encontrada para este setor." }, 404);
    }

    // Resolver sector_id pelo nome (normalizado) para calcular headcount real do setor
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\s\-_]+/g, " ");
    const lemma = (s: string) => norm(s).replace(/m$/, "n").replace(/s$/, "");
    const setorNorm = norm(setor);
    const setorLemma = lemma(setor);
    const sectorRows = (sectorRow ?? []) as Array<{ id: string; name: string }>;
    let matchedSector =
      sectorRows.find((s) => norm(s.name) === setorNorm) ??
      [...sectorRows.filter((s) => lemma(s.name) === setorLemma)].sort((a, b) => a.name.length - b.name.length)[0] ??
      [...sectorRows.filter((s) => lemma(s.name).startsWith(setorLemma))].sort((a, b) => a.name.length - b.name.length)[0];

    let headcountMax = 0;
    if (matchedSector) {
      const { data: sjt } = await supabase
        .from("sector_job_titles")
        .select("job_title_id")
        .eq("sector_id", matchedSector.id);
      const jobIds = (sjt ?? []).map((r: any) => r.job_title_id).filter(Boolean);
      if (jobIds.length > 0) {
        const { count } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("unit_id", unidade_id)
          .eq("active", true)
          .in("job_title_id", jobIds);
        headcountMax = count ?? 0;
      }
    }
    // Fallback: se não conseguiu calcular, usa soma da config
    if (headcountMax <= 0) {
      headcountMax = Number(config.qtd_abridores ?? 0) + Number(config.qtd_fechadores ?? 0) + Number(config.qtd_intermediarios ?? 0);
    }
    console.log(`[gerar-escala-ia] setor=${setor} headcount_max=${headcountMax}`);

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
      headcount_max: headcountMax,
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
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 16000,
        response_format: { type: "json_object" },
      }),
    });

    let aiResp: Response | null = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        aiResp = await callGateway();
        if (aiResp.ok) break;
        if (aiResp.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
        if (aiResp.status === 402) return json({ error: "Créditos da Lovable AI esgotados." }, 402);
        lastErr = await aiResp.text();
        console.error(`AI gateway error (tentativa ${attempt}):`, aiResp.status, lastErr);
        if (aiResp.status < 500) break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.error(`AI gateway fetch falhou (tentativa ${attempt}):`, lastErr);
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
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
    // Só bloqueia se houver alertas CLT explícitos.
    // Ausência de bloco "validacao" ou "aprovado=false" sem alertas é tratada como aviso, não erro.
    if (cltAlerts.length > 0) {
      return json({ error: "Violações CLT detectadas.", alertas: cltAlerts, escala }, 422);
    }
    if (!escala?.validacao) {
      escala.validacao = { aprovado: true, alertas_clt: [], observacoes: "Bloco validacao ausente — assumido aprovado." };
    }

    // Validação extra: plano_folgas deve respeitar 6x1/5x2, demanda diária E mínimos por papel
    const plano = escala?.plano_folgas;
    const modeloUsado = (modelo_folga === "5x2" || modelo_folga === "6x1")
      ? modelo_folga
      : (config.modelo_folga ?? "6x1");
    const folgasPorVaga = modeloUsado === "5x2" ? 2 : 1;
    const alertasFolga: string[] = [];

    type Papel = "abridor" | "fechador" | "intermediario" | "outro";
    const papelDe = (tipo: unknown, papel?: unknown): Papel => {
      const candidatos = [tipo, papel].map((v) => String(v ?? "").toUpperCase());
      for (const t of candidatos) {
        if (t.startsWith("ABRIDOR") || t === "ABERTURA") return "abridor";
        if (t.startsWith("FECHADOR") || t === "FECHAMENTO") return "fechador";
        if (t.startsWith("INTERMEDIARIO") || t.startsWith("INTERMEDIÁRIO")) return "intermediario";
      }
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

      const demandaPorDia = plano.demanda_por_dia ?? {};
      const clone = (obj: any) => JSON.parse(JSON.stringify(obj));
      const templateParaPapel = (papel: Exclude<Papel, "outro">) => {
        const existente = vagasRegulares.find((v: any) => papelDe(v.tipo, v.papel) === papel);
        if (existente) return clone(existente);
        for (const dia of DIAS) {
          const slot = escala?.dias?.[dia]?.slots?.find((s: any) => papelDe(s.tipo) === papel);
          if (slot) {
            return {
              tipo: slot.tipo,
              papel,
              responsavel: !!slot.responsavel,
              folgas: [],
              horario_padrao: { t1: slot.t1, break_min: slot.break_min ?? 180, t2: slot.t2 },
            };
          }
        }
        return null;
      };

      // Garantir vagas suficientes por papel (abridor/fechador são mínimo POP)
      for (const papel of ["abridor", "fechador"] as const) {
        if (minimos[papel] <= 0) continue;
        const diasUteisPorVaga = Math.max(1, DIAS.length - folgasPorVaga);
        const vagasNecessarias = Math.ceil((minimos[papel] * DIAS.length) / diasUteisPorVaga);
        while (vagasRegulares.filter((v: any) => papelDe(v.tipo, v.papel) === papel).length < vagasNecessarias) {
          const base = templateParaPapel(papel);
          if (!base) break;
          base.id_vaga = `${papel}_auto_${vagasRegulares.length + 1}`;
          base.papel = papel;
          base.folgas = [];
          plano.vagas.push(base);
          vagasRegulares.push(base);
        }
      }

      // === DISTRIBUIÇÃO BALANCEADA DE FOLGAS PARA TODOS OS PAPÉIS ===
      // Pares 5x2 consecutivos rotativos (evita SEX+SAB), e dias únicos 6x1 rotativos.
      const pares5x2 = ["SEG-TER", "TER-QUA", "QUA-QUI", "DOM-SEG", "SEG-TER", "TER-QUA"];
      const dias6x1 = ["SEG", "TER", "QUA", "DOM", "QUI", "SEG", "TER", "QUA"];
      const papeis: Papel[] = ["abridor", "fechador", "intermediario", "outro"];
      // demandaPorDia já declarado acima
      let folgasPorDiaGlobal: Record<string, number> = {};

      // Distribui folgas dado um folgasPorVagaAtual (1 ou 2). Mutates vagas in place.
      const distribuirFolgas = (folgasPorVagaAtual: number) => {
        for (const v of vagasRegulares) v.folgas = [];
        folgasPorDiaGlobal = Object.fromEntries(DIAS.map((d) => [d, 0]));
        const totalFolgasSemanais = vagasRegulares.length * folgasPorVagaAtual;
        const tetoConcentracao = Math.max(1, Math.ceil(totalFolgasSemanais * 0.30) + 1);

        const escolherDiasParaVaga = (papel: Papel, idxNoPapel: number, minimoPapel: number, totalNoPapel: number): string[] => {
          const capacidadePapel = Math.max(0, totalNoPapel - minimoPapel);
          const podeFolgarNoDia = (dia: string, folgasPapelNoDia: Record<string, number>) =>
            folgasPapelNoDia[dia] < capacidadePapel && folgasPorDiaGlobal[dia] < tetoConcentracao;

          const folgasPapelNoDia = (vagasRegulares as any[])
            .filter((v) => papelDe(v.tipo, v.papel) === papel)
            .reduce((acc, v) => {
              for (const d of v.folgas ?? []) acc[d] = (acc[d] ?? 0) + 1;
              return acc;
            }, Object.fromEntries(DIAS.map((d) => [d, 0])) as Record<string, number>);

          if (folgasPorVagaAtual === 2) {
            const ordemPares = [...pares5x2.slice(idxNoPapel % pares5x2.length), ...pares5x2.slice(0, idxNoPapel % pares5x2.length)];
            for (const par of ordemPares) {
              const [d1, d2] = par.split("-");
              if (podeFolgarNoDia(d1, folgasPapelNoDia) && podeFolgarNoDia(d2, folgasPapelNoDia)) return [d1, d2];
            }
            const ordem = [...DIAS].sort((a, b) =>
              (Number(demandaPorDia[a] ?? 999) + folgasPorDiaGlobal[a] * 5) -
              (Number(demandaPorDia[b] ?? 999) + folgasPorDiaGlobal[b] * 5)
            );
            const escolhidas: string[] = [];
            for (const d of ordem) {
              if (escolhidas.length >= 2) break;
              if (podeFolgarNoDia(d, folgasPapelNoDia)) { escolhidas.push(d); folgasPapelNoDia[d]++; }
            }
            return escolhidas;
          } else {
            const ordemDias = [...dias6x1.slice(idxNoPapel % dias6x1.length), ...dias6x1.slice(0, idxNoPapel % dias6x1.length)];
            for (const d of ordemDias) if (podeFolgarNoDia(d, folgasPapelNoDia)) return [d];
            const ordem = [...DIAS].sort((a, b) =>
              (Number(demandaPorDia[a] ?? 999) + folgasPorDiaGlobal[a] * 5) -
              (Number(demandaPorDia[b] ?? 999) + folgasPorDiaGlobal[b] * 5)
            );
            for (const d of ordem) if (podeFolgarNoDia(d, folgasPapelNoDia)) return [d];
            return [];
          }
        };

        for (const papel of papeis) {
          const vagasDoPapel = vagasRegulares.filter((v: any) => papelDe(v.tipo, v.papel) === papel);
          if (vagasDoPapel.length === 0) continue;
          const minimoPapel = (papel === "abridor" || papel === "fechador") ? minimos[papel] : 0;
          vagasDoPapel.forEach((v: any, idx: number) => {
            const folgas = escolherDiasParaVaga(papel, idx, minimoPapel, vagasDoPapel.length);
            v.folgas = folgas;
            for (const d of folgas) folgasPorDiaGlobal[d]++;
          });
        }
      };

      const calcularCobertura = () => {
        const cobertura: Record<string, any> = {};
        const violacoes: string[] = [];
        for (const dia of DIAS) {
          const vagasNoDia = vagasRegulares.filter((v: any) => !(Array.isArray(v.folgas) && v.folgas.includes(dia)));
          const porPapel = { abridor: 0, fechador: 0, intermediario: 0, outro: 0 };
          for (const v of vagasNoDia) porPapel[papelDe(v.tipo, v.papel)]++;
          cobertura[dia] = { ...porPapel, headcount_total: vagasNoDia.length };
          for (const p of ["abridor", "fechador"] as const) {
            if (minimos[p] > 0 && porPapel[p] < minimos[p]) {
              violacoes.push(`${dia}: ${porPapel[p]} ${p}(es) em campo < mínimo ${minimos[p]} (POP de abertura/fechamento).`);
            }
          }
        }
        return { cobertura, violacoes };
      };

      // === ENFORCEMENT DO TETO DE HEADCOUNT ===
      const alertasCapacidade: string[] = [];
      let modeloFolgaAplicado = modeloUsado;
      let folgasPorVagaAtivo = folgasPorVaga;

      // 1ª distribuição com modelo solicitado
      distribuirFolgas(folgasPorVagaAtivo);

      // Se excede teto e estamos em 5x2, tentar 6x1
      if (vagasRegulares.length > headcountMax && folgasPorVagaAtivo === 2) {
        alertasCapacidade.push(
          `Setor tem ${headcountMax} pessoa(s) ativa(s) mas o POP exigiria ${vagasRegulares.length} vagas em 5x2. ` +
          `Modelo ajustado para 6x1 para caber no headcount.`,
        );
        folgasPorVagaAtivo = 1;
        modeloFolgaAplicado = "6x1";
        distribuirFolgas(folgasPorVagaAtivo);
      }

      // Se ainda excede, podar intermediários (LIFO) — nunca abridor/fechador
      if (vagasRegulares.length > headcountMax) {
        const excesso = vagasRegulares.length - headcountMax;
        let podados = 0;
        for (let i = vagasRegulares.length - 1; i >= 0 && podados < excesso; i--) {
          const v = vagasRegulares[i];
          if (papelDe(v.tipo, v.papel) === "intermediario") {
            const idxPlano = plano.vagas.indexOf(v);
            if (idxPlano >= 0) plano.vagas.splice(idxPlano, 1);
            vagasRegulares.splice(i, 1);
            podados++;
          }
        }
        if (podados > 0) {
          alertasCapacidade.push(
            `${podados} vaga(s) de intermediário podada(s) para respeitar teto de ${headcountMax} pessoa(s).`,
          );
          distribuirFolgas(folgasPorVagaAtivo);
        }
      }

      // Se MESMO assim excede (excesso é abridor/fechador): alertar mas não podar
      if (vagasRegulares.length > headcountMax) {
        alertasCapacidade.push(
          `ATENÇÃO: setor tem apenas ${headcountMax} pessoa(s) ativa(s), mas o POP de abertura/fechamento ` +
          `exige ${vagasRegulares.length} vagas. Contrate ${vagasRegulares.length - headcountMax} pessoa(s) ` +
          `ou reduza o POP em Cargos e Setores.`,
        );
      }

      // Cobertura final
      const { cobertura, violacoes } = calcularCobertura();
      for (const v of violacoes) alertasFolga.push(v);

      plano.headcount_total = vagasRegulares.length;
      plano.headcount_max = headcountMax;
      plano.headcount_usado = vagasRegulares.length;
      plano.modelo_folga_aplicado = modeloFolgaAplicado;
      plano.alertas_capacidade = alertasCapacidade;
      plano.distribuicao_folgas_por_dia = folgasPorDiaGlobal;
      plano.cobertura_por_dia_calc = cobertura;
      plano.minimos_por_papel_calc = minimos;

      const avisosFolgaVaga: string[] = [];
      for (const v of vagasRegulares) {
        const f = Array.isArray(v.folgas) ? v.folgas.length : 0;
        if (f !== folgasPorVagaAtivo) {
          avisosFolgaVaga.push(`Vaga ${v.id_vaga ?? v.tipo}: ${f} folga(s), esperado ${folgasPorVagaAtivo} (${modeloFolgaAplicado}).`);
        }
      }
      plano.avisos_folga_vaga = avisosFolgaVaga;
    }
    if (alertasFolga.length > 0) {
      escala.validacao = escala.validacao ?? {};
      escala.validacao.alertas_folga = alertasFolga;
      // Não bloqueia mais: alertas vão junto com a escala para o front exibir.
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
