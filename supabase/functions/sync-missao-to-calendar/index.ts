// Sincroniza uma missão da Agenda do Líder com o Google Calendar
// do líder responsável (cria ou atualiza um evento all-day no prazo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRIORIDADE_COLOR: Record<string, string> = {
  alta: "11", // tomato
  media: "5", // banana
  baixa: "10", // basil
};

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
    const callerId = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const missaoId = body?.missao_id as string | undefined;
    const removeOnly = !!body?.remove;
    if (!missaoId) {
      return new Response(JSON.stringify({ error: "missao_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Carrega missão
    const { data: missao, error: missaoErr } = await admin
      .from("missoes")
      .select(
        "id, titulo, descricao, prioridade, prazo, status, google_event_id, google_calendar_user_id",
      )
      .eq("id", missaoId)
      .maybeSingle();
    if (missaoErr || !missao) {
      return new Response(JSON.stringify({ error: "Missão não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Define dono do calendário: responsável da missão (papel='responsavel');
    //    fallback: criador da missão; fallback final: caller.
    const { data: membros } = await admin
      .from("missao_membros")
      .select("user_id, papel")
      .eq("missao_id", missaoId);
    const responsavel = (membros ?? []).find((m: any) => m.papel === "responsavel");
    const calendarUserId =
      missao.google_calendar_user_id || responsavel?.user_id || callerId;

    // ---- Remoção opcional ----
    if (removeOnly) {
      if (!missao.google_event_id) {
        return new Response(JSON.stringify({ ok: true, removed: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tk = await refreshAccessToken({
        admin,
        userId: calendarUserId,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
      });
      if ("needs_connect" in tk) {
        return new Response(
          JSON.stringify({ status: "needs_connect", user_id: calendarUserId, is_self: calendarUserId === callerId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(missao.google_event_id)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${tk.access_token}` } },
      );
      // 410/404 = já removido
      if (![200, 204, 404, 410].includes(delRes.status)) {
        const t = await delRes.text();
        console.error("Calendar delete failed:", delRes.status, t);
      }
      await admin
        .from("missoes")
        .update({
          google_event_id: null,
          google_calendar_synced_at: null,
          google_calendar_user_id: null,
        })
        .eq("id", missaoId);
      return new Response(JSON.stringify({ ok: true, removed: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Sync (create/update) ----
    if (!missao.prazo) {
      return new Response(
        JSON.stringify({ error: "Missão sem prazo definido — defina um prazo antes de sincronizar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Token do dono do calendário
    const tk = await refreshAccessToken({
      admin,
      userId: calendarUserId,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });
    if ("needs_connect" in tk) {
      // Nome do líder pra mensagem amigável
      let nome = "o líder responsável";
      const { data: prof } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", calendarUserId)
        .maybeSingle();
      if (prof?.full_name) nome = prof.full_name;
      return new Response(
        JSON.stringify({
          status: "needs_connect",
          user_id: calendarUserId,
          is_self: calendarUserId === callerId,
          nome,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Carrega tarefas (plano de ação) pra montar a descrição
    const { data: tarefas } = await admin
      .from("missao_tarefas")
      .select("descricao, dia_semana, ordem, concluido")
      .eq("missao_id", missaoId)
      .order("ordem", { ascending: true });

    const checklist = (tarefas ?? [])
      .map((t: any) => `${t.concluido ? "☑" : "☐"} ${t.descricao}${t.dia_semana ? ` (${t.dia_semana})` : ""}`)
      .join("\n");

    const portalUrl = `${SUPABASE_URL.replace(".supabase.co", ".lovable.app").replace("https://", "https://")}`;
    // O link acima só é informativo; usamos o redirect oficial do projeto:
    const appLink = `https://freelancersgrupocaju.lovable.app/?tab=agenda-lider&missao=${missaoId}`;

    const description = [
      missao.descricao || "",
      checklist ? `\n— Plano de ação —\n${checklist}` : "",
      `\n\nAbrir no Portal: ${appLink}`,
    ]
      .filter(Boolean)
      .join("\n");

    const event: any = {
      summary: `[Caju] ${(missao.titulo || "").toUpperCase()}`,
      description,
      start: { date: missao.prazo },
      end: { date: addDaysISO(missao.prazo, 1) },
      colorId: PRIORIDADE_COLOR[missao.prioridade] ?? "5",
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 24 * 60 }, // 1 dia antes
          { method: "popup", minutes: 60 * 2 }, // 2h antes
        ],
      },
      extendedProperties: {
        private: { caju_missao_id: missaoId },
      },
    };

    let response: Response;
    let url: string;
    let method: string;
    if (missao.google_event_id) {
      url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(missao.google_event_id)}`;
      method = "PATCH";
    } else {
      url = `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
      method = "POST";
    }

    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${tk.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (response.status === 404 && missao.google_event_id) {
      // Evento foi removido manualmente do Calendar — recria
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tk.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        },
      );
    }

    if (!response.ok) {
      const txt = await response.text();
      console.error("Calendar API error:", response.status, txt);
      return new Response(
        JSON.stringify({ error: `Google Calendar respondeu ${response.status}.` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const eventData = await response.json();
    const eventId = eventData?.id as string | undefined;
    const syncedAt = new Date().toISOString();

    await admin
      .from("missoes")
      .update({
        google_event_id: eventId,
        google_calendar_synced_at: syncedAt,
        google_calendar_user_id: calendarUserId,
      })
      .eq("id", missaoId);

    return new Response(
      JSON.stringify({
        ok: true,
        event_id: eventId,
        synced_at: syncedAt,
        calendar_user_id: calendarUserId,
        html_link: eventData?.htmlLink ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-missao-to-calendar error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
