import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConfigOption {
  id: string;
  nome: string;
  created_at: string;
}

type ConfigTable = "config_lojas" | "config_funcoes" | "config_gerencias";

function useConfigTable(table: ConfigTable) {
  const queryClient = useQueryClient();
  const queryKey = [table];

  const { data: options = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("nome", { ascending: true });
      
      if (error) throw error;
      return data as ConfigOption[];
    },
  });

  const addOption = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from(table)
        .insert({ nome: nome.trim() })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Item adicionado com sucesso!");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("Este item já existe.");
      } else {
        toast.error("Erro ao adicionar item.");
      }
    },
  });

  const updateOption = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { data, error } = await supabase
        .from(table)
        .update({ nome: nome.trim() })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Item atualizado com sucesso!");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("Este nome já existe.");
      } else {
        toast.error("Erro ao atualizar item.");
      }
    },
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Item excluído com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir item.");
    },
  });

  return {
    options,
    isLoading,
    addOption,
    updateOption,
    deleteOption,
  };
}

export function useConfigLojas() {
  return useConfigTable("config_lojas");
}

export function useConfigFuncoes() {
  return useConfigTable("config_funcoes");
}

export function useConfigGerencias() {
  return useConfigTable("config_gerencias");
}
