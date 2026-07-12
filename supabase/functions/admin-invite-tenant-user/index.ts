import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return json({ error: "não autenticado" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Verificar caller
    const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userRes.user) return json({ error: "sessão inválida" }, 401);

    const callerId = userRes.user.id;
    const { data: isSuper, error: superErr } = await admin.rpc("is_super_admin", { _user_id: callerId });
    if (superErr) return json({ error: superErr.message }, 500);
    if (!isSuper) return json({ error: "somente super admins podem convidar usuários" }, 403);

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const tenantId = String(body.tenant_id ?? "");
    const isDefault = Boolean(body.is_default ?? false);
    const fullName = body.full_name ? String(body.full_name) : undefined;

    if (!email || !tenantId) {
      return json({ error: "email e tenant_id são obrigatórios" }, 400);
    }

    // Buscar tenant para redirectTo
    const { data: tenant } = await admin
      .from("tenants")
      .select("slug, nome")
      .eq("id", tenantId)
      .maybeSingle();
    if (!tenant) return json({ error: "empresa não encontrada" }, 404);

    // Tentar localizar usuário existente
    let targetUserId: string | null = null;
    const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return json({ error: listErr.message }, 500);
    const existing = listed.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (existing) targetUserId = existing.id;

    let invited = false;
    let inviteLink: string | null = null;
    let emailSent = false;

    const origin = req.headers.get("origin") ?? "";
    const redirectTo = origin ? `${origin}/auth` : undefined;

    if (!targetUserId) {
      // 1) Cria o usuário direto (sem depender de SMTP)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      });
      if (createErr || !created.user) {
        return json({ error: createErr?.message ?? "falha ao criar usuário" }, 500);
      }
      targetUserId = created.user.id;
      invited = true;

      // 2) Gera link de convite (não envia e-mail — devolvemos p/ admin compartilhar)
      const { data: linkData, error: linkGenErr } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      });
      if (!linkGenErr) {
        inviteLink = linkData?.properties?.action_link ?? null;
      }

      // 3) Tentativa best-effort de disparar e-mail via inviteUserByEmail
      // (se SMTP estourou rate limit, ignoramos silenciosamente — o link acima cobre)
      const { error: mailErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: fullName ? { full_name: fullName } : undefined,
      });
      emailSent = !mailErr;
    }

    // Vincular ao tenant
    if (isDefault) {
      await admin.from("user_tenants").update({ is_default: false }).eq("user_id", targetUserId);
    }

    const { error: linkErr } = await admin
      .from("user_tenants")
      .upsert(
        { user_id: targetUserId, tenant_id: tenantId, is_default: isDefault },
        { onConflict: "user_id,tenant_id" }
      );
    if (linkErr) return json({ error: linkErr.message }, 500);

    return json({ ok: true, user_id: targetUserId, invited, invite_link: inviteLink, email_sent: emailSent });
  } catch (e: any) {
    return json({ error: e?.message ?? "erro inesperado" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
