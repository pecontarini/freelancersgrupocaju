import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MaintenanceEntry, MaintenanceFormData, MaintenanceBudget } from "@/types/maintenance";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useTenant } from "@/contexts/TenantContext";

export function useMaintenanceEntries() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ["maintenance-entries", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return fetchAllRows<MaintenanceEntry>(
        () => supabase
          .from("maintenance_entries")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("data_servico", { ascending: false })
      );
    },
    enabled: !!user,
  });

  const { data: budgets = [], isLoading: isLoadingBudgets } = useQuery({
    queryKey: ["maintenance-budgets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("maintenance_budgets")
        .select("*")
        .eq("tenant_id", tenantId);

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
      if (!tenantId) throw new Error("Empresa ativa não encontrada.");
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
          boleto_url: formData.boleto_url,
          cpf_cnpj: formData.cpf_cnpj || null,
          chave_pix: formData.chave_pix || null,
          created_by: user?.id,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-entries", tenantId] });
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

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaintenanceFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from("maintenance_entries")
        .update(updates)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-entries", tenantId] });
      toast.success("Manutenção atualizada com sucesso!");
    },
    onError: (error: Error) => {
      console.error("Error updating maintenance entry:", error);
      toast.error("Erro ao atualizar manutenção");
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("maintenance_entries")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-entries", tenantId] });
      toast.success("Registro excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting maintenance entry:", error);
      toast.error("Erro ao excluir registro");
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async ({ lojaId, budget }: { lojaId: string; budget: number }) => {
      if (!tenantId) throw new Error("Empresa ativa não encontrada.");
      // Try to update first
      const { data: existing } = await supabase
        .from("maintenance_budgets")
        .select("id")
        .eq("loja_id", lojaId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("maintenance_budgets")
          .update({ budget_mensal: budget })
          .eq("loja_id", lojaId)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("maintenance_budgets")
          .insert({ loja_id: lojaId, budget_mensal: budget, tenant_id: tenantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-budgets", tenantId] });
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
    updateEntry: updateEntryMutation.mutateAsync,
    deleteEntry: deleteEntryMutation.mutateAsync,
    updateBudget: updateBudgetMutation.mutateAsync,
    isAdding: addEntryMutation.isPending,
  };
}
