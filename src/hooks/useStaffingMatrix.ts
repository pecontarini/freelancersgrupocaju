import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export type Sector = Tables<"sectors">;
export type Shift = Tables<"shifts">;
export type StaffingMatrix = Tables<"staffing_matrix">;

export function useSectors(unitId: string | null) {
  return useQuery({
    queryKey: ["sectors", unitId],
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .eq("unit_id", unitId)
        .order("name");
      if (error) throw error;
      return data as Sector[];
    },
    enabled: !!unitId,
  });
}

export function useShifts() {
  return useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .order("start_time");
      if (error) throw error;
      return data as Shift[];
    },
  });
}

export function useStaffingMatrix(sectorIds: string[]) {
  return useQuery({
    queryKey: ["staffing_matrix", sectorIds],
    queryFn: async () => {
      if (sectorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("staffing_matrix")
        .select("*")
        .in("sector_id", sectorIds);
      if (error) throw error;
      return data as StaffingMatrix[];
    },
    enabled: sectorIds.length > 0,
  });
}

export function useUpsertStaffingMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: {
      sector_id: string;
      day_of_week: number;
      shift_type: string;
      required_count: number;
      extras_count?: number;
    }) => {
      const payload: any = {
        sector_id: row.sector_id,
        day_of_week: row.day_of_week,
        shift_type: row.shift_type,
        required_count: row.required_count,
        updated_at: new Date().toISOString(),
      };
      if (row.extras_count !== undefined) {
        payload.extras_count = row.extras_count;
      }
      const { error } = await supabase.from("staffing_matrix").upsert(
        payload,
        { onConflict: "sector_id,day_of_week,shift_type" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffing_matrix"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar matriz: " + err.message);
    },
  });
}

export function useAddSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { unit_id: string; name: string }) => {
      const { error } = await supabase.from("sectors").insert({
        unit_id: params.unit_id,
        name: params.name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sectors"] });
      toast.success("Setor adicionado!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao adicionar setor: " + err.message);
    },
  });
}

export function useClearStaffingMatrix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sectorIds: string[]) => {
      if (sectorIds.length === 0) return;
      const { error } = await supabase
        .from("staffing_matrix")
        .delete()
        .in("sector_id", sectorIds);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffing_matrix"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao limpar matriz: " + err.message);
    },
  });
}

export function useDeleteSector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sectors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sectors"] });
      qc.invalidateQueries({ queryKey: ["staffing_matrix"] });
      toast.success("Setor removido!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao remover setor: " + err.message);
    },
  });
}
