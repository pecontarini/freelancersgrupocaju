import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SectorPartnership {
  id: string;
  sector_id: string;
  partner_sector_id: string;
  created_at: string;
  created_by: string | null;
}

/**
 * Returns a map sectorId → partnerSectorId for the given sectorIds.
 * Lookups are bidirectional (A↔B linked means querying either returns the other).
 */
export function useSectorPartnerships(sectorIds: string[]) {
  return useQuery({
    queryKey: ["sector-partnerships", [...sectorIds].sort()],
    queryFn: async () => {
      if (sectorIds.length === 0) return new Map<string, string>();
      const { data, error } = await supabase
        .from("sector_partnerships" as any)
        .select("*")
        .or(
          `sector_id.in.(${sectorIds.join(",")}),partner_sector_id.in.(${sectorIds.join(",")})`
        );
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data as any[]) || []) {
        map.set(row.sector_id, row.partner_sector_id);
        map.set(row.partner_sector_id, row.sector_id);
      }
      return map;
    },
    enabled: sectorIds.length > 0,
    staleTime: 1000 * 60,
  });
}

/**
 * Fetches a single partnership for a specific sector (returns partner sector_id or null).
 */
export function useSectorPartner(sectorId: string | null) {
  return useQuery({
    queryKey: ["sector-partner", sectorId],
    queryFn: async () => {
      if (!sectorId) return null;
      const { data, error } = await supabase
        .from("sector_partnerships" as any)
        .select("*")
        .or(`sector_id.eq.${sectorId},partner_sector_id.eq.${sectorId}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as any;
      const partnerId = row.sector_id === sectorId ? row.partner_sector_id : row.sector_id;
      return { id: row.id, partnerSectorId: partnerId as string };
    },
    enabled: !!sectorId,
  });
}

export function useLinkSectors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { sectorId: string; partnerSectorId: string }) => {
      if (params.sectorId === params.partnerSectorId) {
        throw new Error("Não é possível vincular um setor a ele mesmo.");
      }
      // Check if either sector already has a partnership
      const { data: existing } = await supabase
        .from("sector_partnerships" as any)
        .select("id")
        .or(
          `sector_id.eq.${params.sectorId},partner_sector_id.eq.${params.sectorId},sector_id.eq.${params.partnerSectorId},partner_sector_id.eq.${params.partnerSectorId}`
        )
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error("Um dos setores já está vinculado. Desvincule antes de criar nova parceria.");
      }
      const { error } = await supabase
        .from("sector_partnerships" as any)
        .insert({
          sector_id: params.sectorId,
          partner_sector_id: params.partnerSectorId,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sector-partnerships"] });
      qc.invalidateQueries({ queryKey: ["sector-partner"] });
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Setores vinculados! Agora compartilham equipe e escalas.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnlinkSectors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partnershipId: string) => {
      const { error } = await supabase
        .from("sector_partnerships" as any)
        .delete()
        .eq("id", partnershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sector-partnerships"] });
      qc.invalidateQueries({ queryKey: ["sector-partner"] });
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Vínculo removido. As escalas existentes permanecem.");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
