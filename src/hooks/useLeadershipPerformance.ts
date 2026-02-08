// ============================================
// useLeadershipPerformance Hook
// React hook for calculating leadership performance based on audit data
// ============================================

import { useMemo } from "react";
import { useSupervisionAudits, DateRangeFilter } from "./useSupervisionAudits";
import {
  calculateLeadershipPerformance,
  createSectorLevelEntries,
  LeadershipPerformanceReport,
  PositionPerformanceResult,
  LeadershipPositionCode,
  POSITION_LABELS,
  getTierForScore,
  AuditScoreEntry,
} from "@/lib/audit";

export interface UseLeadershipPerformanceOptions {
  lojaId?: string | null;
  monthYear?: string;
  dateRange?: DateRangeFilter;
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
}

/**
 * Hook for calculating leadership performance based on audit data
 * 
 * Uses the official weighted average rules:
 * - SUPERVISOR: weight 2
 * - FISCAL: weight 1
 * - AUDITORIA_DE_ALIMENTOS: weight 1
 */
export function useLeadershipPerformance(
  options: UseLeadershipPerformanceOptions
): LeadershipPerformanceData {
  const { lojaId, monthYear, dateRange } = options;

  const {
    audits,
    failures,
    isLoadingAudits,
    isLoadingFailures,
  } = useSupervisionAudits(lojaId, monthYear, dateRange);

  const result = useMemo(() => {
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
      };
    }

    // Convert audits and failures to score entries
    const scoreEntries = createSectorLevelEntries(
      audits.map(a => ({
        id: a.id,
        loja_id: a.loja_id,
        audit_date: a.audit_date,
        global_score: a.global_score,
      })),
      failures.map(f => ({
        audit_id: f.audit_id,
        loja_id: f.loja_id,
        item_name: f.item_name,
        category: f.category,
      }))
    );

    // Determine monthYear from dateRange or use provided value
    let effectiveMonthYear = monthYear;
    if (!effectiveMonthYear && dateRange?.from) {
      const date = dateRange.from;
      effectiveMonthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!effectiveMonthYear) {
      const now = new Date();
      effectiveMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Calculate performance report
    const report = calculateLeadershipPerformance(
      lojaId,
      effectiveMonthYear,
      scoreEntries
    );

    // Organize results
    const frontChiefs: LeadershipPositionCode[] = ['chefe_salao', 'chefe_apv'];
    const backChiefs: LeadershipPositionCode[] = ['chefe_parrilla', 'chefe_bar', 'chefe_cozinha'];
    const managerPositions: LeadershipPositionCode[] = ['gerente_front', 'gerente_back'];

    const frontPositions = report.positions.filter(p => 
      frontChiefs.includes(p.position) || p.position === 'gerente_front'
    );
    
    const backPositions = report.positions.filter(p => 
      backChiefs.includes(p.position) || p.position === 'gerente_back'
    );

    const managers = report.positions.filter(p => 
      managerPositions.includes(p.position)
    );

    const chiefs = report.positions.filter(p => 
      [...frontChiefs, ...backChiefs].includes(p.position)
    );

    const generalTier = report.generalScore !== null 
      ? getTierForScore(report.generalScore) 
      : null;

    return {
      report,
      positionResults: report.positions,
      frontPositions,
      backPositions,
      managers,
      chiefs,
      generalScore: report.generalScore,
      generalTier,
      scoreEntries,
    };
  }, [audits, failures, lojaId, monthYear, dateRange]);

  return {
    ...result,
    isLoading: isLoadingAudits || isLoadingFailures,
  };
}

/**
 * Hook for network-wide leadership performance (all stores)
 */
export function useNetworkLeadershipPerformance(
  monthYear?: string,
  dateRange?: DateRangeFilter
) {
  const {
    audits,
    failures,
    isLoadingAudits,
    isLoadingFailures,
  } = useSupervisionAudits(null, monthYear, dateRange);

  const result = useMemo(() => {
    // Group audits by store
    const storeIds = [...new Set(audits.map(a => a.loja_id))];

    // Convert to score entries
    const allScoreEntries = createSectorLevelEntries(
      audits.map(a => ({
        id: a.id,
        loja_id: a.loja_id,
        audit_date: a.audit_date,
        global_score: a.global_score,
      })),
      failures.map(f => ({
        audit_id: f.audit_id,
        loja_id: f.loja_id,
        item_name: f.item_name,
        category: f.category,
      }))
    );

    // Determine monthYear
    let effectiveMonthYear = monthYear;
    if (!effectiveMonthYear && dateRange?.from) {
      const date = dateRange.from;
      effectiveMonthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!effectiveMonthYear) {
      const now = new Date();
      effectiveMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Calculate reports for each store
    const storeReports = new Map<string, LeadershipPerformanceReport>();
    
    for (const storeId of storeIds) {
      const report = calculateLeadershipPerformance(
        storeId,
        effectiveMonthYear,
        allScoreEntries
      );
      storeReports.set(storeId, report);
    }

    // Calculate network-wide averages per position
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

    const networkPositionScores: Record<LeadershipPositionCode, number | null> = {} as Record<LeadershipPositionCode, number | null>;
    const positions: LeadershipPositionCode[] = [
      'chefe_salao', 'chefe_apv', 'chefe_parrilla', 
      'chefe_bar', 'chefe_cozinha', 'gerente_front', 'gerente_back'
    ];
    
    for (const position of positions) {
      const avg = positionAverages.get(position);
      networkPositionScores[position] = avg && avg.count > 0 
        ? avg.sum / avg.count 
        : null;
    }

    // Network general average
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
      networkGeneralTier: networkGeneralScore !== null 
        ? getTierForScore(networkGeneralScore) 
        : null,
      storeCount: storeIds.length,
      auditCount: audits.length,
    };
  }, [audits, failures, monthYear, dateRange]);

  return {
    ...result,
    isLoading: isLoadingAudits || isLoadingFailures,
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
  return POSITION_LABELS[position];
}
