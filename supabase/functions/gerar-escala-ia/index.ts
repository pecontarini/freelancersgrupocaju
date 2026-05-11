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
    let headcountVinculado = 0;
    let headcountEquivalente = 0;
    const alertasHeadcount: string[] = [];

    // Carrega todos os cargos da unidade para fazer match por nome (resolve o caso
    // de "Garcom" vs "Garçom" não vinculados ao mesmo setor).
    const { data: allJobs } = await supabase
      .from("job_titles")
      .select("id, name")
      .eq("unit_id", unidade_id);
    const jobsList = (allJobs ?? []) as Array<{ id: string; name: string }>;

    // Vínculo direto (sector_job_titles)
    let sjtJobIds: string[] = [];
    if (matchedSector) {
      const { data: sjt } = await supabase
        .from("sector_job_titles")
        .select("job_title_id")
        .eq("sector_id", matchedSector.id);
      sjtJobIds = (sjt ?? []).map((r: any) => r.job_title_id).filter(Boolean);
      if (sjtJobIds.length > 0) {
        const { count } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("unit_id", unidade_id)
          .eq("active", true)
          .in("job_title_id", sjtJobIds);
        headcountVinculado = count ?? 0;
      }
    }

    // Match por nome do cargo (independente de vínculo SJT) para o mesmo setor lógico.
    // Ex.: setor=GARCOM ⇒ cargos cujo nome normalizado é equivalente a "garcom".
    const setorNormForJob = setorLemma; // já normalizado e singularizado
    const jobMatchesSetor = (jobName: string) => {
      const n = lemma(jobName);
      if (n === setorNormForJob) return true;
      // sinônimos comuns por setor
      if (setorNormForJob === "garcon" || setorNormForJob === "garco") {
        return n === "garcon" || n === "garco" || n.startsWith("garc");
      }
      if (setorNormForJob === "atendimento" || setorNormForJob === "salao") {
        return n.startsWith("atend") || n === "salao" || n.startsWith("garc");
      }
      return false;
    };
    const equivalentJobIds = jobsList.filter((j) => jobMatchesSetor(j.name)).map((j) => j.id);
    if (equivalentJobIds.length > 0) {
      const { count } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", unidade_id)
        .eq("active", true)
        .in("job_title_id", equivalentJobIds);
      headcountEquivalente = count ?? 0;
    }

    headcountMax = Math.max(headcountVinculado, headcountEquivalente);

    // Alerta se houver cargo equivalente fora do vínculo do setor
    if (headcountEquivalente > headcountVinculado) {
      const semVinculo = jobsList
        .filter((j) => jobMatchesSetor(j.name) && !sjtJobIds.includes(j.id))
        .map((j) => j.name);
      if (semVinculo.length > 0) {
        alertasHeadcount.push(
          `Cargo(s) ${semVinculo.join(", ")} não está(ão) vinculado(s) ao setor ${setor} — vincule em Cargos e Setores para precisão.`,
        );
      }
    }

    // Fallback final
    if (headcountMax <= 0) {
      headcountMax = Number(config.qtd_abridores ?? 0) + Number(config.qtd_fechadores ?? 0) + Number(config.qtd_intermediarios ?? 0);
    }
    console.log(`[gerar-escala-ia] setor=${setor} headcount_vinculado=${headcountVinculado} headcount_equivalente=${headcountEquivalente} headcount_max=${headcountMax}`);

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

    // === ESTADO DAS PESSOAS — funcionários ativos + histórico recente ===
    // Datas reais da semana (segunda → domingo) para amarrar dias da semana a YYYY-MM-DD
    const semanaDate = new Date(semana_inicio + "T12:00:00");
    const weekDates: { dia: string; date: string }[] = DIAS.map((dia, i) => {
      const d = new Date(semanaDate);
      d.setDate(d.getDate() + i);
      return { dia, date: d.toISOString().slice(0, 10) };
    });
    const monthRef = semana_inicio.slice(0, 7); // YYYY-MM (mês de referência p/ folga dominical)

    // IDs de cargo para o setor (já temos sjtJobIds + equivalentJobIds)
    const allJobIds = Array.from(new Set([...sjtJobIds, ...equivalentJobIds]));

    type PessoaIA = {
      employee_id: string;
      nome: string;
      cargo: string | null;
      tipo: string;
      carga_horaria_alvo: number;
      ultimo_turno_anterior: { data: string; fim: string } | null;
      domingos_folga_no_mes: string[];
      ausencias_na_semana: { data: string; tipo: string }[];
    };
    const pessoasList: PessoaIA[] = [];

    if (allJobIds.length > 0) {
      const { data: empsData } = await supabase
        .from("employees")
        .select("id, name, worker_type, weekly_hours_target, job_titles(name), job_title")
        .eq("unit_id", unidade_id)
        .eq("active", true)
        .in("job_title_id", allJobIds);
      const emps = (empsData ?? []) as Array<any>;
      const empIds = emps.map((e) => e.id);

      // Domingos folgados no mês corrente + ausências/turno anterior
      const monthStart = `${monthRef}-01`;
      const monthEndDate = new Date(semanaDate);
      monthEndDate.setMonth(monthEndDate.getMonth() + 1);
      const monthEnd = monthEndDate.toISOString().slice(0, 10);
      const prevWeekStart = (() => {
        const d = new Date(semanaDate);
        d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
      })();

      const sundaysByEmp = new Map<string, string[]>();
      const lastShiftByEmp = new Map<string, { data: string; fim: string }>();
      const absencesByEmp = new Map<string, { data: string; tipo: string }[]>();

      if (empIds.length > 0) {
        const { data: schs } = await supabase
          .from("schedules")
          .select("employee_id, schedule_date, schedule_type, end_time")
          .in("employee_id", empIds)
          .gte("schedule_date", prevWeekStart)
          .lte("schedule_date", monthEnd)
          .neq("status", "cancelled");
        const weekStartStr = semana_inicio;
        const weekEndStr = weekDates[6].date;
        for (const s of (schs ?? []) as Array<any>) {
          const date = s.schedule_date as string;
          // Domingos de folga no mês de referência
          if (date.startsWith(monthRef) && s.schedule_type === "off") {
            const dt = new Date(date + "T12:00:00");
            if (dt.getDay() === 0) {
              const arr = sundaysByEmp.get(s.employee_id) ?? [];
              if (!arr.includes(date)) arr.push(date);
              sundaysByEmp.set(s.employee_id, arr);
            }
          }
          // Último turno trabalhado ANTES da semana-alvo (p/ interjornada)
          if (s.schedule_type === "working" && date < weekStartStr && s.end_time) {
            const cur = lastShiftByEmp.get(s.employee_id);
            if (!cur || date > cur.data) {
              lastShiftByEmp.set(s.employee_id, { data: date, fim: String(s.end_time).slice(0, 5) });
            }
          }
          // Ausências DURANTE a semana-alvo (férias/atestado/folga já marcada)
          if (s.schedule_type !== "working" && date >= weekStartStr && date <= weekEndStr) {
            const arr = absencesByEmp.get(s.employee_id) ?? [];
            arr.push({ data: date, tipo: s.schedule_type });
            absencesByEmp.set(s.employee_id, arr);
          }
        }
      }

      for (const e of emps) {
        pessoasList.push({
          employee_id: e.id,
          nome: e.name,
          cargo: e.job_titles?.name ?? e.job_title ?? null,
          tipo: e.worker_type ?? "clt",
          carga_horaria_alvo: e.weekly_hours_target ?? 44,
          ultimo_turno_anterior: lastShiftByEmp.get(e.id) ?? null,
          domingos_folga_no_mes: sundaysByEmp.get(e.id) ?? [],
          ausencias_na_semana: absencesByEmp.get(e.id) ?? [],
        });
      }
      console.log(`[gerar-escala-ia] pessoas=${pessoasList.length} mês_ref=${monthRef}`);
    }

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
      weekDates,
      pessoas: pessoasList,
    });

    // Modelo principal: gemini-2.5-pro com reasoning médio (melhor combinatória de folgas/dobras/CLT).
    // Fallback automático: gemini-2.5-flash se Pro falhar (rate-limit/erro 5xx).
    const callGateway = async (model: "pro" | "flash") => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model === "pro" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 32000,
        response_format: { type: "json_object" },
        ...(model === "pro" ? { reasoning: { effort: "medium" } } : {}),
      }),
    });

    let aiResp: Response | null = null;
    let lastErr = "";
    let modeloUsadoIA: "pro" | "flash" = "pro";
    // Tentativa 1: Pro com reasoning. Tentativa 2: Pro novamente. Tentativa 3: fallback Flash.
    const sequence: ("pro" | "flash")[] = ["pro", "pro", "flash"];
    for (let attempt = 0; attempt < sequence.length; attempt++) {
      const target = sequence[attempt];
      try {
        aiResp = await callGateway(target);
        if (aiResp.ok) { modeloUsadoIA = target; break; }
        if (aiResp.status === 429) {
          // Rate-limit no Pro: cai para Flash imediatamente em vez de erroar.
          if (target === "pro") {
            console.warn("[gerar-escala-ia] Pro rate-limited, fallback para Flash.");
            continue;
          }
          return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
        }
        if (aiResp.status === 402) return json({ error: "Créditos da Lovable AI esgotados." }, 402);
        lastErr = await aiResp.text();
        console.error(`AI gateway error (tentativa ${attempt + 1}, modelo ${target}):`, aiResp.status, lastErr);
        if (aiResp.status < 500 && target === "flash") break;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.error(`AI gateway fetch falhou (tentativa ${attempt + 1}, modelo ${target}):`, lastErr);
      }
      if (attempt < sequence.length - 1) await new Promise((r) => setTimeout(r, 800));
    }
    if (!aiResp || !aiResp.ok) {
      return json({ error: "Erro no AI Gateway", detail: lastErr || "Falha após retries." }, 502);
    }
    console.log(`[gerar-escala-ia] modelo_usado=${modeloUsadoIA}`);


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

    // === REGRA ESPECÍFICA — PARRILLA: abertura sempre 08:00 ===
    // Garantia determinística: independente do que a IA gerar, todo abridor da
    // Parrilla começa T1 às 08:00 (08:00→13:00 = 5h efetivas), mantendo break 180
    // e T2 inalterado.
    if (setorLemma === "parrilla" || setorLemma.startsWith("parrilla")) {
      const ehAbridor = (tipo: unknown, papel?: unknown) => {
        const c = [tipo, papel].map((v) => String(v ?? "").toUpperCase());
        return c.some((t) => t.startsWith("ABRIDOR") || t === "ABERTURA");
      };
      const forcarT1 = (slotOuVaga: any, t1Holder: any) => {
        if (!t1Holder) return;
        t1Holder.entrada = "08:00";
        t1Holder.saida = "13:00";
        t1Holder.efetivo_min = 300;
        if (typeof slotOuVaga.jornada_dia_min === "number") {
          const t2ef = slotOuVaga?.t2?.efetivo_min ?? slotOuVaga?.horario_padrao?.t2?.efetivo_min ?? 0;
          slotOuVaga.jornada_dia_min = 300 + (slotOuVaga.break_min ?? 180) + t2ef;
        }
      };
      // Slots em dias[*].slots
      for (const dia of Object.keys(escala?.dias ?? {})) {
        const slots = escala.dias[dia]?.slots ?? [];
        for (const s of slots) {
          if (ehAbridor(s.tipo, s.papel) && s.t1) forcarT1(s, s.t1);
        }
      }
      // Vagas em plano_folgas.vagas[*].horario_padrao.t1
      for (const v of escala?.plano_folgas?.vagas ?? []) {
        if (ehAbridor(v.tipo, v.papel) && v.horario_padrao?.t1) {
          forcarT1(v, v.horario_padrao.t1);
        }
      }
      console.log("[gerar-escala-ia] Parrilla: abertura forçada para 08:00 em todos abridores.");
    }

    const cltAlerts = escala?.validacao?.alertas_clt ?? [];
    // Alertas CLT (ex: interjornada de 10h vs 11h) são tratados como AVISO,
    // não como bloqueio — muitos desses casos são resolvidos por acordo coletivo
    // ou ajuste manual no grid. O usuário decide se aplica.
    if (cltAlerts.length > 0) {
      escala.validacao = {
        ...(escala.validacao ?? {}),
        aprovado: false,
        alertas_clt: cltAlerts,
        observacoes: "Alertas CLT presentes — revisar antes de salvar.",
      };
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

      // POP é PISO ABSOLUTO. Headcount real é apenas referência — NÃO podar vagas.
      if (vagasRegulares.length > headcountMax) {
        const deficit = vagasRegulares.length - headcountMax;
        alertasCapacidade.push(
          `Setor tem ${headcountMax} pessoa(s) ativa(s) mas o POP exige ${vagasRegulares.length} vagas. ` +
          `Escala foi gerada com déficit de ${deficit} pessoa(s) — contrate ou reduza o POP em Cargos e Setores.`,
        );
      }

      // === DIMENSIONAMENTO MATEMÁTICO + TETO RÍGIDO ===
      // Regra: respeitar headcountMax sempre que ele for >= mínimo matemático.
      // Se for menor, gerar com o mínimo matemático e emitir alerta de déficit.
      const popPorDia: Record<string, { almoco: number; jantar: number }> = {};
      for (const t of tabelaMinima) {
        popPorDia[t.dia] = {
          almoco: Number(t.almoco_efetivos ?? 0),
          jantar: Number(t.jantar_efetivos ?? 0),
        };
      }
      const cobreAlmoco = (v: any): boolean => {
        const t1 = v.horario_padrao?.t1;
        if (!t1?.entrada) return false;
        const [h, m] = String(t1.entrada).split(":").map(Number);
        return (h * 60 + (m || 0)) <= 11 * 60;
      };
      const cobreJantar = (v: any): boolean => {
        const t2 = v.horario_padrao?.t2;
        if (t2?.entrada) {
          const [h, m] = String(t2.entrada).split(":").map(Number);
          return (h * 60 + (m || 0)) <= 18 * 60;
        }
        // dobra parcial: T1 longo cobrindo até pelo menos 17h
        const t1 = v.horario_padrao?.t1;
        if (!t1?.entrada || !t1?.saida) return false;
        const [hs, ms] = String(t1.saida).split(":").map(Number);
        return (hs * 60 + (ms || 0)) >= 17 * 60;
      };

      // demanda_pessoa_dia[d] = max(pop_almoco, pop_jantar) — assume reaproveitamento via dobra
      // (uma pessoa em dobra cobre 1 almoço + 1 jantar). Soma dá pessoas-dia/semana.
      const demandaPessoaDia: Record<string, number> = {};
      let somaPessoaDia = 0;
      for (const dia of DIAS) {
        const need = Math.max(popPorDia[dia]?.almoco ?? 0, popPorDia[dia]?.jantar ?? 0);
        demandaPessoaDia[dia] = need;
        somaPessoaDia += need;
      }
      const diasUteisPorPessoa = Math.max(1, DIAS.length - folgasPorVagaAtivo);
      // mínimo matemático: 1) atender pico diário, 2) atender total semanal
      const minimoMatematico = Math.max(
        ...Object.values(demandaPessoaDia),
        Math.ceil(somaPessoaDia / diasUteisPorPessoa),
      );

      // Teto efetivo de vagas regulares
      const tetoEfetivo = headcountMax >= minimoMatematico
        ? headcountMax
        : minimoMatematico;

      if (headcountMax < minimoMatematico) {
        alertasCapacidade.push(
          `Setor tem ${headcountMax} pessoa(s) ativa(s) mas o POP exige no mínimo ${minimoMatematico} ` +
          `(modelo ${modeloFolgaAplicado}). Escala gerada com ${minimoMatematico} vagas — déficit de ` +
          `${minimoMatematico - headcountMax} pessoa(s). Contrate ou reduza o POP em Cargos e Setores.`,
        );
      }

      // === PODA: se IA estourou o teto, remove vagas extras priorizando manutenção da cobertura ===
      const podaParaTeto = () => {
        // Primeiro remove EXTRAs duplicados, depois vagas que sobram sem necessidade.
        while (vagasRegulares.length > tetoEfetivo) {
          // Encontra a vaga "menos essencial": aquela cuja remoção não derruba cobertura abaixo do POP
          let alvoIdx = -1;
          for (let i = vagasRegulares.length - 1; i >= 0; i--) {
            const v = vagasRegulares[i];
            // Simula remoção
            let podeRemover = true;
            for (const dia of DIAS) {
              if (Array.isArray(v.folgas) && v.folgas.includes(dia)) continue;
              const restantesNoDia = vagasRegulares.filter(
                (x: any, j: number) => j !== i && !(Array.isArray(x.folgas) && x.folgas.includes(dia)),
              );
              const cobAlm = restantesNoDia.filter(cobreAlmoco).length;
              const cobJan = restantesNoDia.filter(cobreJantar).length;
              if (cobAlm < (popPorDia[dia]?.almoco ?? 0) || cobJan < (popPorDia[dia]?.jantar ?? 0)) {
                podeRemover = false;
                break;
              }
            }
            if (podeRemover) { alvoIdx = i; break; }
          }
          if (alvoIdx === -1) break; // não dá para podar mais sem violar POP
          const removida = vagasRegulares[alvoIdx];
          vagasRegulares.splice(alvoIdx, 1);
          const idxPlano = plano.vagas.indexOf(removida);
          if (idxPlano >= 0) plano.vagas.splice(idxPlano, 1);
        }
      };

      // === INJEÇÃO MÍNIMA: só se faltar cobertura E ainda houver espaço no teto ===
      const injetarVaga = (perfil: "almoco" | "jantar", idx: number) => {
        const nova: any = perfil === "almoco"
          ? {
              id_vaga: `almoco_auto_${idx}`,
              tipo: "TIPO-ALMOCO",
              papel: "abridor",
              responsavel: false,
              folgas: [],
              horario_padrao: {
                t1: { entrada: "10:30", saida: "16:00", efetivo_min: 330 },
                break_min: 0,
                t2: null,
              },
            }
          : {
              id_vaga: `jantar_auto_${idx}`,
              tipo: "TIPO-FECHAMENTO",
              papel: "fechador",
              responsavel: false,
              folgas: [],
              horario_padrao: {
                t1: null,
                break_min: 0,
                t2: { entrada: "17:00", saida: "23:30", efetivo_min: 390 },
              },
            };
        plano.vagas.push(nova);
        vagasRegulares.push(nova);
        return nova;
      };

      const calcDeficit = () => {
        let defAlm = 0, defJan = 0;
        for (const dia of DIAS) {
          const emCampo = vagasRegulares.filter(
            (v: any) => !(Array.isArray(v.folgas) && v.folgas.includes(dia)),
          );
          defAlm = Math.max(defAlm, (popPorDia[dia]?.almoco ?? 0) - emCampo.filter(cobreAlmoco).length);
          defJan = Math.max(defJan, (popPorDia[dia]?.jantar ?? 0) - emCampo.filter(cobreJantar).length);
        }
        return { defAlm: Math.max(0, defAlm), defJan: Math.max(0, defJan) };
      };

      // 1) Poda inicial se IA estourou
      if (vagasRegulares.length > tetoEfetivo) {
        podaParaTeto();
      }

      // 2) Injeta o necessário (até o teto) para cobrir POP
      const vagasInjetadas: string[] = [];
      let iter = 0;
      while (iter < 30) {
        const { defAlm, defJan } = calcDeficit();
        if (defAlm <= 0 && defJan <= 0) break;
        if (vagasRegulares.length >= tetoEfetivo) break;
        // injeta priorizando o maior déficit
        const perfil = defAlm >= defJan ? "almoco" : "jantar";
        const v = injetarVaga(perfil, vagasRegulares.length + 1);
        vagasInjetadas.push(v.id_vaga);
        distribuirFolgas(folgasPorVagaAtivo);
        iter++;
      }

      // 3) Se ainda assim ultrapassou teto (raro após poda), avisa
      if (vagasRegulares.length > tetoEfetivo) {
        alertasCapacidade.push(
          `Vagas finais (${vagasRegulares.length}) excedem teto efetivo (${tetoEfetivo}) — POP impossível com este headcount.`,
        );
      }

      if (vagasInjetadas.length > 0) {
        alertasCapacidade.push(
          `${vagasInjetadas.length} vaga(s) auto-injetada(s) para cobrir POP (IA não cobriu).`,
        );
      }

      // Cobertura final por dia
      const coberturaAlmocoPorDia: Record<string, { necessario: number; em_campo: number; ok: boolean }> = {};
      const coberturaJantarPorDia: Record<string, { necessario: number; em_campo: number; ok: boolean }> = {};
      for (const dia of DIAS) {
        const emCampo = vagasRegulares.filter(
          (v: any) => !(Array.isArray(v.folgas) && v.folgas.includes(dia)),
        );
        const cAlm = emCampo.filter(cobreAlmoco).length;
        const cJan = emCampo.filter(cobreJantar).length;
        const nAlm = popPorDia[dia]?.almoco ?? 0;
        const nJan = popPorDia[dia]?.jantar ?? 0;
        coberturaAlmocoPorDia[dia] = { necessario: nAlm, em_campo: cAlm, ok: cAlm >= nAlm };
        coberturaJantarPorDia[dia] = { necessario: nJan, em_campo: cJan, ok: cJan >= nJan };
      }
      plano.cobertura_almoco_por_dia = coberturaAlmocoPorDia;
      plano.cobertura_jantar_por_dia = coberturaJantarPorDia;

      // Cobertura final
      const { cobertura, violacoes } = calcularCobertura();
      for (const v of violacoes) alertasFolga.push(v);

      plano.headcount_total = vagasRegulares.length;
      plano.headcount_max = headcountMax;
      plano.headcount_vinculado = headcountVinculado;
      plano.headcount_equivalente = headcountEquivalente;
      plano.headcount_usado = vagasRegulares.length;
      plano.minimo_matematico = minimoMatematico;
      plano.teto_efetivo = tetoEfetivo;
      plano.modelo_folga_aplicado = modeloFolgaAplicado;
      plano.alertas_capacidade = [...alertasHeadcount, ...alertasCapacidade];
      plano.modelo_ia_usado = modeloUsadoIA;
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
