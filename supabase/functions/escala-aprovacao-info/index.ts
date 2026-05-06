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
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return json({ error: "token obrigatório" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: lErr } = await supabase
      .from("escala_aprovacao_links")
      .select("template_id, expira_em, usado_em, decisao")
      .eq("token", token)
      .maybeSingle();

    if (lErr || !link) return json({ error: "Link inválido" }, 404);
    if (new Date(link.expira_em).getTime() < Date.now())
      return json({ error: "Link expirado" }, 410);

    const { data: tpl, error: tErr } = await supabase
      .from("escala_template")
      .select("id, setor, semana_inicio, payload, status, comentario_rejeicao, aprovado_por, aprovado_em, unidade_id")
      .eq("id", link.template_id)
      .maybeSingle();
    if (tErr || !tpl) return json({ error: "Escala não encontrada" }, 404);

    const { data: unidade } = await supabase
      .from("config_lojas")
      .select("nome")
      .eq("id", tpl.unidade_id)
      .maybeSingle();

    return json({
      template: {
        id: tpl.id,
        setor: tpl.setor,
        semana_inicio: tpl.semana_inicio,
        payload: tpl.payload,
        status: tpl.status,
        comentario_rejeicao: tpl.comentario_rejeicao,
        aprovado_por: tpl.aprovado_por,
        aprovado_em: tpl.aprovado_em,
        unidade_nome: unidade?.nome ?? null,
      },
      link: {
        usado_em: link.usado_em,
        decisao: link.decisao,
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
