import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface StoreBudget {
  id: string;
  store_id: string;
  month_year: string;
  budget_amount: number;
  created_at: string;
  updated_at: string;
}

export function useStoreBudgets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all store budgets
  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["store_budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_budgets")
        .select("*")
        .order("month_year", { ascending: false });

      if (error) throw error;
      return data as StoreBudget[];
    },
  });

  // Get current month in YYYY-MM format
  const getCurrentMonthYear = () => format(new Date(), "yyyy-MM");

  // Get budget for a specific store and month
  const getBudgetForStoreMonth = (storeId: string, monthYear?: string) => {
    const targetMonth = monthYear || getCurrentMonthYear();
    return budgets.find(
      (b) => b.store_id === storeId && b.month_year === targetMonth
    );
  };

  // Upsert budget mutation
  const upsertBudgetMutation = useMutation({
    mutationFn: async ({
      store_id,
      month_year,
      budget_amount,
    }: {
      store_id: string;
      month_year: string;
      budget_amount: number;
    }) => {
      const { data, error } = await supabase
        .from("store_budgets")
        .upsert(
          { store_id, month_year, budget_amount },
          { onConflict: "store_id,month_year" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_budgets"] });
      toast({
        title: "Budget atualizado",
        description: "O orçamento foi salvo com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Error updating budget:", error);
      toast({
        title: "Erro ao atualizar budget",
        description: "Não foi possível salvar o orçamento.",
        variant: "destructive",
      });
    },
  });

  // Delete budget mutation
  const deleteBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      const { error } = await supabase
        .from("store_budgets")
        .delete()
        .eq("id", budgetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_budgets"] });
      toast({
        title: "Budget removido",
        description: "O orçamento foi removido com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Error deleting budget:", error);
      toast({
        title: "Erro ao remover budget",
        description: "Não foi possível remover o orçamento.",
        variant: "destructive",
      });
    },
  });

  return {
    budgets,
    isLoading,
    getCurrentMonthYear,
    getBudgetForStoreMonth,
    upsertBudget: upsertBudgetMutation.mutateAsync,
    deleteBudget: deleteBudgetMutation.mutateAsync,
    isUpdating: upsertBudgetMutation.isPending,
    isDeleting: deleteBudgetMutation.isPending,
  };
}
