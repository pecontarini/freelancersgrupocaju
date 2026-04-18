import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AgendaCategoria = "reuniao" | "operacional" | "pessoal" | "outro";

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
      return (data ?? []) as AgendaEvento[];
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
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as AgendaEvento;
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
        })
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

  return { ...query, create, update, remove, toggleConcluido };
}
