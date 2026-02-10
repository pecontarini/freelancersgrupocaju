import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface JobTitle {
  id: string;
  name: string;
  unit_id: string;
  created_at: string;
}

export function useJobTitles(unitId: string | null) {
  return useQuery({
    queryKey: ["job_titles", unitId],
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase
        .from("job_titles")
        .select("*")
        .eq("unit_id", unitId)
        .order("name");
      if (error) throw error;
      return data as JobTitle[];
    },
    enabled: !!unitId,
  });
}

export function useUpsertJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; unit_id: string }): Promise<JobTitle> => {
      // Try to find existing first
      const { data: existing } = await supabase
        .from("job_titles")
        .select("*")
        .eq("name", params.name)
        .eq("unit_id", params.unit_id)
        .maybeSingle();

      if (existing) return existing as JobTitle;

      const { data, error } = await supabase
        .from("job_titles")
        .insert(params)
        .select()
        .single();
      if (error) throw error;
      return data as JobTitle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job_titles"] });
    },
    onError: (err: Error) => toast.error("Erro ao criar cargo: " + err.message),
  });
}

export function useDeleteJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("job_titles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job_titles"] });
      toast.success("Cargo removido!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });
}
