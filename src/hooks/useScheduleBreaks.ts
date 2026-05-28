import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScheduleBreak {
  id: string;
  schedule_id: string;
  unit_id: string;
  schedule_date: string;
  started_at: string | null;
  ended_at: string | null;
  planned_minutes: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = (unitId: string | null, date: string) => ["schedule-breaks", unitId, date];

export function useScheduleBreaks(unitId: string | null, date: string) {
  return useQuery({
    queryKey: KEY(unitId, date),
    enabled: !!unitId && !!date,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!unitId) return [] as ScheduleBreak[];
      const { data, error } = await supabase
        .from("schedule_breaks")
        .select("*")
        .eq("unit_id", unitId)
        .eq("schedule_date", date)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ScheduleBreak[];
    },
  });
}

export function useStartBreak(unitId: string | null, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      schedule_id: string;
      unit_id: string;
      schedule_date: string;
      planned_minutes?: number | null;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("schedule_breaks").insert({
        schedule_id: params.schedule_id,
        unit_id: params.unit_id,
        schedule_date: params.schedule_date,
        started_at: new Date().toISOString(),
        ended_at: null,
        planned_minutes: params.planned_minutes ?? null,
        created_by: userRes?.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(unitId, date) });
      toast.success("Intervalo iniciado");
    },
    onError: (e: any) => toast.error("Erro ao iniciar: " + (e?.message || e)),
  });
}

export function useEndBreak(unitId: string | null, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (breakId: string) => {
      const { error } = await supabase
        .from("schedule_breaks")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", breakId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(unitId, date) });
      toast.success("Intervalo encerrado");
    },
    onError: (e: any) => toast.error("Erro ao encerrar: " + (e?.message || e)),
  });
}

export function useUpsertManualBreak(unitId: string | null, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string;
      schedule_id: string;
      unit_id: string;
      schedule_date: string;
      started_at: string | null; // ISO
      ended_at: string | null;
      planned_minutes?: number | null;
      notes?: string | null;
    }) => {
      if (params.id) {
        const { error } = await supabase
          .from("schedule_breaks")
          .update({
            started_at: params.started_at,
            ended_at: params.ended_at,
            notes: params.notes ?? null,
          })
          .eq("id", params.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase.from("schedule_breaks").insert({
          schedule_id: params.schedule_id,
          unit_id: params.unit_id,
          schedule_date: params.schedule_date,
          started_at: params.started_at,
          ended_at: params.ended_at,
          planned_minutes: params.planned_minutes ?? null,
          notes: params.notes ?? null,
          created_by: userRes?.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(unitId, date) });
      toast.success("Intervalo salvo");
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + (e?.message || e)),
  });
}

export function useDeleteBreak(unitId: string | null, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (breakId: string) => {
      const { error } = await supabase.from("schedule_breaks").delete().eq("id", breakId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(unitId, date) });
      toast.success("Intervalo removido");
    },
    onError: (e: any) => toast.error("Erro ao remover: " + (e?.message || e)),
  });
}
