import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetchAllRows";

/* ============================================================
 * Tipos
 * ========================================================== */
export interface HoldingStaffingConfigRow {
  id: string;
  unit_id: string;
  brand: string;
  sector_key: string;
  shift_type: "almoco" | "jantar";
  day_of_week: number;
  month_year: string;
  required_count: number;
  extras_count: number;
  notes: string | null;
}

export interface HoldingFreelancerForecastRow {
  id: string;
  unit_id: string;
  brand: string;
  forecast_date: string;
  sector_key: string;
  shift_type: "almoco" | "jantar";
  freelancer_count: number;
  reason: string | null;
}

export interface HoldingFreelancerRateRow {
  id: string;
  unit_id: string;
  brand: string;
  sector_key: string;
  daily_rate: number;
  effective_from: string;
  notes: string | null;
}

/* ============================================================
 * STAFFING CONFIG (F1 + F4)
 * ========================================================== */
export function useHoldingStaffingConfig(unitId: string | null, monthYear: string | null) {
  return useQuery({
    queryKey: ["holding_staffing_config", unitId, monthYear],
    queryFn: async () => {
      if (!unitId || !monthYear) return [] as HoldingStaffingConfigRow[];
      const rows = await fetchAllRows<HoldingStaffingConfigRow>(() =>
        supabase
          .from("holding_staffing_config")
          .select("*")
          .eq("unit_id", unitId)
          .eq("month_year", monthYear),
      );
      return rows;
    },
    enabled: !!unitId && !!monthYear,
  });
}

export function useUpsertHoldingStaffing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      unit_id: string;
      brand: string;
      sector_key: string;
      shift_type: "almoco" | "jantar";
      day_of_week: number;
      month_year: string;
      required_count: number;
      extras_count?: number;
    }) => {
      const { error } = await supabase
        .from("holding_staffing_config")
        .upsert(
          {
            ...row,
            extras_count: row.extras_count ?? 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "unit_id,sector_key,shift_type,day_of_week,month_year" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holding_staffing_config"] });
      qc.invalidateQueries({ queryKey: ["staffing_matrix"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar mínimo: " + e.message),
  });
}

/* ============================================================
 * FREELANCER FORECAST (F2)
 * ========================================================== */
export function useHoldingFreelancerForecast(
  unitId: string | null,
  monthYear: string | null, // 'YYYY-MM'
) {
  return useQuery({
    queryKey: ["holding_freelancer_forecast", unitId, monthYear],
    queryFn: async () => {
      if (!unitId || !monthYear) return [] as HoldingFreelancerForecastRow[];
      const start = `${monthYear}-01`;
      // último dia do mês
      const [y, m] = monthYear.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${monthYear}-${String(lastDay).padStart(2, "0")}`;
      const rows = await fetchAllRows<HoldingFreelancerForecastRow>(() =>
        supabase
          .from("holding_freelancer_forecast")
          .select("*")
          .eq("unit_id", unitId)
          .gte("forecast_date", start)
          .lte("forecast_date", end),
      );
      return rows;
    },
    enabled: !!unitId && !!monthYear,
  });
}

export function useUpsertHoldingForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      unit_id: string;
      brand: string;
      forecast_date: string;
      sector_key: string;
      shift_type: "almoco" | "jantar";
      freelancer_count: number;
      reason?: string | null;
    }) => {
      const { error } = await supabase
        .from("holding_freelancer_forecast")
        .upsert(
          {
            ...row,
            reason: row.reason ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "unit_id,forecast_date,sector_key,shift_type" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holding_freelancer_forecast"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar previsão: " + e.message),
  });
}

export function useDeleteHoldingForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("holding_freelancer_forecast")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holding_freelancer_forecast"] });
      toast.success("Previsão removida.");
    },
    onError: (e: Error) => toast.error("Erro ao remover: " + e.message),
  });
}

/* ============================================================
 * FREELANCER RATES (F3)
 * ========================================================== */
export function useHoldingFreelancerRates(unitId: string | null) {
  return useQuery({
    queryKey: ["holding_freelancer_rates", unitId],
    queryFn: async () => {
      if (!unitId) return [] as HoldingFreelancerRateRow[];
      const rows = await fetchAllRows<HoldingFreelancerRateRow>(() =>
        supabase
          .from("holding_freelancer_rates")
          .select("*")
          .eq("unit_id", unitId),
      );
      return rows;
    },
    enabled: !!unitId,
  });
}

export function useUpsertHoldingRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      unit_id: string;
      brand: string;
      sector_key: string;
      daily_rate: number;
    }) => {
      const { error } = await supabase
        .from("holding_freelancer_rates")
        .upsert(
          {
            ...row,
            effective_from: new Date().toISOString().slice(0, 10),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "unit_id,sector_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["holding_freelancer_rates"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar diária: " + e.message),
  });
}
