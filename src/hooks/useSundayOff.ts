import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the list of Sundays (YYYY-MM-DD) in the given month
 * for which the employee has a schedule of type 'off' or 'vacation'.
 * Used to track CLT mandatory monthly Sunday rest.
 */
export function useEmployeeSundaysOff(
  employeeId: string | null,
  monthRef: string | null // YYYY-MM
) {
  return useQuery({
    queryKey: ["employee-sundays-off", employeeId, monthRef],
    queryFn: async () => {
      if (!employeeId || !monthRef) return [] as string[];
      const [yyyy, mm] = monthRef.split("-").map(Number);
      const start = `${yyyy}-${String(mm).padStart(2, "0")}-01`;
      const lastDay = new Date(yyyy, mm, 0).getDate();
      const end = `${yyyy}-${String(mm).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("schedules")
        .select("schedule_date, schedule_type")
        .eq("employee_id", employeeId)
        .gte("schedule_date", start)
        .lte("schedule_date", end)
        .in("schedule_type", ["off", "vacation"])
        .neq("status", "cancelled");

      if (error) throw error;
      // Filter only Sundays (DOW = 0)
      return (data || [])
        .filter((row) => {
          const d = new Date((row.schedule_date as string) + "T12:00:00");
          return d.getDay() === 0;
        })
        .map((row) => row.schedule_date as string)
        .sort();
    },
    enabled: !!employeeId && !!monthRef,
    staleTime: 60_000,
  });
}

export function monthRefFromDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T12:00:00") : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isSundayDate(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  return d.getDay() === 0;
}

export function formatSundayShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
