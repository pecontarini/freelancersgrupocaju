import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UnitPartnership {
  id: string;
  unit_id: string;
  partner_unit_id: string;
  created_at: string;
  created_by: string | null;
}

/**
 * Returns a Map<unitId, partnerUnitId> with every partnership in the system
 * (bidirectional: A↔B → both directions are present in the map).
 */
export function useAllUnitPartnerships() {
  return useQuery({
    queryKey: ["unit-partnerships-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_partnerships" as any)
        .select("*");
      if (error) throw error;
      const map = new Map<string, { id: string; partnerUnitId: string }>();
      for (const row of (data as any[]) || []) {
        map.set(row.unit_id, { id: row.id, partnerUnitId: row.partner_unit_id });
        map.set(row.partner_unit_id, { id: row.id, partnerUnitId: row.unit_id });
      }
      return map;
    },
    staleTime: 1000 * 60,
  });
}

/**
 * Returns the partner unit id (or null) for a single unit.
 */
export function useUnitPartner(unitId: string | null) {
  return useQuery({
    queryKey: ["unit-partner", unitId],
    queryFn: async () => {
      if (!unitId) return null;
      const { data, error } = await supabase
        .from("unit_partnerships" as any)
        .select("*")
        .or(`unit_id.eq.${unitId},partner_unit_id.eq.${unitId}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as any;
      const partnerId =
        row.unit_id === unitId ? row.partner_unit_id : row.unit_id;
      return { id: row.id as string, partnerUnitId: partnerId as string };
    },
    enabled: !!unitId,
    staleTime: 1000 * 60,
  });
}

const SHARED_SECTOR_KEYWORDS = ["cozinha", "bar", "asg", "serviços gerais", "servicos gerais"];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isSharedSector(name: string): boolean {
  const n = normalize(name);
  return SHARED_SECTOR_KEYWORDS.some((kw) => n.includes(normalize(kw)));
}

export function useLinkUnits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unitId: string;
      partnerUnitId: string;
      autoLinkSharedSectors?: boolean;
    }) => {
      if (params.unitId === params.partnerUnitId) {
        throw new Error("Não é possível vincular uma loja a ela mesma.");
      }

      // Verify neither unit already has a partnership
      const { data: existing } = await supabase
        .from("unit_partnerships" as any)
        .select("id")
        .or(
          `unit_id.eq.${params.unitId},partner_unit_id.eq.${params.unitId},unit_id.eq.${params.partnerUnitId},partner_unit_id.eq.${params.partnerUnitId}`
        )
        .limit(1);
      if (existing && existing.length > 0) {
        throw new Error(
          "Uma das lojas já está vinculada. Desvincule antes de criar uma nova parceria."
        );
      }

      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("unit_partnerships" as any)
        .insert({
          unit_id: params.unitId,
          partner_unit_id: params.partnerUnitId,
          created_by: userData.user?.id ?? null,
        } as any);
      if (error) throw error;

      // Optionally auto-link shared sectors (Cozinha, Bar, ASG)
      if (params.autoLinkSharedSectors) {
        const { data: sectorsA } = await supabase
          .from("sectors")
          .select("id, name")
          .eq("unit_id", params.unitId);
        const { data: sectorsB } = await supabase
          .from("sectors")
          .select("id, name")
          .eq("unit_id", params.partnerUnitId);

        const sharedA = (sectorsA || []).filter((s) => isSharedSector(s.name));
        const sharedB = (sectorsB || []).filter((s) => isSharedSector(s.name));

        let linked = 0;
        for (const a of sharedA) {
          // find a sector in B with same normalized name
          const b = sharedB.find(
            (sb) => normalize(sb.name) === normalize(a.name)
          );
          if (!b) continue;
          // skip if either is already linked
          const { data: alreadyLinked } = await supabase
            .from("sector_partnerships" as any)
            .select("id")
            .or(
              `sector_id.eq.${a.id},partner_sector_id.eq.${a.id},sector_id.eq.${b.id},partner_sector_id.eq.${b.id}`
            )
            .limit(1);
          if (alreadyLinked && alreadyLinked.length > 0) continue;
          const { error: spErr } = await supabase
            .from("sector_partnerships" as any)
            .insert({
              sector_id: a.id,
              partner_sector_id: b.id,
            } as any);
          if (!spErr) linked++;
        }
        return { sharedSectorsLinked: linked };
      }
      return { sharedSectorsLinked: 0 };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["unit-partnerships-all"] });
      qc.invalidateQueries({ queryKey: ["unit-partner"] });
      qc.invalidateQueries({ queryKey: ["sector-partnerships"] });
      qc.invalidateQueries({ queryKey: ["sector-partner"] });
      const extra = res?.sharedSectorsLinked
        ? ` ${res.sharedSectorsLinked} setor(es) compartilhado(s) vinculado(s) automaticamente.`
        : "";
      toast.success(`Lojas vinculadas com sucesso!${extra}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnlinkUnits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      partnershipId: string;
      removeSectorPartnerships?: boolean;
      unitId?: string;
      partnerUnitId?: string;
    }) => {
      // Optionally remove all sector_partnerships between the two units
      if (params.removeSectorPartnerships && params.unitId && params.partnerUnitId) {
        const { data: sectorsA } = await supabase
          .from("sectors")
          .select("id")
          .eq("unit_id", params.unitId);
        const { data: sectorsB } = await supabase
          .from("sectors")
          .select("id")
          .eq("unit_id", params.partnerUnitId);

        const idsA = (sectorsA || []).map((s) => s.id);
        const idsB = (sectorsB || []).map((s) => s.id);

        if (idsA.length > 0 && idsB.length > 0) {
          // Delete partnerships where one side is in A and the other in B
          const { data: sps } = await supabase
            .from("sector_partnerships" as any)
            .select("id, sector_id, partner_sector_id");
          const toDelete = ((sps as any[]) || []).filter((sp) => {
            return (
              (idsA.includes(sp.sector_id) && idsB.includes(sp.partner_sector_id)) ||
              (idsB.includes(sp.sector_id) && idsA.includes(sp.partner_sector_id))
            );
          });
          for (const sp of toDelete) {
            await supabase
              .from("sector_partnerships" as any)
              .delete()
              .eq("id", sp.id);
          }
        }
      }

      const { error } = await supabase
        .from("unit_partnerships" as any)
        .delete()
        .eq("id", params.partnershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unit-partnerships-all"] });
      qc.invalidateQueries({ queryKey: ["unit-partner"] });
      qc.invalidateQueries({ queryKey: ["sector-partnerships"] });
      qc.invalidateQueries({ queryKey: ["sector-partner"] });
      toast.success("Vínculo entre lojas removido.");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
