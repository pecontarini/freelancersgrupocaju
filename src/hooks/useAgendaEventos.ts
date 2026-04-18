import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AgendaCategoria = "reuniao" | "operacional" | "pessoal" | "outro";
export type ParticipanteStatus = "pendente" | "aceito" | "recusado" | "talvez";

export interface AgendaParticipante {
  user_id?: string | null;
  nome?: string | null;
  email: string;
  avatar_url?: string | null;
  status: ParticipanteStatus;
}

export interface AgendaEvento {
  id: string;
  user_id: string;
  google_event_id: string | null;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  categoria: AgendaCategoria;
  concluido: boolean;
  participantes: AgendaParticipante[];
  created_at: string;
}

export interface AgendaEventoUpsert {
  id?: string;
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim?: string | null;
  categoria: AgendaCategoria;
  concluido?: boolean;
  google_event_id?: string | null;
  participantes?: AgendaParticipante[];
}

// Normaliza status do Google → status local
export function mapGoogleStatus(g?: string | null): ParticipanteStatus {
  switch ((g ?? "").toLowerCase()) {
    case "accepted":
      return "aceito";
    case "declined":
      return "recusado";
    case "tentative":
      return "talvez";
    default:
      return "pendente";
  }
}

function normalizeParticipantes(raw: unknown): AgendaParticipante[] {
  if (!Array.isArray(raw)) return [];
  const out: AgendaParticipante[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const email = item.trim().toLowerCase();
      if (!email) continue;
      out.push({ email, status: "pendente" });
      continue;
    }
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const email = String(obj.email ?? "").trim().toLowerCase();
      if (!email) continue;
      const rawStatus = (obj.status as string) ?? "pendente";
      const status: ParticipanteStatus = (["pendente", "aceito", "recusado", "talvez"] as const).includes(
        rawStatus as ParticipanteStatus
      )
        ? (rawStatus as ParticipanteStatus)
        : "pendente";
      out.push({
        email,
        user_id: (obj.user_id as string | null) ?? null,
        nome: (obj.nome as string | null) ?? null,
        avatar_url: (obj.avatar_url as string | null) ?? null,
        status,
      });
    }
  }
  return out;
}

export function useAgendaEventos(opts?: { allUsers?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["agenda-eventos", user?.id, opts?.allUsers ? "all" : "self"],
    queryFn: async (): Promise<AgendaEvento[]> => {
      if (!user) return [];
      let q = supabase
        .from("agenda_eventos")
        .select("*")
        .order("data_inicio", { ascending: true });
      if (!opts?.allUsers) q = q.eq("user_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        participantes: normalizeParticipantes(r.participantes),
      })) as AgendaEvento[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (input: AgendaEventoUpsert) => {
      if (!user) throw new Error("Sem usuário.");
      const { data, error } = await supabase
        .from("agenda_eventos")
        .insert({
          user_id: user.id,
          titulo: input.titulo,
          descricao: input.descricao ?? null,
          data_inicio: input.data_inicio,
          data_fim: input.data_fim ?? null,
          categoria: input.categoria,
          concluido: input.concluido ?? false,
          google_event_id: input.google_event_id ?? null,
          participantes: (input.participantes ?? []) as any,
        } as any)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as AgendaEvento;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-eventos"] }),
  });

  const update = useMutation({
    mutationFn: async (input: AgendaEventoUpsert & { id: string }) => {
      const { error } = await supabase
        .from("agenda_eventos")
        .update({
          titulo: input.titulo,
          descricao: input.descricao ?? null,
          data_inicio: input.data_inicio,
          data_fim: input.data_fim ?? null,
          categoria: input.categoria,
          concluido: input.concluido ?? false,
          google_event_id: input.google_event_id ?? null,
          participantes: (input.participantes ?? []) as any,
        } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-eventos"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_eventos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-eventos"] }),
  });

  const toggleConcluido = useMutation({
    mutationFn: async (params: { id: string; concluido: boolean }) => {
      const { error } = await supabase
        .from("agenda_eventos")
        .update({ concluido: params.concluido })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-eventos"] }),
  });

  // Atualiza apenas participantes (usado na sincronização de status do Google)
  const updateParticipantes = useMutation({
    mutationFn: async (params: { id: string; participantes: AgendaParticipante[] }) => {
      const { error } = await supabase
        .from("agenda_eventos")
        .update({ participantes: params.participantes as any } as any)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-eventos"] }),
  });

  return { ...query, create, update, remove, toggleConcluido, updateParticipantes };
}
