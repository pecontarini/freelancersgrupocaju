import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface GoogleEvent {
  id: string;
  summary: string;
  description: string | null;
  start: string; // ISO ou YYYY-MM-DD
  end: string;
  all_day: boolean;
  html_link: string | null;
  location: string | null;
  color_id: string | null;
  caju_missao_id: string | null;
}

export interface ListGoogleEventsResult {
  status: "ok" | "needs_connect";
  events: GoogleEvent[];
}

/**
 * Lista eventos do Google Calendar do usuário logado dentro de uma janela.
 * Retorna `status: "needs_connect"` quando o usuário ainda não conectou
 * a conta Google — nesse caso, `events` vem vazio.
 */
export function useGoogleCalendarEvents(opts: {
  timeMin: Date;
  timeMax: Date;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const isoMin = opts.timeMin.toISOString();
  const isoMax = opts.timeMax.toISOString();

  return useQuery<ListGoogleEventsResult>({
    queryKey: ["google-calendar-events", user?.id, isoMin, isoMax],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<ListGoogleEventsResult>(
        "list-google-calendar-events",
        { body: { time_min: isoMin, time_max: isoMax } },
      );
      if (error) throw error;
      return data ?? { status: "ok", events: [] };
    },
    enabled: !!user && (opts.enabled ?? true),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
