import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { token, decisao, comentario, payload_editado, aprovador_nome } = body ?? {};
    if (!token || !["aprovar", "rejeitar"].includes(decisao)) {
      return json({ error: "Parâmetros inválidos" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link } = await supabase
      .from("escala_aprovacao_links")
      .select("id, template_id, expira_em, usado_em")
      .eq("token", token)
      .maybeSingle();
    if (!link) return json({ error: "Link inválido" }, 404);
    if (new Date(link.expira_em).getTime() < Date.now())
      return json({ error: "Link expirado" }, 410);
    if (link.usado_em)
      return json({ error: "Este link já foi utilizado" }, 409);

    const { data: tpl } = await supabase
      .from("escala_template")
      .select("id, status, payload")
      .eq("id", link.template_id)
      .maybeSingle();
    if (!tpl) return json({ error: "Escala não encontrada" }, 404);
    if (tpl.status !== "pendente_aprovacao")
      return json({ error: `Escala já está com status '${tpl.status}'` }, 409);

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      null;
    const aprovadorLabel = aprovador_nome
      ? `COO via link (${aprovador_nome})`
      : "COO via link";

    if (decisao === "aprovar") {
      const novoPayload = payload_editado
        ? { ...(tpl.payload ?? {}), dias: payload_editado }
        : tpl.payload;
      const { error: uErr } = await supabase
        .from("escala_template")
        .update({
          status: "aprovado",
          aprovado_por: aprovadorLabel,
          aprovado_em: new Date().toISOString(),
          payload: novoPayload,
        })
        .eq("id", tpl.id);
      if (uErr) return json({ error: uErr.message }, 500);

      // ===== Materializar slots como linhas em `schedules` =====
      try {
        const tplFull = await supabase
          .from("escala_template")
          .select("id, unidade_id, setor, semana_inicio, payload")
          .eq("id", tpl.id)
          .maybeSingle();
        const t = tplFull.data;
        if (t) {
          const dias = (novoPayload as any)?.dias ?? {};
          const diasMap: Record<string, number> = { SEG: 0, TER: 1, QUA: 2, QUI: 3, SEX: 4, SAB: 5, DOM: 6 };

          // sector: find or create
          let sectorId: string | null = null;
          const { data: secExist } = await supabase
            .from("sectors")
            .select("id, name")
            .eq("unit_id", t.unidade_id);
          const found = (secExist ?? []).find(
            (s: any) => String(s.name).trim().toLowerCase() === String(t.setor).trim().toLowerCase(),
          );
          if (found) sectorId = found.id;
          else {
            const { data: newSec } = await supabase
              .from("sectors")
              .insert({ unit_id: t.unidade_id, name: t.setor })
              .select("id")
              .single();
            sectorId = newSec?.id ?? null;
          }

          // pick a system user_id (first admin) to satisfy NOT NULL
          const { data: adminRow } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin")
            .limit(1)
            .maybeSingle();
          const systemUserId = adminRow?.user_id ?? null;

          // shifts cache
          const { data: allShifts } = await supabase.from("shifts").select("id, start_time, end_time, type, name");
          const shiftCache = new Map<string, string>();
          for (const sh of allShifts ?? []) {
            shiftCache.set(`${sh.start_time}-${sh.end_time}`, sh.id);
          }
          const ensureShift = async (entrada: string, saida: string) => {
            const e = entrada.length === 5 ? `${entrada}:00` : entrada;
            const s = saida.length === 5 ? `${saida}:00` : saida;
            const key = `${e}-${s}`;
            if (shiftCache.has(key)) return shiftCache.get(key)!;
            const type = parseInt(e.slice(0, 2), 10) < 16 ? "almoco" : "jantar";
            const { data: ns } = await supabase
              .from("shifts")
              .insert({ name: `${entrada}-${saida}`, start_time: e, end_time: s, type })
              .select("id")
              .single();
            if (ns?.id) shiftCache.set(key, ns.id);
            return ns?.id;
          };

          const baseDate = new Date(`${t.semana_inicio}T00:00:00`);
          const rows: any[] = [];

          for (const [diaCode, diaData] of Object.entries(dias as Record<string, any>)) {
            const offset = diasMap[diaCode];
            if (offset === undefined) continue;
            const d = new Date(baseDate);
            d.setDate(d.getDate() + offset);
            const dateStr = d.toISOString().slice(0, 10);
            const slots = (diaData as any)?.slots ?? [];
            for (const slot of slots) {
              const qty = Math.max(1, Number(slot?.quantidade ?? 1));
              const turnos = ["t1", "t2"]
                .map((k) => slot?.[k])
                .filter((tt: any) => tt && tt.entrada && tt.saida);
              for (const turno of turnos) {
                const shiftId = await ensureShift(turno.entrada, turno.saida);
                if (!shiftId || !sectorId || !systemUserId) continue;
                for (let i = 0; i < qty; i++) {
                  rows.push({
                    user_id: systemUserId,
                    sector_id: sectorId,
                    shift_id: shiftId,
                    schedule_date: dateStr,
                    start_time: turno.entrada.length === 5 ? `${turno.entrada}:00` : turno.entrada,
                    end_time: turno.saida.length === 5 ? `${turno.saida}:00` : turno.saida,
                    schedule_type: "working",
                    status: "scheduled",
                    agreed_rate: 0,
                    employee_id: null,
                  });
                }
              }
            }
          }

          if (rows.length > 0) {
            const { error: insErr } = await supabase.from("schedules").insert(rows);
            if (insErr) console.error("Erro ao materializar schedules:", insErr.message);
          }
        }
      } catch (matErr) {
        console.error("Materialization error:", matErr);
      }
    } else {
      const { error: uErr } = await supabase
        .from("escala_template")
        .update({
          status: "rejeitado",
          comentario_rejeicao: comentario ?? null,
        })
        .eq("id", tpl.id);
      if (uErr) return json({ error: uErr.message }, 500);
    }

    await supabase
      .from("escala_aprovacao_links")
      .update({ usado_em: new Date().toISOString(), ip_aprovador: ip, decisao })
      .eq("id", link.id);

    return json({ ok: true, decisao });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
