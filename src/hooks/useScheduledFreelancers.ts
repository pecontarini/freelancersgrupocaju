import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduledFreelancer {
  scheduleId: string;
  employeeId: string;
  employeeName: string;
  cpf: string | null;
  jobTitle: string | null;
  startTime: string | null;
  endTime: string | null;
  agreedRate: number | null;
  scheduleDate: string;
}

export function useScheduledFreelancers(unitId?: string, date?: string) {
  return useQuery({
    queryKey: ["scheduled-freelancers", unitId, date],
    queryFn: async () => {
      if (!unitId || !date) return [];

      const { data, error } = await supabase
        .from("schedules")
        .select(`
          id,
          schedule_date,
          start_time,
          end_time,
          agreed_rate,
          employee_id,
          employees!inner (
            id,
            name,
            cpf,
            job_title,
            worker_type
          )
        `)
        .eq("employees.unit_id", unitId)
        .eq("employees.worker_type", "freelancer")
        .eq("schedule_date", date)
        .in("status", ["working", "confirmed", "scheduled"]);

      if (error) throw error;

      return (data || []).map((s: any) => ({
        scheduleId: s.id,
        employeeId: s.employee_id,
        employeeName: s.employees?.name || "Sem nome",
        cpf: s.employees?.cpf || null,
        jobTitle: s.employees?.job_title || null,
        startTime: s.start_time,
        endTime: s.end_time,
        agreedRate: s.agreed_rate,
        scheduleDate: s.schedule_date,
      })) as ScheduledFreelancer[];
    },
    enabled: !!unitId && !!date,
  });
}
