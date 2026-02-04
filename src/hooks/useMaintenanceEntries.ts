import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MaintenanceEntry, MaintenanceFormData, MaintenanceBudget } from "@/types/maintenance";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useMaintenanceEntries() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ["maintenance-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_entries")
        .select("*")
        .order("data_servico", { ascending: false });

      if (error) {
        console.error("Error fetching maintenance entries:", error);
        throw error;
      }

      return data as MaintenanceEntry[];
    },
    enabled: !!user,
  });

  const { data: budgets = [], isLoading: isLoadingBudgets } = useQuery({
    queryKey: ["maintenance-budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_budgets")
        .select("*");

      if (error) {
        console.error("Error fetching maintenance budgets:", error);
        throw error;
      }

      return data as MaintenanceBudget[];
    },
    enabled: !!user,
  });

  const addEntryMutation = useMutation({
    mutationFn: async (formData: MaintenanceFormData) => {
      const { data, error } = await supabase
        .from("maintenance_entries")
        .insert({
          loja: formData.loja,
          loja_id: formData.loja_id,
          fornecedor: formData.fornecedor,
          data_servico: formData.data_servico,
          numero_nf: formData.numero_nf,
          valor: formData.valor,
          descricao: formData.descricao || null,
          anexo_url: formData.anexo_url,
          cpf_cnpj: formData.cpf_cnpj || null,
          chave_pix: formData.chave_pix || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log("Maintenance entry added successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["maintenance-entries"] });
      toast.success("Manutenção cadastrada com sucesso!", {
        description: `${data.fornecedor} - R$ ${data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        duration: 5000,
      });
    },
    onError: (error: Error) => {
      console.error("Error adding maintenance entry:", error);
      toast.error("Erro ao cadastrar manutenção", {
        description: error.message || "Verifique sua conexão e tente novamente.",
      });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("maintenance_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-entries"] });
      toast.success("Registro excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting maintenance entry:", error);
      toast.error("Erro ao excluir registro");
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async ({ lojaId, budget }: { lojaId: string; budget: number }) => {
      // Try to update first
      const { data: existing } = await supabase
        .from("maintenance_budgets")
        .select("id")
        .eq("loja_id", lojaId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("maintenance_budgets")
          .update({ budget_mensal: budget })
          .eq("loja_id", lojaId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("maintenance_budgets")
          .insert({ loja_id: lojaId, budget_mensal: budget });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-budgets"] });
      toast.success("Budget atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating budget:", error);
      toast.error("Erro ao atualizar budget");
    },
  });

  return {
    entries,
    budgets,
    isLoading: isLoadingEntries || isLoadingBudgets,
    addEntry: addEntryMutation.mutateAsync,
    deleteEntry: deleteEntryMutation.mutateAsync,
    updateBudget: updateBudgetMutation.mutateAsync,
    isAdding: addEntryMutation.isPending,
  };
}
