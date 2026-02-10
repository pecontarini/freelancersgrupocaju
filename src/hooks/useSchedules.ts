import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Schedule {
  id: string;
  user_id: string;
  employee_id: string | null;
  schedule_date: string;
  shift_id: string;
  sector_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useSchedules(sectorId: string | null, weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["schedules", sectorId, weekStart, weekEnd],
    queryFn: async () => {
      if (!sectorId) return [];
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("sector_id", sectorId)
        .gte("schedule_date", weekStart)
        .lte("schedule_date", weekEnd)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!sectorId,
  });
}

export function useSchedulesBySector(sectorIds: string[], weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["schedules-multi", sectorIds, weekStart, weekEnd],
    queryFn: async () => {
      if (sectorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .in("sector_id", sectorIds)
        .gte("schedule_date", weekStart)
        .lte("schedule_date", weekEnd)
        .neq("status", "cancelled");
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: sectorIds.length > 0,
  });
}

export function useAddSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      employee_id: string;
      schedule_date: string;
      shift_id: string;
      sector_id: string;
    }) => {
      // First validate CLT rules
      const { data: validation, error: valError } = await supabase.rpc(
        "validate_schedule_clt",
        {
          p_employee_id: params.employee_id,
          p_schedule_date: params.schedule_date,
          p_shift_id: params.shift_id,
          p_sector_id: params.sector_id,
        }
      );

      if (valError) throw valError;

      const result = validation as { valid: boolean; errors: string[] };
      if (!result.valid) {
        throw new Error(result.errors.join("\n"));
      }

      // Insert schedule
      const { error } = await supabase.from("schedules").insert({
        user_id: params.employee_id, // legacy column
        employee_id: params.employee_id,
        schedule_date: params.schedule_date,
        shift_id: params.shift_id,
        sector_id: params.sector_id,
        status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules-multi"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (err: Error) => {
      toast.error(err.message, { duration: 8000 });
    },
  });
}

export function useRemoveSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("schedules")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules-multi"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Escala removida!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
