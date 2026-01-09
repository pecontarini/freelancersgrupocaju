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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await supabase
        .from("freelancer_entries")
        .insert({
          loja: formData.loja,
          nome_completo: formData.nome_completo,
          setor: formData.setor,
          gerencia: formData.gerencia,
          data_pop: formData.data_pop.toISOString().split("T")[0],
          valor: formData.valor,
          cpf: formData.cpf,
          chave_pix: formData.chave_pix,
          created_by: user.id,
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
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer-entries"] });
      toast.success("Lançamento excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting entry:", error);
      toast.error("Erro ao excluir lançamento.");
    },
  });

  // Get unique values for filters
  const uniqueSetores = [...new Set(entries.map((e) => e.setor))].sort();
  const uniqueGerencias = [...new Set(entries.map((e) => e.gerencia))].sort();
  const uniqueLojas = [...new Set(entries.map((e) => e.loja))].sort();

  return {
    entries,
    isLoading,
    error,
    createEntry,
    deleteEntry,
    uniqueSetores,
    uniqueGerencias,
    uniqueLojas,
  };
}
