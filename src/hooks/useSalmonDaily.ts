import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SalmonDailyRow {
  id: number;
  loja_id: string;
  transaction_date: string;
  initial_stock_kg: number;
  transfer_kg: number;
  final_stock_kg: number;
  consumption_kg: number;
  ratio_kg_per_1k: number;
  semaphore: "green" | "yellow" | "red" | "gray";
  revenue_brl: number | null;
  source: string | null;
}

export interface SalmonMonthlySummary {
  loja_id: string;
  month_ref: string;
  dias_registrados: number;
  dias_verde: number;
  dias_amarelo: number;
  dias_vermelho: number;
  ratio_avg: number | null;
  ratio_best: number | null;
  ratio_worst: number | null;
  consumption_total_kg: number | null;
}

export function useSalmonDaily(loja_id: string | null) {
  const dailyQuery = useQuery({
    queryKey: ["salmon-daily", loja_id],
    enabled: !!loja_id,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from("v_salmon_daily")
        .select("*")
        .eq("loja_id", loja_id)
        .gte("transaction_date", since.toISOString().split("T")[0])
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SalmonDailyRow[];
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["salmon-monthly-summary", loja_id],
    enabled: !!loja_id,
    queryFn: async () => {
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      const { data, error } = await (supabase as any)
        .from("v_salmon_monthly_summary")
        .select("*")
        .eq("loja_id", loja_id)
        .eq("month_ref", firstOfMonth.toISOString().split("T")[0])
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as SalmonMonthlySummary | null;
    },
  });

  return {
    data: dailyQuery.data ?? [],
    summary: summaryQuery.data ?? null,
    isLoading: dailyQuery.isLoading || summaryQuery.isLoading,
  };
}
