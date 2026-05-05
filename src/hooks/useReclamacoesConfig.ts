import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ReclamacoesConfig {
  id: string;
  enabled: boolean;
  source_id: string | null;
  classificador_ai: boolean;
  updated_at: string;
}

export function useReclamacoesConfig() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reclamacoes_config"],
    queryFn: async () => {
      const { data: cfg } = await supabase
        .from("reclamacoes_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      let source = null;
      if (cfg?.source_id) {
        const { data: src } = await supabase
          .from("sheets_sources")
          .select("*")
          .eq("id", cfg.source_id)
          .maybeSingle();
        source = src;
      }
      return { config: cfg as ReclamacoesConfig | null, source };
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Pick<ReclamacoesConfig, "enabled" | "source_id" | "classificador_ai">>) => {
      const { data: existing } = await supabase
        .from("reclamacoes_config")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from("reclamacoes_config")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("reclamacoes_config")
          .insert({ ...patch, singleton: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reclamacoes_config"] });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao atualizar configuração."),
  });

  return {
    config: data?.config ?? null,
    source: data?.source ?? null,
    isLoading,
    update,
  };
}
