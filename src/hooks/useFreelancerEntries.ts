import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FreelancerEntry, FreelancerFormData } from "@/types/freelancer";
import { toast } from "sonner";

export function useFreelancerEntries() {
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ["freelancer-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancer_entries")
        .select("*")
        .order("data_pop", { ascending: false });
      
      if (error) throw error;
      return data as FreelancerEntry[];
    },
  });

  const createEntry = useMutation({
    mutationFn: async (formData: FreelancerFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await supabase
        .from("freelancer_entries")
        .insert({
          loja: formData.loja,
          nome_completo: formData.nome_completo,
          funcao: formData.funcao,
          gerencia: formData.gerencia,
          data_pop: formData.data_pop, // Já é string YYYY-MM-DD
          valor: formData.valor,
          cpf: formData.cpf,
          chave_pix: formData.chave_pix,
          created_by: user.id,
          loja_id: formData.loja_id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-entries"] });
      toast.success("Lançamento salvo com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating entry:", error);
      toast.error("Erro ao salvar lançamento. Tente novamente.");
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("freelancer_entries")
        .delete()
        .eq("id", id);
      
      if (error) {
        // Check for RLS policy violation
        if (error.code === "42501" || error.message.includes("policy")) {
          throw new Error("Você não tem permissão para excluir este lançamento.");
        }
        throw error;
      }
    },
    // Optimistic update - remove item from UI immediately
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["freelancer-entries"] });

      // Snapshot the previous value
      const previousEntries = queryClient.getQueryData<FreelancerEntry[]>(["freelancer-entries"]);

      // Optimistically update to the new value
      queryClient.setQueryData<FreelancerEntry[]>(
        ["freelancer-entries"],
        (old) => old?.filter((entry) => entry.id !== id) ?? []
      );

      // Return a context object with the snapshotted value
      return { previousEntries };
    },
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso!");
    },
    onError: (error, id, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousEntries) {
        queryClient.setQueryData(["freelancer-entries"], context.previousEntries);
      }
      console.error("Error deleting entry:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir lançamento.");
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache is in sync
      queryClient.invalidateQueries({ queryKey: ["freelancer-entries"] });
    },
  });

  // Get unique values for filters
  const uniqueFuncoes = [...new Set(entries.map((e) => e.funcao))].sort();
  const uniqueGerencias = [...new Set(entries.map((e) => e.gerencia))].sort();
  const uniqueLojas = [...new Set(entries.map((e) => e.loja))].sort();

  return {
    entries,
    isLoading,
    error,
    createEntry,
    deleteEntry,
    uniqueFuncoes,
    uniqueGerencias,
    uniqueLojas,
  };
}
