import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { SECTOR_LABELS, type SectorKey } from "@/lib/holding/sectors";

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

/* ============================================================
 * EFFECTIVE HEADCOUNT POR SETOR (CLT contratados ativos)
 * Usado para calcular Necess. × Efet. × Gap no painel de mínimos.
 * Cadeia: sectors (unit_id, name) ← sector_job_titles ← employees
 * ========================================================== */
export function useEffectiveHeadcountBySector(unitId: string | null) {
  return useQuery({
    queryKey: ["effective_headcount_by_sector", unitId],
    enabled: !!unitId,
    queryFn: async (): Promise<Record<SectorKey, number>> => {
      const empty = Object.fromEntries(
        (Object.keys(SECTOR_LABELS) as SectorKey[]).map((k) => [k, 0]),
      ) as Record<SectorKey, number>;
      if (!unitId) return empty;

      // 1) setores da unidade, filtrando por nome canônico (SECTOR_LABELS)
      const labels = Object.values(SECTOR_LABELS);
      const { data: secs } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("unit_id", unitId)
        .in("name", labels);
      const sectorList = (secs as Array<{ id: string; name: string }> | null) ?? [];
      if (sectorList.length === 0) return empty;

      // mapa: sector_id -> SectorKey
      const labelToKey = new Map<string, SectorKey>();
      for (const [k, label] of Object.entries(SECTOR_LABELS)) {
        labelToKey.set(label, k as SectorKey);
      }
      const sectorIdToKey = new Map<string, SectorKey>();
      for (const s of sectorList) {
        const k = labelToKey.get(s.name);
        if (k) sectorIdToKey.set(s.id, k);
      }

      // 2) job_titles vinculados a cada setor
      const sectorIds = sectorList.map((s) => s.id);
      const { data: sjt } = await supabase
        .from("sector_job_titles" as any)
        .select("sector_id, job_title_id")
        .in("sector_id", sectorIds);
      const jobTitleToSector = new Map<string, SectorKey>();
      for (const row of ((sjt as unknown) as Array<{ sector_id: string; job_title_id: string }> | null) ?? []) {
        const k = sectorIdToKey.get(row.sector_id);
        if (k && !jobTitleToSector.has(row.job_title_id)) {
          jobTitleToSector.set(row.job_title_id, k);
        }
      }

      // 3) employees CLT ativos da unidade
      const { data: emps } = await supabase
        .from("employees")
        .select("id, job_title_id, worker_type, active, unit_id")
        .eq("unit_id", unitId)
        .eq("active", true)
        .eq("worker_type", "clt");

      const counts: Record<SectorKey, number> = { ...empty };
      for (const e of (emps as Array<{ job_title_id: string | null }> | null) ?? []) {
        if (!e.job_title_id) continue;
        const k = jobTitleToSector.get(e.job_title_id);
        if (k) counts[k] += 1;
      }
      return counts;
    },
  });
}
