import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyRosterRow {
  schedule_id: string;
  employee_id: string | null;
  employee_name: string;
  job_title: string | null;
  worker_type: string;
  sector_id: string;
  sector_name: string;
  start_time: string | null; // HH:MM:SS
  end_time: string | null;
  break_duration: number; // minutos previstos
  schedule_date: string;
}

/**
 * Lista todos os escalados (schedule_type = 'working') de uma unidade em uma data,
 * agrupando por setor — para o painel de Intervalos e a folha de controle PDF.
 */
export function useDailyRoster(unitId: string | null, date: string) {
  return useQuery({
    queryKey: ["daily-roster", unitId, date],
    enabled: !!unitId && !!date,
    staleTime: 30_000,
    queryFn: async () => {
      if (!unitId) return [] as DailyRosterRow[];

      const { data: sectors, error: sErr } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("unit_id", unitId);
      if (sErr) throw sErr;
      if (!sectors?.length) return [];

      const sectorIds = sectors.map((s) => s.id);
      const sectorMap = new Map(sectors.map((s) => [s.id, s.name]));

      const { data: schedules, error } = await supabase
        .from("schedules")
        .select(`
          id, schedule_date, employee_id, sector_id,
          start_time, end_time, break_duration, schedule_type,
          shifts!schedules_shift_id_fkey ( start_time, end_time ),
          employees!schedules_employee_id_fkey ( id, name, job_title, worker_type )
        `)
        .in("sector_id", sectorIds)
        .eq("schedule_date", date)
        .eq("schedule_type", "working")
        .neq("status", "cancelled");
      if (error) throw error;

      const rows: DailyRosterRow[] = (schedules || []).map((s: any) => ({
        schedule_id: s.id,
        employee_id: s.employee_id,
        employee_name: s.employees?.name || "—",
        job_title: s.employees?.job_title || null,
        worker_type: s.employees?.worker_type || "clt",
        sector_id: s.sector_id,
        sector_name: sectorMap.get(s.sector_id) || "—",
        start_time: s.start_time || s.shifts?.start_time || null,
        end_time: s.end_time || s.shifts?.end_time || null,
        break_duration: s.break_duration || 0,
        schedule_date: s.schedule_date,
      }));

      rows.sort((a, b) => {
        const sd = a.sector_name.localeCompare(b.sector_name, "pt-BR");
        if (sd !== 0) return sd;
        const ta = a.start_time || "99:99";
        const tb = b.start_time || "99:99";
        if (ta !== tb) return ta.localeCompare(tb);
        return a.employee_name.localeCompare(b.employee_name, "pt-BR");
      });

      return rows;
    },
  });
}
