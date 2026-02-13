import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AuditSectorCode, AuditChecklistType } from "@/lib/audit/auditTypes";
import type { SectorScoreEntry } from "@/lib/audit/performanceCalculator";

export interface AuditSectorScoreRow {
  id: string;
  audit_id: string;
  loja_id: string;
  sector_code: string;
  checklist_type: string;
  score: number;
  total_points: number;
  earned_points: number;
  item_count: number;
  audit_date: string;
  month_year: string;
  created_at: string;
}

/**
 * Hook for reading audit sector scores from the database
 */
export function useAuditSectorScores(lojaId?: string | null, monthYear?: string) {
  const { data: sectorScores = [], isLoading } = useQuery({
    queryKey: ["audit-sector-scores", lojaId, monthYear],
    queryFn: async () => {
      let query = supabase.from("audit_sector_scores").select("*");

      if (lojaId) {
        query = query.eq("loja_id", lojaId);
      }
      if (monthYear) {
        query = query.eq("month_year", monthYear);
      }

      const { data, error } = await query.order("audit_date", { ascending: false });
      if (error) throw error;
      return data as AuditSectorScoreRow[];
    },
    enabled: true,
  });

  // Convert to SectorScoreEntry format for the calculator
  const sectorScoreEntries: SectorScoreEntry[] = sectorScores.map(s => ({
    id: s.id,
    auditId: s.audit_id,
    lojaId: s.loja_id,
    sectorCode: s.sector_code as AuditSectorCode,
    checklistType: s.checklist_type as AuditChecklistType,
    score: Number(s.score),
    auditDate: s.audit_date,
    monthYear: s.month_year,
  }));

  return {
    sectorScores,
    sectorScoreEntries,
    isLoading,
  };
}

/**
 * Hook for network-wide audit sector scores (all stores)
 */
export function useNetworkAuditSectorScores(monthYear?: string) {
  const { data: sectorScores = [], isLoading } = useQuery({
    queryKey: ["audit-sector-scores-network", monthYear],
    queryFn: async () => {
      let query = supabase.from("audit_sector_scores").select("*");

      if (monthYear) {
        query = query.eq("month_year", monthYear);
      }

      const { data, error } = await query.order("audit_date", { ascending: false });
      if (error) throw error;
      return data as AuditSectorScoreRow[];
    },
    enabled: true,
  });

  const sectorScoreEntries: SectorScoreEntry[] = sectorScores.map(s => ({
    id: s.id,
    auditId: s.audit_id,
    lojaId: s.loja_id,
    sectorCode: s.sector_code as AuditSectorCode,
    checklistType: s.checklist_type as AuditChecklistType,
    score: Number(s.score),
    auditDate: s.audit_date,
    monthYear: s.month_year,
  }));

  return {
    sectorScores,
    sectorScoreEntries,
    isLoading,
  };
}
