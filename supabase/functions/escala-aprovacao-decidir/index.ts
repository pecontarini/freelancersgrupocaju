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
