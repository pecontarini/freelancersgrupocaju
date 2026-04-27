// Junta o contexto operacional que a IA precisa para propor a escala de uma semana/setor.
// Tudo já filtrado por unidade — não vaza dados de outras lojas.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format, parseISO, startOfWeek } from "date-fns";

export type AIScheduleContext = {
  weekDates: string[]; // 7 datas YYYY-MM-DD começando segunda
  employees: Array<{
    id: string;
    name: string;
    job_title: string | null;
    worker_type: string | null;
    weekly_hours_target: number; // 44 default
  }>;
  staffing: Array<{
    sector_id: string;
    sector_name: string;
    day_of_week: number; // 0=Dom..6=Sab (JS)
    shift_type: string;
    required_count: number;
  }>;
  existingShifts: Array<{
    employee_id: string;
    employee_name: string;
    date: string;
    schedule_type: string;
    shift_type?: string;
    start_time?: string | null;
    end_time?: string | null;
    break_min?: number;
    sector_id?: string | null;
  }>;
  absences: Array<{
    employee_id: string;
    employee_name: string;
    date: string;
    reason: string; // 'vacation' | 'sick_leave' | 'off'
  }>;
};

export function useScheduleAIContext(params: {
  unitId: string | null;
  sectorId: string | null;
  weekStart: string | null; // YYYY-MM-DD da segunda
}) {
  const { unitId, sectorId, weekStart } = params;
  return useQuery({
    queryKey: ["schedule-ai-context", unitId, sectorId, weekStart],
    enabled: !!unitId && !!sectorId && !!weekStart,
    queryFn: async (): Promise<AIScheduleContext> => {
      const monday = parseISO(weekStart!);
      const weekDates = Array.from({ length: 7 }, (_, i) =>
        format(addDays(monday, i), "yyyy-MM-dd")
      );
      const weekEnd = weekDates[6];

      // Funcionários do setor (via sector_job_titles → job_titles → employees)
      const { data: sjt } = await supabase
        .from("sector_job_titles" as any)
        .select("job_title_id")
        .eq("sector_id", sectorId!);
      const jobTitleIds = (sjt as any[] | null)?.map((r) => r.job_title_id) ?? [];

      let employees: AIScheduleContext["employees"] = [];
      if (jobTitleIds.length > 0) {
        const { data: emps } = await supabase
          .from("employees")
          .select("id, name, job_title, worker_type, job_title_id, job_titles(name)")
          .eq("unit_id", unitId!)
          .eq("active", true)
          .in("job_title_id", jobTitleIds);
        employees =
          (emps as any[] | null)?.map((e) => ({
            id: e.id,
            name: e.name,
            job_title: e.job_titles?.name ?? e.job_title ?? null,
            worker_type: e.worker_type ?? "clt",
            weekly_hours_target: 44,
          })) ?? [];
      }

      // Tabela mínima POP do setor
      const { data: matrix } = await supabase
        .from("staffing_matrix")
        .select("sector_id, day_of_week, shift_type, required_count")
        .eq("sector_id", sectorId!);
      const { data: sec } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("id", sectorId!)
        .maybeSingle();
      const sectorName = (sec as any)?.name ?? "Setor";
      const staffing =
        (matrix as any[] | null)?.map((r) => ({
          sector_id: r.sector_id,
          sector_name: sectorName,
          day_of_week: r.day_of_week as number,
          shift_type: r.shift_type as string,
          required_count: r.required_count as number,
        })) ?? [];

      // Escalas existentes (semana anterior + atual + posterior, p/ interjornada)
      const empIds = employees.map((e) => e.id);
      const rangeStart = format(addDays(monday, -1), "yyyy-MM-dd");
      const rangeEnd = format(addDays(monday, 8), "yyyy-MM-dd");
      let existingShifts: AIScheduleContext["existingShifts"] = [];
      let absences: AIScheduleContext["absences"] = [];
      if (empIds.length > 0) {
        const { data: schs } = await supabase
          .from("schedules")
          .select("employee_id, schedule_date, schedule_type, sector_id, start_time, end_time, break_duration, shifts(name)")
          .in("employee_id", empIds)
          .gte("schedule_date", rangeStart)
          .lte("schedule_date", rangeEnd)
          .neq("status", "cancelled");
        const empName = new Map(employees.map((e) => [e.id, e.name]));
        for (const s of (schs as any[]) ?? []) {
          if (s.schedule_type === "working") {
            existingShifts.push({
              employee_id: s.employee_id,
              employee_name: empName.get(s.employee_id) ?? s.employee_id,
              date: s.schedule_date,
              schedule_type: s.schedule_type,
              shift_type: s.shifts?.name ?? undefined,
              start_time: s.start_time,
              end_time: s.end_time,
              break_min: s.break_duration ?? 0,
              sector_id: s.sector_id,
            });
          } else if (s.schedule_date >= weekStart! && s.schedule_date <= weekEnd) {
            absences.push({
              employee_id: s.employee_id,
              employee_name: empName.get(s.employee_id) ?? s.employee_id,
              date: s.schedule_date,
              reason: s.schedule_type,
            });
          }
        }
      }

      return { weekDates, employees, staffing, existingShifts, absences };
    },
  });
}
