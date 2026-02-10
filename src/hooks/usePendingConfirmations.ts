import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { format, addDays } from "date-fns";

export function usePendingConfirmations() {
  const { effectiveUnidadeId } = useUnidade();
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["pending-confirmations", effectiveUnidadeId, tomorrow],
    queryFn: async () => {
      if (!effectiveUnidadeId) return { total: 0, pending: 0, confirmed: 0, denied: 0 };

      // Get sectors for this unit
      const { data: sectors } = await supabase
        .from("sectors")
        .select("id")
        .eq("unit_id", effectiveUnidadeId);

      if (!sectors?.length) return { total: 0, pending: 0, confirmed: 0, denied: 0 };

      const sectorIds = sectors.map((s) => s.id);

      const { data: schedules, error } = await supabase
        .from("schedules")
        .select("id, confirmation_status")
        .in("sector_id", sectorIds)
        .eq("schedule_date", tomorrow)
        .neq("status", "cancelled");

      if (error) throw error;

      const total = schedules?.length || 0;
      const confirmed = schedules?.filter((s) => s.confirmation_status === "confirmed").length || 0;
      const denied = schedules?.filter((s) => s.confirmation_status === "denied").length || 0;
      const pending = total - confirmed - denied;

      return { total, pending, confirmed, denied };
    },
    enabled: !!effectiveUnidadeId,
    refetchInterval: 60_000, // refresh every minute
  });
}
