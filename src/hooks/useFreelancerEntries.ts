import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FreelancerEntry, FreelancerFormData } from "@/types/freelancer";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetchAllRows";

export function useFreelancerEntries() {
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ["freelancer-entries"],
    queryFn: async () => {
      return fetchAllRows<FreelancerEntry>(
        () => supabase
          .from("freelancer_entries")
          .select("*")
          .order("data_pop", { ascending: false })
      );
    },
  });

  const createEntry = useMutation({
    mutationFn: async (formData: FreelancerFormData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Padrão canônico: CPF sempre limpo (11 dígitos) em todas as tabelas
      const cleanCpf = formData.cpf.replace(/\D/g, "");
      const cpfToStore = cleanCpf.length === 11 ? cleanCpf : formData.cpf;

      const { data, error } = await supabase
        .from("freelancer_entries")
        .insert({
          loja: formData.loja,
          nome_completo: formData.nome_completo,
          funcao: formData.funcao,
          gerencia: formData.gerencia,
          data_pop: formData.data_pop, // Já é string YYYY-MM-DD
          valor: formData.valor,
          cpf: cpfToStore,
          chave_pix: formData.chave_pix,
          created_by: user.id,
          loja_id: formData.loja_id,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Espelha no cadastro global de freelancers para lookup cross-loja por CPF
      if (cleanCpf.length === 11) {
        const { error: profileError } = await supabase
          .from("freelancer_profiles")
          .upsert(
            {
              cpf: cleanCpf,
              nome_completo: formData.nome_completo,
              chave_pix: formData.chave_pix,
            },
            { onConflict: "cpf", ignoreDuplicates: false }
          );
        if (profileError) {
          console.warn("Falha ao espelhar perfil global de freelancer:", profileError);
        }
      }

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

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FreelancerFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from("freelancer_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-entries"] });
      toast.success("Lançamento atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating entry:", error);
      toast.error("Erro ao atualizar lançamento.");
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("freelancer_entries")
        .delete()
        .eq("id", id);
      
      if (error) {
        if (error.code === "42501" || error.message.includes("policy")) {
          throw new Error("Você não tem permissão para excluir este lançamento.");
        }
        throw error;
      }
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["freelancer-entries"] });
      const previousEntries = queryClient.getQueryData<FreelancerEntry[]>(["freelancer-entries"]);
      queryClient.setQueryData<FreelancerEntry[]>(
        ["freelancer-entries"],
        (old) => old?.filter((entry) => entry.id !== id) ?? []
      );
      return { previousEntries };
    },
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso!");
    },
    onError: (error, id, context) => {
      if (context?.previousEntries) {
        queryClient.setQueryData(["freelancer-entries"], context.previousEntries);
      }
      console.error("Error deleting entry:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao excluir lançamento.");
    },
    onSettled: () => {
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
    updateEntry,
    deleteEntry,
    uniqueFuncoes,
    uniqueGerencias,
    uniqueLojas,
  };
}
