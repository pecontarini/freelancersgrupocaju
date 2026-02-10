import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Attendance {
  id: string;
  schedule_id: string;
  employee_id: string;
  sector_id: string;
  attendance_date: string;
  shift_id: string;
  status: "presente" | "ausente";
  justificativa: string | null;
  remanejado_de_sector_id: string | null;
  remanejado_para_sector_id: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export function useAttendance(date: string, shiftId: string | null) {
  return useQuery({
    queryKey: ["attendance", date, shiftId],
    queryFn: async () => {
      if (!shiftId) return [];
      const { data, error } = await supabase
        .from("schedule_attendance")
        .select("*")
        .eq("attendance_date", date)
        .eq("shift_id", shiftId);
      if (error) throw error;
      return data as Attendance[];
    },
    enabled: !!shiftId,
  });
}

export function useMarkPresent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      schedule_id: string;
      employee_id: string;
      sector_id: string;
      attendance_date: string;
      shift_id: string;
    }) => {
      const { error } = await supabase
        .from("schedule_attendance")
        .upsert(
          {
            schedule_id: params.schedule_id,
            employee_id: params.employee_id,
            sector_id: params.sector_id,
            attendance_date: params.attendance_date,
            shift_id: params.shift_id,
            status: "presente",
            justificativa: null,
          },
          { onConflict: "schedule_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Presença registrada!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}

export function useMarkAbsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      schedule_id: string;
      employee_id: string;
      sector_id: string;
      attendance_date: string;
      shift_id: string;
      justificativa: string;
      remanejado_de_sector_id?: string;
      remanejado_para_sector_id?: string;
      notas?: string;
    }) => {
      const { error } = await supabase
        .from("schedule_attendance")
        .upsert(
          {
            schedule_id: params.schedule_id,
            employee_id: params.employee_id,
            sector_id: params.sector_id,
            attendance_date: params.attendance_date,
            shift_id: params.shift_id,
            status: "ausente",
            justificativa: params.justificativa,
            remanejado_de_sector_id: params.remanejado_de_sector_id || null,
            remanejado_para_sector_id: params.remanejado_para_sector_id || null,
            notas: params.notas || null,
          },
          { onConflict: "schedule_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast.success("Justificativa registrada!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
