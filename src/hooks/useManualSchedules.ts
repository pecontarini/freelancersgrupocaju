import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ManualSchedule {
  id: string;
  user_id: string;
  employee_id: string | null;
  schedule_date: string;
  shift_id: string;
  sector_id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  break_duration: number;
  schedule_type: "working" | "off" | "vacation" | "sick_leave";
  agreed_rate: number;
  created_at: string;
  updated_at: string;
}

export function useManualSchedules(unitId: string | null, weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["manual-schedules", unitId, weekStart, weekEnd],
    queryFn: async () => {
      if (!unitId) return [];

      // Get all sectors for this unit
      const { data: sectors } = await supabase
        .from("sectors")
        .select("id")
        .eq("unit_id", unitId);

      if (!sectors || sectors.length === 0) return [];

      const sectorIds = sectors.map((s) => s.id);

      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .in("sector_id", sectorIds)
        .gte("schedule_date", weekStart)
        .lte("schedule_date", weekEnd)
        .neq("status", "cancelled");

      if (error) throw error;
      return (data || []) as ManualSchedule[];
    },
    enabled: !!unitId,
  });
}

export function useUpsertSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id?: string;
      employee_id: string;
      schedule_date: string;
      sector_id: string;
      start_time?: string | null;
      end_time?: string | null;
      break_duration?: number;
      schedule_type: "working" | "off" | "vacation" | "sick_leave";
      agreed_rate?: number;
    }) => {
      const payload: any = {
        employee_id: params.employee_id,
        user_id: params.employee_id, // legacy column
        schedule_date: params.schedule_date,
        sector_id: params.sector_id,
        status: "scheduled",
        schedule_type: params.schedule_type,
        start_time: params.start_time || null,
        end_time: params.end_time || null,
        break_duration: params.break_duration ?? 60,
        agreed_rate: params.agreed_rate ?? 0,
      };

      // We need a shift_id (required column). Get default shift.
      const { data: shifts } = await supabase
        .from("shifts")
        .select("id")
        .limit(1);

      if (!shifts || shifts.length === 0) {
        throw new Error("Nenhum turno cadastrado. Cadastre pelo menos um turno.");
      }

      payload.shift_id = shifts[0].id;

      if (params.id) {
        const { error } = await supabase
          .from("schedules")
          .update(payload)
          .eq("id", params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("schedules")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      toast.success("Escala salva!");
    },
    onError: (err: Error) => {
      toast.error(err.message, { duration: 6000 });
    },
  });
}

export function useCancelSchedule() {
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
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      toast.success("Escala removida!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useCopyPreviousDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      sourceDate: string;
      targetDate: string;
      unitId: string;
    }) => {
      // Get sectors for unit
      const { data: sectors } = await supabase
        .from("sectors")
        .select("id")
        .eq("unit_id", params.unitId);

      if (!sectors || sectors.length === 0) return;

      const sectorIds = sectors.map((s) => s.id);

      // Get schedules from source day
      const { data: sourceSchedules, error: fetchErr } = await supabase
        .from("schedules")
        .select("*")
        .in("sector_id", sectorIds)
        .eq("schedule_date", params.sourceDate)
        .neq("status", "cancelled");

      if (fetchErr) throw fetchErr;
      if (!sourceSchedules || sourceSchedules.length === 0) {
        throw new Error("Nenhuma escala encontrada no dia anterior.");
      }

      // Check for existing entries on target date
      const { data: existing } = await supabase
        .from("schedules")
        .select("employee_id")
        .in("sector_id", sectorIds)
        .eq("schedule_date", params.targetDate)
        .neq("status", "cancelled");

      const existingIds = new Set((existing || []).map((e) => e.employee_id));

      const toInsert = sourceSchedules
        .filter((s) => !existingIds.has(s.employee_id))
        .map((s) => ({
          employee_id: s.employee_id!,
          user_id: s.employee_id!, // legacy
          schedule_date: params.targetDate,
          shift_id: s.shift_id,
          sector_id: s.sector_id,
          status: "scheduled",
          start_time: s.start_time,
          end_time: s.end_time,
          break_duration: s.break_duration,
          schedule_type: s.schedule_type,
          agreed_rate: s.agreed_rate,
        }));

      if (toInsert.length === 0) {
        throw new Error("Todos os funcionários já estão escalados neste dia.");
      }

      const { error } = await supabase.from("schedules").insert(toInsert);
      if (error) throw error;

      return toInsert.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      toast.success(`${count} escala(s) copiada(s)!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
