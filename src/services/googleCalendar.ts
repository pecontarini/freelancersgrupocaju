import { supabase } from "@/integrations/supabase/client";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SCOPES = "https://www.googleapis.com/auth/calendar";
const GIS_SRC = "https://accounts.google.com/gsi/client";

export interface AgendaEventoInput {
  titulo: string;
  descricao?: string | null;
  data_inicio: string; // ISO
  data_fim?: string | null;
  categoria: "reuniao" | "operacional" | "pessoal" | "outro";
  participantes?: string[];
}

declare global {
  interface Window {
    google?: any;
  }
}

let gisLoadPromise: Promise<void> | null = null;

export function initGoogleAuth(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar Google Identity Services.")));
      if ((window as any).google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Google Identity Services."));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

export async function requestGoogleToken(): Promise<{ access_token: string; expires_in: number }> {
  await initGoogleAuth();
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("VITE_GOOGLE_CLIENT_ID não configurado.");
  }
  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        prompt: "consent",
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          resolve({ access_token: response.access_token, expires_in: Number(response.expires_in ?? 3600) });
        },
      });
      tokenClient.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
}

export async function saveTokenToSupabase(token: { access_token: string; expires_in: number }): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("Usuário não autenticado.");

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  const { error } = await supabase
    .from("user_google_tokens")
    .upsert(
      {
        user_id: userId,
        access_token: token.access_token,
        expires_at: expiresAt,
      },
      { onConflict: "user_id" }
    );
  if (error) throw error;
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
    base.attendees = evento.participantes.map((email) => ({ email }));
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
