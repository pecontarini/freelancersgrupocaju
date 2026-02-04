import { useMemo } from "react";
import { useSupervisionAudits, SupervisionAudit, SupervisionFailure } from "./useSupervisionAudits";
import { 
  SECTOR_POSITION_MAP, 
  categorizeItemToSector, 
  AreaType,
  LeadershipPosition,
  POSITION_LABELS,
} from "@/lib/sectorPositionMapping";

export interface SegmentedScores {
  general: number | null;
  front: number | null;
  back: number | null;
  frontItems: { total: number; passed: number; failed: number };
  backItems: { total: number; passed: number; failed: number };
  sectorBreakdown: Record<string, { score: number; failedCount: number; totalCount: number }>;
}

export interface AuditScoreData {
  latestAudit: SupervisionAudit | null;
  scores: SegmentedScores;
  frontResponsible: { position: LeadershipPosition; label: string } | null;
  backResponsible: { position: LeadershipPosition; label: string } | null;
  isLoading: boolean;
}

/**
 * Calculate segmented audit scores (General, Front, Back) from supervision audit data
 * 
 * @param lojaId - The store ID to calculate scores for
 * @param monthYear - Optional month/year filter (YYYY-MM format)
 */
export function useAuditScores(lojaId?: string | null, monthYear?: string): AuditScoreData {
  const { audits, failures, isLoadingAudits, isLoadingFailures } = useSupervisionAudits(lojaId, monthYear);

  const result = useMemo(() => {
    // Get the latest audit for this store
    const latestAudit = audits.length > 0 ? audits[0] : null;

    if (!latestAudit) {
      return {
        latestAudit: null,
        scores: {
          general: null,
          front: null,
          back: null,
          frontItems: { total: 0, passed: 0, failed: 0 },
          backItems: { total: 0, passed: 0, failed: 0 },
          sectorBreakdown: {},
        },
        frontResponsible: { position: 'gerente_front' as LeadershipPosition, label: POSITION_LABELS['gerente_front'] },
        backResponsible: { position: 'gerente_back' as LeadershipPosition, label: POSITION_LABELS['gerente_back'] },
      };
    }

    // Get failures for the latest audit
    const auditFailures = failures.filter((f) => f.audit_id === latestAudit.id);

    // Categorize each failure by sector and area type
    const categorizedFailures = auditFailures.map((failure) => {
      const sector = categorizeItemToSector(failure.item_name, failure.category);
      const sectorConfig = SECTOR_POSITION_MAP[sector];
      return {
        ...failure,
        sector,
        areaType: sectorConfig.areaType,
      };
    });

    // Count failures by area type
    const frontFailures = categorizedFailures.filter((f) => f.areaType === 'front');
    const backFailures = categorizedFailures.filter((f) => f.areaType === 'back');

    // Build sector breakdown
    const sectorBreakdown: Record<string, { score: number; failedCount: number; totalCount: number }> = {};
    
    Object.entries(SECTOR_POSITION_MAP).forEach(([sectorKey, config]) => {
      const sectorFailures = categorizedFailures.filter((f) => f.sector === sectorKey);
      const failedCount = sectorFailures.length;
      
      // We only have failure data, not total items checked per sector
      // So we estimate based on the number of failures relative to the global score
      sectorBreakdown[sectorKey] = {
        score: failedCount > 0 ? Math.max(0, 100 - (failedCount * 10)) : 100, // Rough estimate
        failedCount,
        totalCount: failedCount, // Only have failure data
      };
    });

    // Calculate segmented scores
    // The general score comes directly from the audit
    const generalScore = latestAudit.global_score;

    // For Front and Back scores, we derive them from the failure distribution
    // Since we only have failure data, we estimate scores based on failure counts
    const totalFailures = auditFailures.length;
    
    // If there are no failures, both areas are at 100%
    // Otherwise, calculate proportional scores based on failure distribution
    let frontScore: number | null = null;
    let backScore: number | null = null;

    if (totalFailures === 0) {
      frontScore = 100;
      backScore = 100;
    } else {
      // Estimate scores based on the global score and failure distribution
      // The area with more failures gets a proportionally lower score
      const frontFailureRatio = frontFailures.length / Math.max(1, totalFailures);
      const backFailureRatio = backFailures.length / Math.max(1, totalFailures);
      
      // Distribute the "penalty" from the global score based on failure ratio
      const globalPenalty = 100 - generalScore;
      
      // Calculate area-specific penalties
      // Areas with no failures get 100%, others get penalties proportional to their share
      if (frontFailures.length === 0) {
        frontScore = 100;
      } else {
        const frontPenalty = globalPenalty * (frontFailureRatio * 2); // Weight failures more heavily
        frontScore = Math.max(0, Math.min(100, 100 - frontPenalty));
      }
      
      if (backFailures.length === 0) {
        backScore = 100;
      } else {
        const backPenalty = globalPenalty * (backFailureRatio * 2);
        backScore = Math.max(0, Math.min(100, 100 - backPenalty));
      }
    }

    return {
      latestAudit,
      scores: {
        general: generalScore,
        front: frontScore,
        back: backScore,
        frontItems: {
          total: frontFailures.length,
          passed: 0, // We don't have passed items data
          failed: frontFailures.length,
        },
        backItems: {
          total: backFailures.length,
          passed: 0,
          failed: backFailures.length,
        },
        sectorBreakdown,
      },
      frontResponsible: { position: 'gerente_front' as LeadershipPosition, label: POSITION_LABELS['gerente_front'] },
      backResponsible: { position: 'gerente_back' as LeadershipPosition, label: POSITION_LABELS['gerente_back'] },
    };
  }, [audits, failures]);

  return {
    ...result,
    isLoading: isLoadingAudits || isLoadingFailures,
  };
}

/**
 * Get all audit scores for multiple stores (network view)
 */
export function useNetworkAuditScores(monthYear?: string) {
  const { audits, failures, isLoadingAudits, isLoadingFailures } = useSupervisionAudits(null, monthYear);

  const storeScores = useMemo(() => {
    // Group audits by store and get the latest for each
    const storeLatestAudits = new Map<string, SupervisionAudit>();
    
    audits.forEach((audit) => {
      const existing = storeLatestAudits.get(audit.loja_id);
      if (!existing || new Date(audit.audit_date) > new Date(existing.audit_date)) {
        storeLatestAudits.set(audit.loja_id, audit);
      }
    });

    // Calculate scores for each store
    const scores: Map<string, SegmentedScores> = new Map();

    storeLatestAudits.forEach((audit, storeId) => {
      const auditFailures = failures.filter((f) => f.audit_id === audit.id);
      
      const categorizedFailures = auditFailures.map((failure) => {
        const sector = categorizeItemToSector(failure.item_name, failure.category);
        const sectorConfig = SECTOR_POSITION_MAP[sector];
        return {
          ...failure,
          sector,
          areaType: sectorConfig.areaType,
        };
      });

      const frontFailures = categorizedFailures.filter((f) => f.areaType === 'front');
      const backFailures = categorizedFailures.filter((f) => f.areaType === 'back');
      const totalFailures = auditFailures.length;

      let frontScore = 100;
      let backScore = 100;

      if (totalFailures > 0) {
        const globalPenalty = 100 - audit.global_score;
        const frontFailureRatio = frontFailures.length / Math.max(1, totalFailures);
        const backFailureRatio = backFailures.length / Math.max(1, totalFailures);

        if (frontFailures.length > 0) {
          frontScore = Math.max(0, Math.min(100, 100 - globalPenalty * (frontFailureRatio * 2)));
        }
        if (backFailures.length > 0) {
          backScore = Math.max(0, Math.min(100, 100 - globalPenalty * (backFailureRatio * 2)));
        }
      }

      scores.set(storeId, {
        general: audit.global_score,
        front: frontScore,
        back: backScore,
        frontItems: { total: frontFailures.length, passed: 0, failed: frontFailures.length },
        backItems: { total: backFailures.length, passed: 0, failed: backFailures.length },
        sectorBreakdown: {},
      });
    });

    return scores;
  }, [audits, failures]);

  return {
    storeScores,
    isLoading: isLoadingAudits || isLoadingFailures,
  };
}
