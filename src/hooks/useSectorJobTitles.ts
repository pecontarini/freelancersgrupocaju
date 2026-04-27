import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SectorJobTitle {
  id: string;
  sector_id: string;
  job_title_id: string;
  created_at: string;
}

export function useSectorJobTitles(sectorIds: string[]) {
  return useQuery({
    queryKey: ["sector_job_titles", sectorIds],
    queryFn: async () => {
      if (!sectorIds.length) return [];
      const { data, error } = await supabase
        .from("sector_job_titles")
        .select("*")
        .in("sector_id", sectorIds);
      if (error) throw error;
      return data as SectorJobTitle[];
    },
    enabled: sectorIds.length > 0,
  });
}

/**
 * Vincula UM cargo a UM setor sem apagar os existentes.
 * Idempotente: se já existir, ignora silenciosamente.
 */
export function useAddSectorJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sectorId,
      jobTitleId,
    }: {
      sectorId: string;
      jobTitleId: string;
    }) => {
      // Verifica duplicata antes de inserir
      const { data: existing } = await supabase
        .from("sector_job_titles")
        .select("id")
        .eq("sector_id", sectorId)
        .eq("job_title_id", jobTitleId)
        .maybeSingle();

      if (existing) return;

      const { error } = await supabase
        .from("sector_job_titles")
        .insert({ sector_id: sectorId, job_title_id: jobTitleId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sector_job_titles"] });
    },
    onError: (err: Error) => toast.error("Erro ao vincular cargo: " + err.message),
  });
}

export function useSetSectorJobTitles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sectorId,
      jobTitleIds,
    }: {
      sectorId: string;
      jobTitleIds: string[];
    }) => {
      // Delete existing associations for this sector
      const { error: delError } = await supabase
        .from("sector_job_titles")
        .delete()
        .eq("sector_id", sectorId);
      if (delError) throw delError;

      // Insert new ones
      if (jobTitleIds.length > 0) {
        const rows = jobTitleIds.map((job_title_id) => ({
          sector_id: sectorId,
          job_title_id,
        }));
        const { error: insError } = await supabase
          .from("sector_job_titles")
          .insert(rows);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sector_job_titles"] });
      toast.success("Cargos do setor atualizados!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
