import { supabase } from "@/integrations/supabase/client";

// =====================================================================
// Google Calendar — Fluxo OAuth server-side com refresh_token persistente
// =====================================================================
//
// Esta camada substituiu o antigo fluxo via Google Identity Services (GIS)
// no navegador, que entregava apenas access_tokens efêmeros e exigia
// reautenticação constante. Agora o consent acontece em redirect,
// o callback é processado pela Edge Function `google-oauth-callback`
// (que troca o code por access_token + refresh_token e grava em
// `user_google_tokens`), e a Edge Function `google-oauth-refresh`
// renova o access_token automaticamente em background.
// =====================================================================

export interface AgendaParticipanteInput {
  email: string;
  nome?: string | null;
}

export interface AgendaEventoInput {
  titulo: string;
  descricao?: string | null;
  data_inicio: string; // ISO
  data_fim?: string | null;
  categoria: "reuniao" | "operacional" | "pessoal" | "outro";
  participantes?: AgendaParticipanteInput[];
}

export interface GoogleAttendee {
  email: string;
  displayName?: string;
  responseStatus?: "accepted" | "declined" | "tentative" | "needsAction";
}

export class GoogleAuthExpiredError extends Error {
  constructor(message = "Conexão com o Google expirou. Reconecte para sincronizar.") {
    super(message);
    this.name = "GoogleAuthExpiredError";
  }
}

// Mantida para compatibilidade com chamadas existentes (no-op no novo fluxo)
export function initGoogleAuth(): Promise<void> {
  return Promise.resolve();
}

/**
 * Inicia o fluxo de conexão. Pede à edge function `google-oauth-start` a URL
 * de consent assinada e redireciona o navegador. Após autorização, o usuário
 * volta para `/agenda?google_oauth=success`.
 */
export async function startGoogleOAuth(returnTo = "/agenda"): Promise<void> {
  const { data, error } = await supabase.functions.invoke("google-oauth-start", {
    body: {},
    method: "POST",
    // O Supabase Functions client suporta querystring via headers? Não — usamos query manual via fetch.
  });

  // Fallback: se invoke não trouxer URL, chama via fetch direto para preservar query
  let consentUrl: string | undefined = (data as any)?.url;
  if (!consentUrl) {
    const { data: sessionRes } = await supabase.auth.getSession();
    const accessToken = sessionRes.session?.access_token;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/google-oauth-start?return_to=${encodeURIComponent(returnTo)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken ?? ""}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Falha ao iniciar OAuth (${res.status})`);
    consentUrl = json.url;
  }

  if (error) throw new Error(error.message ?? "Falha ao iniciar conexão com Google.");
  if (!consentUrl) throw new Error("URL de consent não recebida do servidor.");

  window.location.assign(consentUrl);
}

/**
 * Mantida para compatibilidade com Agenda.tsx — agora apenas redireciona.
 * Note: como o fluxo é por redirect, esta promise nunca resolve.
 */
export async function requestGoogleToken(_silent = false): Promise<{ access_token: string; expires_in: number }> {
  await startGoogleOAuth();
  // Redirect em andamento; promise pendente até a navegação acontecer
  return new Promise(() => {});
}

/**
 * Garante um access_token válido. Lê do banco; se expirado/ausente, chama
 * `google-oauth-refresh` que usa o refresh_token armazenado para renovar.
 * Lança GoogleAuthExpiredError se o usuário precisar reconectar.
 */
export async function ensureValidGoogleToken(): Promise<string> {
  const tokenRow = await getTokenFromSupabase();
  const now = Date.now();
  const expiresAtMs = tokenRow?.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  const isValid = !!tokenRow?.access_token && expiresAtMs - now > 60_000;

  if (isValid && tokenRow?.access_token) {
    return tokenRow.access_token;
  }

  // Tenta renovar via edge function
  try {
    const { data, error } = await supabase.functions.invoke("google-oauth-refresh", {
      body: {},
    });

    if (error) {
      // Status 410 = reconnect_required (no_refresh_token / invalid_grant)
      const status = (error as any)?.context?.response?.status;
      if (status === 410) throw new GoogleAuthExpiredError();
      throw new Error(error.message ?? "Falha ao renovar token Google.");
    }

    const newToken = (data as any)?.access_token as string | undefined;
    if (!newToken) throw new GoogleAuthExpiredError();
    return newToken;
  } catch (err) {
    if (err instanceof GoogleAuthExpiredError) throw err;
    console.warn("[googleCalendar] refresh failed:", err);
    throw new GoogleAuthExpiredError();
  }
}

/**
 * Mantida apenas para compatibilidade — o callback do servidor é quem grava.
 * Não precisa mais ser chamada pelo frontend.
 */
export async function saveTokenToSupabase(_token: { access_token: string; expires_in: number }): Promise<void> {
  // No-op: persistência agora é feita server-side pelo google-oauth-callback
  return;
}

export async function getTokenFromSupabase(): Promise<{ access_token: string; expires_at: string | null } | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_google_tokens")
    .select("access_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[googleCalendar] getToken error", error);
    return null;
  }
  return data ?? null;
}

export async function clearTokenFromSupabase(): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return;
  await supabase.from("user_google_tokens").delete().eq("user_id", userId);
}

function buildGoogleEvent(evento: AgendaEventoInput) {
  const base: any = {
    summary: evento.titulo,
    description: evento.descricao ?? "",
    start: { dateTime: new Date(evento.data_inicio).toISOString() },
    end: {
      dateTime: new Date(
        evento.data_fim ?? new Date(new Date(evento.data_inicio).getTime() + 60 * 60 * 1000).toISOString()
      ).toISOString(),
    },
  };
  if (evento.participantes && evento.participantes.length > 0) {
    base.attendees = evento.participantes.map((p) => ({
      email: p.email,
      ...(p.nome ? { displayName: p.nome } : {}),
    }));
    base.guestsCanSeeOtherGuests = true;
  }
  return base;
}

function withSendUpdates(path: string, evento: AgendaEventoInput): string {
  const hasGuests = !!evento.participantes && evento.participantes.length > 0;
  if (!hasGuests) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}sendUpdates=all`;
}

async function googleFetch(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new GoogleAuthExpiredError();
    }
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function createCalendarEvent(token: string, evento: AgendaEventoInput) {
  return googleFetch(token, withSendUpdates(`/calendars/primary/events`, evento), {
    method: "POST",
    body: JSON.stringify(buildGoogleEvent(evento)),
  });
}

export async function listCalendarEvents(token: string, timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  return googleFetch(token, `/calendars/primary/events?${params.toString()}`);
}

export async function updateCalendarEvent(token: string, googleEventId: string, evento: AgendaEventoInput) {
  return googleFetch(
    token,
    withSendUpdates(`/calendars/primary/events/${encodeURIComponent(googleEventId)}`, evento),
    {
      method: "PUT",
      body: JSON.stringify(buildGoogleEvent(evento)),
    }
  );
}

export async function deleteCalendarEvent(token: string, googleEventId: string) {
  return googleFetch(token, `/calendars/primary/events/${encodeURIComponent(googleEventId)}`, {
    method: "DELETE",
  });
}

export async function getCalendarEventAttendees(
  token: string,
  googleEventId: string
): Promise<GoogleAttendee[]> {
  const data = await googleFetch(
    token,
    `/calendars/primary/events/${encodeURIComponent(googleEventId)}`
  );
  const attendees = (data?.attendees ?? []) as GoogleAttendee[];
  return attendees;
}
