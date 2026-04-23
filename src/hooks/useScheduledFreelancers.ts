import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduledFreelancer {
  scheduleId: string;        // schedule.id OR `manual:<entry.id>` for manual entries
  entryId: string | null;    // freelancer_entries.id when source is manual
  source: "schedule" | "manual";
  employeeId: string | null;
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

      // (A) Schedules — freelancers escalados na grade
      const schedulesPromise = supabase
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

      // (B) Manual entries — lançamentos do Budget Gerencial com CPF para a data
      const entriesPromise = supabase
        .from("freelancer_entries")
        .select("id, nome_completo, cpf, funcao, valor, data_pop, loja_id, origem")
        .eq("loja_id", unitId)
        .eq("data_pop", date)
        .eq("origem", "manual");

      const [{ data: schedulesData, error: schedulesError }, { data: entriesData, error: entriesError }] =
        await Promise.all([schedulesPromise, entriesPromise]);

      if (schedulesError) throw schedulesError;
      if (entriesError) throw entriesError;

      const fromSchedules: ScheduledFreelancer[] = (schedulesData || []).map((s: any) => ({
        scheduleId: s.id,
        entryId: null,
        source: "schedule",
        employeeId: s.employee_id,
        employeeName: s.employees?.name || "Sem nome",
        cpf: s.employees?.cpf || null,
        jobTitle: s.employees?.job_title || null,
        startTime: s.start_time,
        endTime: s.end_time,
        agreedRate: s.agreed_rate,
        scheduleDate: s.schedule_date,
      }));

      // CPFs already covered by schedules — dedupe manual entries against them
      const scheduledCpfs = new Set(
        fromSchedules
          .map((s) => (s.cpf || "").replace(/\D/g, ""))
          .filter((c) => c.length === 11)
      );

      const fromEntries: ScheduledFreelancer[] = (entriesData || [])
        .filter((e: any) => {
          const clean = (e.cpf || "").replace(/\D/g, "");
          return clean.length === 11 && !scheduledCpfs.has(clean);
        })
        .map((e: any) => ({
          scheduleId: `manual:${e.id}`,
          entryId: e.id,
          source: "manual",
          employeeId: null,
          employeeName: e.nome_completo || "Sem nome",
          cpf: e.cpf || null,
          jobTitle: e.funcao || null,
          startTime: null,
          endTime: null,
          agreedRate: e.valor != null ? Number(e.valor) : null,
          scheduleDate: e.data_pop,
        }));

      return [...fromSchedules, ...fromEntries];
    },
    enabled: !!unitId && !!date,
  });
}
