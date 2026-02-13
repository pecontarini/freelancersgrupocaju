import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface D1Schedule {
  id: string;
  schedule_date: string;
  employee_id: string | null;
  employee_name: string;
  employee_phone: string | null;
  job_title: string | null;
  worker_type: string;
  sector_name: string;
  sector_id: string;
  start_time: string | null;
  end_time: string | null;
  schedule_type: string;
  confirmation_status: string | null;
  denial_reason: string | null;
}

export function useD1Schedules(unitId: string | null, date: string) {
  return useQuery({
    queryKey: ["d1-schedules", unitId, date],
    queryFn: async () => {
      if (!unitId) return [];

      const { data: sectors } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("unit_id", unitId);

      if (!sectors?.length) return [];

      const sectorIds = sectors.map((s) => s.id);
      const sectorMap = new Map(sectors.map((s) => [s.id, s.name]));

      const { data: schedules, error } = await supabase
        .from("schedules")
        .select(`
          id, schedule_date, employee_id, sector_id,
          start_time, end_time, schedule_type,
          confirmation_status, denial_reason,
          employees!schedules_employee_id_fkey ( name, phone, job_title, worker_type )
        `)
        .in("sector_id", sectorIds)
        .eq("schedule_date", date)
        .neq("status", "cancelled")
        .eq("schedule_type", "working");

      if (error) throw error;

      return (schedules || []).map((s: any) => ({
        id: s.id,
        schedule_date: s.schedule_date,
        employee_id: s.employee_id,
        employee_name: s.employees?.name || "—",
        employee_phone: s.employees?.phone || null,
        job_title: s.employees?.job_title || null,
        worker_type: s.employees?.worker_type || "clt",
        sector_name: sectorMap.get(s.sector_id) || "—",
        sector_id: s.sector_id,
        start_time: s.start_time,
        end_time: s.end_time,
        schedule_type: s.schedule_type,
        confirmation_status: s.confirmation_status,
        denial_reason: s.denial_reason,
      })) as D1Schedule[];
    },
    enabled: !!unitId,
    refetchInterval: 30_000,
  });
}
