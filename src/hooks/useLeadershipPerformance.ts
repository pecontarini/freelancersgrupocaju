// ============================================
// useLeadershipPerformance Hook v2
// Uses audit_sector_scores for "Média de Médias por Setor" calculation
// ============================================

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupervisionAudits, DateRangeFilter } from "./useSupervisionAudits";
import { useAuditSectorScores, useNetworkAuditSectorScores } from "./useAuditSectorScores";
import {
  calculateLeadershipPerformanceFromSectors,
  calculateLeadershipPerformance,
  createSectorLevelEntries,
  SectorScoreEntry,
} from "@/lib/audit/performanceCalculator";
import {
  LeadershipPerformanceReport,
  PositionPerformanceResult,
  LeadershipPositionCode,
  POSITION_LABELS,
  getTierForScore,
  AuditScoreEntry,
} from "@/lib/audit/auditTypes";
import { useToast } from "./use-toast";

export interface UseLeadershipPerformanceOptions {
  lojaId?: string | null;
  monthYear?: string;
  dateRange?: DateRangeFilter;
  usePersistedScores?: boolean;
}

export interface PersistedPositionScore {
  id: string;
  loja_id: string;
  month_year: string;
  position_code: string;
  final_score: number | null;
  tier: string | null;
  breakdown: unknown;
  total_audits: number;
  needs_review: boolean;
  review_reasons: unknown;
  calculated_at: string;
}

export interface PersistedStoreScore {
  id: string;
  loja_id: string;
  month_year: string;
  general_score: number | null;
  front_score: number | null;
  back_score: number | null;
  general_tier: string | null;
  front_tier: string | null;
  back_tier: string | null;
  total_audits: number;
  total_failures: number;
  front_failures: number;
  back_failures: number;
  calculated_at: string;
}

export interface LeadershipPerformanceData {
  report: LeadershipPerformanceReport | null;
  positionResults: PositionPerformanceResult[];
  frontPositions: PositionPerformanceResult[];
  backPositions: PositionPerformanceResult[];
  managers: PositionPerformanceResult[];
  chiefs: PositionPerformanceResult[];
  generalScore: number | null;
  generalTier: ReturnType<typeof getTierForScore> | null;
  isLoading: boolean;
  scoreEntries: AuditScoreEntry[];
  persistedPositionScores: PersistedPositionScore[];
  persistedStoreScore: PersistedStoreScore | null;
}

/**
 * Hook for reading persisted leadership performance scores from database
 */
export function usePersistedLeadershipScores(lojaId?: string | null, monthYear?: string) {
  const { data: positionScores = [], isLoading: isLoadingPositions } = useQuery({
    queryKey: ["leadership-performance-scores", lojaId, monthYear],
    queryFn: async () => {
      let query = supabase.from("leadership_performance_scores").select("*");
      if (lojaId) query = query.eq("loja_id", lojaId);
      if (monthYear) query = query.eq("month_year", monthYear);
      const { data, error } = await query.order("position_code");
      if (error) throw error;
      return data as PersistedPositionScore[];
    },
    enabled: !!lojaId,
  });

  const { data: storeScore, isLoading: isLoadingStore } = useQuery({
    queryKey: ["leadership-store-scores", lojaId, monthYear],
    queryFn: async () => {
      let query = supabase.from("leadership_store_scores").select("*");
      if (lojaId) query = query.eq("loja_id", lojaId);
      if (monthYear) query = query.eq("month_year", monthYear);
      const { data, error } = await query.single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as PersistedStoreScore | null;
    },
    enabled: !!lojaId && !!monthYear,
  });

  return { positionScores, storeScore, isLoading: isLoadingPositions || isLoadingStore };
}

const FRONT_CHIEFS: LeadershipPositionCode[] = ['chefe_salao', 'chefe_apv'];
const BACK_CHIEFS: LeadershipPositionCode[] = ['chefe_parrilla', 'chefe_bar', 'chefe_cozinha'];
const MANAGER_POSITIONS: LeadershipPositionCode[] = ['gerente_front', 'gerente_back'];

function organizeResults(positionResults: PositionPerformanceResult[]) {
  return {
    frontPositions: positionResults.filter(p =>
      FRONT_CHIEFS.includes(p.position) || p.position === 'gerente_front'
    ),
    backPositions: positionResults.filter(p =>
      BACK_CHIEFS.includes(p.position) || p.position === 'gerente_back'
    ),
    managers: positionResults.filter(p => MANAGER_POSITIONS.includes(p.position)),
    chiefs: positionResults.filter(p => [...FRONT_CHIEFS, ...BACK_CHIEFS].includes(p.position)),
  };
}

/**
 * Hook for calculating leadership performance
 * Uses "Média de Médias por Setor" algorithm via audit_sector_scores
 */
export function useLeadershipPerformance(
  options: UseLeadershipPerformanceOptions
): LeadershipPerformanceData {
  const { lojaId, monthYear, dateRange, usePersistedScores = false } = options;

  // Read persisted scores if requested
  const { positionScores, storeScore, isLoading: isLoadingPersisted } = usePersistedLeadershipScores(
    usePersistedScores ? lojaId : null,
    usePersistedScores ? monthYear : undefined
  );

  // Read sector scores for on-demand calculation
  const { sectorScoreEntries, isLoading: isLoadingSectorScores } = useAuditSectorScores(
    !usePersistedScores ? lojaId : null,
    !usePersistedScores ? monthYear : undefined
  );

  // Fallback: still load audits for legacy compatibility
  const {
    audits, failures, isLoadingAudits, isLoadingFailures,
  } = useSupervisionAudits(lojaId, monthYear, dateRange);

  const result = useMemo(() => {
    // Path 1: Use persisted scores from database
    if (usePersistedScores && positionScores.length > 0) {
      const convertedResults: PositionPerformanceResult[] = positionScores.map(ps => {
        const breakdownData = Array.isArray(ps.breakdown)
          ? ps.breakdown as Array<{ checklistType: string; label: string; averageScore: number; weight: number; auditCount: number }>
          : [];
        const reviewReasonsData = Array.isArray(ps.review_reasons)
          ? ps.review_reasons as string[]
          : [];

        return {
          position: ps.position_code as LeadershipPositionCode,
          label: POSITION_LABELS[ps.position_code as LeadershipPositionCode] || ps.position_code,
          finalScore: ps.final_score,
          tier: ps.tier ? getTierForScore(ps.final_score || 0) : null,
          breakdown: breakdownData.map(b => ({
            checklistType: b.checklistType as any,
            label: b.label,
            averageScore: b.averageScore,
            weight: b.weight,
            auditCount: b.auditCount,
          })),
          totalAudits: ps.total_audits,
          needsReview: ps.needs_review,
          reviewReasons: reviewReasonsData,
        };
      });

      const organized = organizeResults(convertedResults);

      return {
        report: null,
        positionResults: convertedResults,
        ...organized,
        generalScore: storeScore?.general_score ?? null,
        generalTier: storeScore?.general_score != null
          ? getTierForScore(storeScore.general_score)
          : null,
        scoreEntries: [],
        persistedPositionScores: positionScores,
        persistedStoreScore: storeScore,
      };
    }

    if (!lojaId) {
      return {
        report: null,
        positionResults: [],
        frontPositions: [],
        backPositions: [],
        managers: [],
        chiefs: [],
        generalScore: null,
        generalTier: null,
        scoreEntries: [],
        persistedPositionScores: [],
        persistedStoreScore: null,
      };
    }

    // Determine effective month
    let effectiveMonthYear = monthYear;
    if (!effectiveMonthYear && dateRange?.from) {
      const date = dateRange.from;
      effectiveMonthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!effectiveMonthYear) {
      const now = new Date();
      effectiveMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Path 2: Use sector scores (new "Média de Médias" algorithm)
    if (sectorScoreEntries.length > 0) {
      const report = calculateLeadershipPerformanceFromSectors(
        lojaId, effectiveMonthYear, sectorScoreEntries
      );

      const organized = organizeResults(report.positions);
      const generalTier = report.generalScore !== null
        ? getTierForScore(report.generalScore)
        : null;

      return {
        report,
        positionResults: report.positions,
        ...organized,
        generalScore: report.generalScore,
        generalTier,
        scoreEntries: [],
        persistedPositionScores: positionScores,
        persistedStoreScore: storeScore,
      };
    }

    // Path 3: Legacy fallback using audits + failures
    const scoreEntries = createSectorLevelEntries(
      audits.map(a => ({
        id: a.id, loja_id: a.loja_id, audit_date: a.audit_date, global_score: a.global_score,
      })),
      failures.map(f => ({
        audit_id: f.audit_id, loja_id: f.loja_id, item_name: f.item_name, category: f.category,
      }))
    );

    const report = calculateLeadershipPerformance(lojaId, effectiveMonthYear, scoreEntries);
    const organized = organizeResults(report.positions);
    const generalTier = report.generalScore !== null
      ? getTierForScore(report.generalScore)
      : null;

    return {
      report,
      positionResults: report.positions,
      ...organized,
      generalScore: report.generalScore,
      generalTier,
      scoreEntries,
      persistedPositionScores: positionScores,
      persistedStoreScore: storeScore,
    };
  }, [audits, failures, lojaId, monthYear, dateRange, usePersistedScores, positionScores, storeScore, sectorScoreEntries]);

  return {
    ...result,
    isLoading: isLoadingAudits || isLoadingFailures || (usePersistedScores && isLoadingPersisted) || isLoadingSectorScores,
  };
}

/**
 * Hook for network-wide leadership performance (all stores)
 */
export function useNetworkLeadershipPerformance(
  monthYear?: string,
  dateRange?: DateRangeFilter
) {
  const { sectorScoreEntries, isLoading: isLoadingSectorScores } = useNetworkAuditSectorScores(monthYear);

  const {
    audits, failures, isLoadingAudits, isLoadingFailures,
  } = useSupervisionAudits(null, monthYear, dateRange);

  const result = useMemo(() => {
    let effectiveMonthYear = monthYear;
    if (!effectiveMonthYear && dateRange?.from) {
      const date = dateRange.from;
      effectiveMonthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!effectiveMonthYear) {
      const now = new Date();
      effectiveMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Use sector scores if available
    const entries = sectorScoreEntries.length > 0
      ? sectorScoreEntries
      : createSectorLevelEntries(
          audits.map(a => ({ id: a.id, loja_id: a.loja_id, audit_date: a.audit_date, global_score: a.global_score })),
          failures.map(f => ({ audit_id: f.audit_id, loja_id: f.loja_id, item_name: f.item_name, category: f.category }))
        ).map(e => ({
          id: e.id, auditId: e.auditId, lojaId: e.lojaId,
          sectorCode: e.sector, checklistType: e.checklistType,
          score: e.score, auditDate: e.auditDate, monthYear: e.monthYear,
        } as SectorScoreEntry));

    const storeIds = [...new Set(entries.map(e => e.lojaId))];
    const storeReports = new Map<string, LeadershipPerformanceReport>();

    for (const storeId of storeIds) {
      const report = calculateLeadershipPerformanceFromSectors(storeId, effectiveMonthYear, entries);
      storeReports.set(storeId, report);
    }

    // Network-wide averages per position
    const positionAverages = new Map<LeadershipPositionCode, { sum: number; count: number }>();
    for (const report of storeReports.values()) {
      for (const position of report.positions) {
        if (position.finalScore !== null) {
          const current = positionAverages.get(position.position) || { sum: 0, count: 0 };
          current.sum += position.finalScore;
          current.count += 1;
          positionAverages.set(position.position, current);
        }
      }
    }

    const positions: LeadershipPositionCode[] = [
      'chefe_salao', 'chefe_apv', 'chefe_parrilla',
      'chefe_bar', 'chefe_cozinha', 'gerente_front', 'gerente_back'
    ];
    const networkPositionScores: Record<LeadershipPositionCode, number | null> = {} as any;
    for (const position of positions) {
      const avg = positionAverages.get(position);
      networkPositionScores[position] = avg && avg.count > 0 ? avg.sum / avg.count : null;
    }

    let networkGeneralScore: number | null = null;
    if (storeReports.size > 0) {
      const validScores = [...storeReports.values()]
        .filter(r => r.generalScore !== null)
        .map(r => r.generalScore as number);
      if (validScores.length > 0) {
        networkGeneralScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      }
    }

    return {
      storeReports,
      networkPositionScores,
      networkGeneralScore,
      networkGeneralTier: networkGeneralScore !== null ? getTierForScore(networkGeneralScore) : null,
      storeCount: storeIds.length,
      auditCount: audits.length,
    };
  }, [audits, failures, monthYear, dateRange, sectorScoreEntries]);

  return {
    ...result,
    isLoading: isLoadingAudits || isLoadingFailures || isLoadingSectorScores,
  };
}

/**
 * Hook for triggering performance calculation (backfill or incremental)
 */
export function useCalculateLeadershipPerformance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const calculateMutation = useMutation({
    mutationFn: async (params: {
      action?: 'calculate' | 'backfill';
      loja_id?: string;
      month_year?: string;
      trigger_type?: string;
      trigger_audit_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('calculate-leadership-performance', {
        body: params,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leadership-performance-scores"] });
      queryClient.invalidateQueries({ queryKey: ["leadership-store-scores"] });
      queryClient.invalidateQueries({ queryKey: ["audit-sector-scores"] });
      queryClient.invalidateQueries({ queryKey: ["audit-sector-scores-network"] });

      toast({
        title: "Cálculo concluído",
        description: `${data.positionsUpdated} scores atualizados em ${data.storesProcessed} lojas (algoritmo: ${data.algorithm})`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro no cálculo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    calculate: calculateMutation.mutateAsync,
    isCalculating: calculateMutation.isPending,
  };
}

/**
 * Get position performance for a specific position code
 */
export function getPositionPerformance(
  report: LeadershipPerformanceReport | null,
  position: LeadershipPositionCode
): PositionPerformanceResult | null {
  if (!report) return null;
  return report.positions.find(p => p.position === position) || null;
}

/**
 * Format position label
 */
export function formatPositionLabel(position: LeadershipPositionCode): string {
  return POSITION_LABELS[position] || position;
}
