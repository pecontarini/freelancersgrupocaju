// Renova o access_token do Google usando o refresh_token armazenado.
// Chamada pelo frontend quando o token atual está perto de expirar.
// Retorna o novo access_token (também atualizado em user_google_tokens).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Servidor sem credenciais Google." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: tokenRow, error: selErr } = await admin
      .from("user_google_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userRes.user.id)
      .maybeSingle();

    if (selErr) {
      return new Response(JSON.stringify({ error: selErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tokenRow?.refresh_token) {
      return new Response(
        JSON.stringify({ error: "no_refresh_token", reconnect_required: true }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Se ainda está válido por mais de 60s, devolve o atual sem chamar Google
    const expiresAtMs = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
    if (tokenRow.access_token && expiresAtMs - Date.now() > 60_000) {
      return new Response(
        JSON.stringify({ access_token: tokenRow.access_token, expires_at: tokenRow.expires_at }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
        grant_type: "refresh_token",
      }).toString(),
    });

    const refreshJson = await refreshRes.json();

    if (!refreshRes.ok) {
      console.error("[google-oauth-refresh] failed", refreshJson);
      // Refresh_token revogado/inválido → limpa para forçar reconexão
      if (refreshJson.error === "invalid_grant") {
        await admin
          .from("user_google_tokens")
          .update({ refresh_token: null, access_token: null, expires_at: null })
          .eq("user_id", userRes.user.id);
        return new Response(
          JSON.stringify({ error: "invalid_grant", reconnect_required: true }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: refreshJson.error || "refresh_failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { access_token, expires_in } = refreshJson as { access_token: string; expires_in: number };
    const newExpiresAt = new Date(Date.now() + Number(expires_in ?? 3600) * 1000).toISOString();

    await admin
      .from("user_google_tokens")
      .update({ access_token, expires_at: newExpiresAt })
      .eq("user_id", userRes.user.id);

    return new Response(
      JSON.stringify({ access_token, expires_at: newExpiresAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[google-oauth-refresh] unexpected", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
