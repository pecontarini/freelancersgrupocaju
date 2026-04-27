// Lista eventos do Google Calendar do usuário logado em uma janela de datas.
// Usa o refresh_token salvo em `user_google_tokens` para obter um access_token.
// Retorna eventos do calendário "primary".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function refreshAccessToken(opts: {
  admin: any;
  userId: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string } | { needs_connect: true }> {
  const { admin, userId, clientId, clientSecret } = opts;
  const { data: tokenRow } = await admin
    .from("user_google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRow?.refresh_token) return { needs_connect: true };

  const expiresAtMs = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  if (tokenRow.access_token && expiresAtMs - Date.now() > 60_000) {
    return { access_token: tokenRow.access_token };
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    if (json.error === "invalid_grant") {
      await admin
        .from("user_google_tokens")
        .update({ refresh_token: null, access_token: null, expires_at: null })
        .eq("user_id", userId);
      return { needs_connect: true };
    }
    throw new Error(`Refresh failed: ${json.error || "unknown"}`);
  }
  const { access_token, expires_in } = json;
  const newExpiresAt = new Date(Date.now() + Number(expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from("user_google_tokens")
    .update({ access_token, expires_at: newExpiresAt })
    .eq("user_id", userId);
  return { access_token };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Servidor sem credenciais Google." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const callerId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const timeMin = (body?.time_min as string) || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const timeMax = (body?.time_max as string) || new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const tk = await refreshAccessToken({
      admin,
      userId: callerId,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    if ("needs_connect" in tk) {
      return new Response(JSON.stringify({ status: "needs_connect", events: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${tk.access_token}` } });
    const data = await r.json();
    if (!r.ok) {
      console.error("Google Calendar list error:", r.status, data);
      return new Response(
        JSON.stringify({ error: `Google respondeu ${r.status}.`, events: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const events = (data.items ?? []).map((ev: any) => ({
      id: ev.id,
      summary: ev.summary ?? "(sem título)",
      description: ev.description ?? null,
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      all_day: !!ev.start?.date,
      html_link: ev.htmlLink ?? null,
      location: ev.location ?? null,
      color_id: ev.colorId ?? null,
      caju_missao_id: ev.extendedProperties?.private?.caju_missao_id ?? null,
    }));

    return new Response(
      JSON.stringify({ status: "ok", events }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("list-google-calendar-events error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown", events: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
