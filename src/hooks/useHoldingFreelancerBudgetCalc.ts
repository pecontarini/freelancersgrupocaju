import { useMemo } from "react";
import {
  useHoldingStaffingConfig,
  useHoldingFreelancerForecast,
  useHoldingFreelancerRates,
  useEffectiveHeadcountBySector,
} from "./useHoldingConfig";
import {
  SECTOR_LABELS,
  sectorsForBrand,
  type Brand,
  type SectorKey,
} from "@/lib/holding/sectors";

const DEFAULT_RATE = 120;

/**
 * Conta quantas vezes cada day-of-week (0=Dom..6=Sáb) ocorre no mês YYYY-MM.
 */
export function daysOfWeekInMonth(monthYear: string): Record<number, number> {
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const [y, m] = monthYear.split("-").map(Number);
  if (!y || !m) return counts;
  const lastDay = new Date(y, m, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    counts[dow] = (counts[dow] ?? 0) + 1;
  }
  return counts;
}

export interface SectorBudgetBreakdown {
  sector: SectorKey;
  label: string;
  gapDiarias: number;       // diárias estruturais (gap × dias do mês)
  pontuaisDiarias: number;  // soma das previsões pontuais
  totalDiarias: number;     // gap + pontuais
  rate: number;             // diária do setor
  subtotal: number;         // totalDiarias × rate
}

export interface HoldingBudgetCalcResult {
  perSector: SectorBudgetBreakdown[];
  totalDiarias: number;
  totalGapDiarias: number;
  totalPontuaisDiarias: number;
  totalBudget: number;
  isLoading: boolean;
  isFetching: boolean;
}

/**
 * Cruza:
 *   - mínimos dimensionados (holding_staffing_config)
 *   - efetivo CLT por setor (useEffectiveHeadcountBySector)
 *   - previsões pontuais (holding_freelancer_forecast)
 *   - diárias por setor (holding_freelancer_rates)
 *
 * Retorna o budget previsto de freelancers do mês, com breakdown por setor.
 */
export function useHoldingFreelancerBudgetCalc(
  unitId: string | null,
  monthYear: string | null,
  brand: Brand | null,
): HoldingBudgetCalcResult {
  const staffingQ = useHoldingStaffingConfig(unitId, monthYear);
  const forecastQ = useHoldingFreelancerForecast(unitId, monthYear);
  const ratesQ = useHoldingFreelancerRates(unitId);
  const headcountQ = useEffectiveHeadcountBySector(unitId);

  const result = useMemo<HoldingBudgetCalcResult>(() => {
    const sectors: SectorKey[] = brand ? sectorsForBrand(brand) : [];
    const empty: HoldingBudgetCalcResult = {
      perSector: [],
      totalDiarias: 0,
      totalGapDiarias: 0,
      totalPontuaisDiarias: 0,
      totalBudget: 0,
      isLoading: staffingQ.isLoading || forecastQ.isLoading || ratesQ.isLoading || headcountQ.isLoading,
      isFetching: staffingQ.isFetching || forecastQ.isFetching || ratesQ.isFetching || headcountQ.isFetching,
    };
    if (!unitId || !monthYear || !brand || sectors.length === 0) return empty;

    const dowCounts = daysOfWeekInMonth(monthYear);
    const headcount = headcountQ.data ?? ({} as Record<SectorKey, number>);

    // mínimos por setor: usamos o MAIOR turno (almoço vs jantar) por dia,
    // pois cada turno gera diária separada.
    const staffing = staffingQ.data ?? [];
    const forecast = forecastQ.data ?? [];
    const rates = ratesQ.data ?? [];

    const rateBySector = new Map<string, number>();
    for (const r of rates) rateBySector.set(r.sector_key, Number(r.daily_rate) || DEFAULT_RATE);

    const perSector: SectorBudgetBreakdown[] = sectors.map((sector) => {
      const rate = rateBySector.get(sector) ?? DEFAULT_RATE;
      const efetivoCLT = headcount[sector] ?? 0;

      // Gap por turno × dia da semana × dias no mês
      let gapDiarias = 0;
      const sectorRows = staffing.filter((r) => r.sector_key === sector);
      for (const row of sectorRows) {
        const minimo = Number(row.required_count) || 0;
        const gap = Math.max(0, minimo - efetivoCLT);
        if (gap === 0) continue;
        const dias = dowCounts[row.day_of_week] ?? 0;
        gapDiarias += gap * dias;
      }

      // Pontuais
      let pontuaisDiarias = 0;
      for (const f of forecast) {
        if (f.sector_key === sector) {
          pontuaisDiarias += Number(f.freelancer_count) || 0;
        }
      }

      const totalDiarias = gapDiarias + pontuaisDiarias;
      return {
        sector,
        label: SECTOR_LABELS[sector],
        gapDiarias,
        pontuaisDiarias,
        totalDiarias,
        rate,
        subtotal: totalDiarias * rate,
      };
    });

    const totalGapDiarias = perSector.reduce((s, x) => s + x.gapDiarias, 0);
    const totalPontuaisDiarias = perSector.reduce((s, x) => s + x.pontuaisDiarias, 0);
    const totalDiarias = totalGapDiarias + totalPontuaisDiarias;
    const totalBudget = perSector.reduce((s, x) => s + x.subtotal, 0);

    return {
      perSector,
      totalDiarias,
      totalGapDiarias,
      totalPontuaisDiarias,
      totalBudget: Math.round(totalBudget * 100) / 100,
      isLoading: staffingQ.isLoading || forecastQ.isLoading || ratesQ.isLoading || headcountQ.isLoading,
      isFetching: staffingQ.isFetching || forecastQ.isFetching || ratesQ.isFetching || headcountQ.isFetching,
    };
  }, [
    unitId, monthYear, brand,
    staffingQ.data, staffingQ.isLoading, staffingQ.isFetching,
    forecastQ.data, forecastQ.isLoading, forecastQ.isFetching,
    ratesQ.data, ratesQ.isLoading, ratesQ.isFetching,
    headcountQ.data, headcountQ.isLoading, headcountQ.isFetching,
  ]);

  return result;
}
