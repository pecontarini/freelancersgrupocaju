import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Gera um magic link de atualização de PIX para um freelancer.
 *
 * Auth: requer JWT (admin ou operator).
 *
 * Decisão técnica (ver OPERATIONAL_PROTOCOL.md): token opaco crypto-random
 * em vez de JWT. Single-use enforçado via DB (`consumed_at`); expiração
 * via `magic_link_expires_at` (7 dias).
 *
 * Body: { profile_id: string, base_url?: string }
 * Resposta: { ok: true, token, url, wa_me_url, expires_at, telefone, profile }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    )!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Authorize: admin or operator
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = roles?.some(
      (r: { role: string }) => r.role === "admin" || r.role === "operator"
    );
    if (!allowed) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const profileId: string | undefined = body?.profile_id;
    const baseUrl: string =
      body?.base_url || "https://freelancersgrupocaju.lovable.app";

    if (!profileId || typeof profileId !== "string") {
      return json({ error: "profile_id required" }, 400);
    }

    // Fetch profile
    const { data: profile, error: profErr } = await admin
      .from("freelancer_profiles")
      .select("id, nome_completo, telefone, cpf")
      .eq("id", profileId)
      .maybeSingle();
    if (profErr || !profile) {
      return json({ error: "profile_not_found" }, 404);
    }

    // Generate opaque token (32 bytes -> 43 chars base64url)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = base64url(tokenBytes);

    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const url = `${baseUrl.replace(/\/$/, "")}/atualizar-pix/${token}`;

    // Insert queue row (status=pending; channel default 'wame')
    const { data: queueRow, error: insErr } = await admin
      .from("whatsapp_dispatch_queue")
      .insert({
        profile_id: profileId,
        telefone: profile.telefone,
        message_template: "PIX_UPDATE_V3",
        magic_link_token: token,
        magic_link_expires_at: expiresAt,
        status: "pending",
        channel: "wame",
        dispatched_by: userId,
      })
      .select("id")
      .single();

    if (insErr) {
      return json({ error: insErr.message }, 500);
    }

    // wa.me URL pronta (mensagem URL-encoded já com link incluso)
    const firstName = (profile.nome_completo || "").split(/\s+/)[0] || "";
    const message = buildPixMessage(firstName, url);

    let waMeUrl: string | null = null;
    if (profile.telefone) {
      const phone = profile.telefone.replace(/\D/g, "");
      if (phone.length >= 10) {
        const intl = phone.startsWith("55") ? phone : `55${phone}`;
        waMeUrl = `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
      }
    }

    return json({
      ok: true,
      queue_id: queueRow.id,
      token,
      url,
      wa_me_url: waMeUrl,
      message_body: message,
      expires_at: expiresAt,
      telefone: profile.telefone,
      profile: {
        id: profile.id,
        nome_completo: profile.nome_completo,
      },
    });
  } catch (err) {
    return json({ error: String((err as Error)?.message || err) }, 500);
  }
});

function buildPixMessage(firstName: string, link: string): string {
  return `Olá, ${firstName}!

Aqui é a equipe do Grupo Cajupar. Para garantir que seus pagamentos como freelancer continuem sendo processados sem atraso, precisamos confirmar seus dados PIX.

É rápido — toque no link abaixo, confira sua chave PIX e atualize se for o caso:

${link}

Importante:

- A chave PIX precisa estar no seu nome (CPF, e-mail ou telefone).
- PIX em nome de terceiros não será processado.
- O link expira em 7 dias.

Qualquer dúvida, é só responder por aqui.

Obrigado!
Grupo Cajupar`;
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
