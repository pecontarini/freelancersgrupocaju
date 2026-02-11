import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DailyBudget {
  id: string;
  date: string;
  unit_id: string;
  budget_amount: number;
  created_at: string;
  updated_at: string;
}

export function useDailyBudgets(unitId: string | null, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["daily-budgets", unitId, startDate, endDate],
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase
        .from("daily_budgets")
        .select("*")
        .eq("unit_id", unitId)
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;
      return (data || []) as DailyBudget[];
    },
    enabled: !!unitId,
  });
}

export function useUpsertDailyBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      date: string;
      unit_id: string;
      budget_amount: number;
    }) => {
      const { error } = await supabase
        .from("daily_budgets")
        .upsert(
          {
            date: params.date,
            unit_id: params.unit_id,
            budget_amount: params.budget_amount,
          },
          { onConflict: "date,unit_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-budgets"] });
      toast.success("Verba atualizada!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
