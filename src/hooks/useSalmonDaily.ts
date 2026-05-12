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
  created_at: string;
  updated_at: string;
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

export function useSalmonDaily(lojaId: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["salmon-daily", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceStr = since.toISOString().slice(0, 10);

      const [dailyRes, summaryRes] = await Promise.all([
        supabase
          .from("v_salmon_daily" as any)
          .select("*")
          .eq("loja_id", lojaId)
          .gte("transaction_date", sinceStr)
          .order("transaction_date", { ascending: true }),
        supabase
          .from("v_salmon_monthly_summary" as any)
          .select("*")
          .eq("loja_id", lojaId)
          .order("month_ref", { ascending: false })
          .limit(1),
      ]);

      if (dailyRes.error) throw dailyRes.error;
      if (summaryRes.error) throw summaryRes.error;

      const daily = ((dailyRes.data ?? []) as any[]).map((r) => ({
        ...r,
        initial_stock_kg: Number(r.initial_stock_kg ?? 0),
        transfer_kg: Number(r.transfer_kg ?? 0),
        final_stock_kg: Number(r.final_stock_kg ?? 0),
        consumption_kg: Number(r.consumption_kg ?? 0),
        ratio_kg_per_1k: Number(r.ratio_kg_per_1k ?? 0),
        revenue_brl: r.revenue_brl !== null && r.revenue_brl !== undefined ? Number(r.revenue_brl) : null,
      })) as SalmonDailyRow[];

      const summary = (summaryRes.data?.[0] as any) ?? null;
      const summaryParsed: SalmonMonthlySummary | null = summary
        ? {
            ...summary,
            dias_registrados: Number(summary.dias_registrados ?? 0),
            dias_verde: Number(summary.dias_verde ?? 0),
            dias_amarelo: Number(summary.dias_amarelo ?? 0),
            dias_vermelho: Number(summary.dias_vermelho ?? 0),
            ratio_avg: summary.ratio_avg !== null ? Number(summary.ratio_avg) : null,
            ratio_best: summary.ratio_best !== null ? Number(summary.ratio_best) : null,
            ratio_worst: summary.ratio_worst !== null ? Number(summary.ratio_worst) : null,
            consumption_total_kg:
              summary.consumption_total_kg !== null ? Number(summary.consumption_total_kg) : null,
          }
        : null;

      return { daily, summary: summaryParsed };
    },
  });

  return {
    data: data?.daily ?? [],
    summary: data?.summary ?? null,
    isLoading,
  };
}
