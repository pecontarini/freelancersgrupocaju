import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export type OperationalCategory = "uniformes" | "limpeza" | "apoio";

export interface OperationalExpense {
  id: string;
  store_id: string;
  category: OperationalCategory;
  valor: number;
  data_despesa: string;
  descricao: string | null;
  created_by: string | null;
  created_at: string;
}

export function useOperationalExpenses() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all operational expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["operational_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operational_expenses")
        .select("*")
        .order("data_despesa", { ascending: false });

      if (error) throw error;
      return data as OperationalExpense[];
    },
  });

  // Add expense mutation
  const addExpenseMutation = useMutation({
    mutationFn: async ({
      store_id,
      category,
      valor,
      data_despesa,
      descricao,
    }: {
      store_id: string;
      category: OperationalCategory;
      valor: number;
      data_despesa: string;
      descricao?: string;
    }) => {
      const { data, error } = await supabase
        .from("operational_expenses")
        .insert({
          store_id,
          category,
          valor,
          data_despesa,
          descricao: descricao || null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operational_expenses"] });
      toast({
        title: "Despesa registrada",
        description: "O custo operacional foi registrado com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Error adding expense:", error);
      toast({
        title: "Erro ao registrar despesa",
        description: "Não foi possível salvar o custo operacional.",
        variant: "destructive",
      });
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await supabase
        .from("operational_expenses")
        .delete()
        .eq("id", expenseId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operational_expenses"] });
      toast({
        title: "Despesa removida",
        description: "O registro foi removido com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Error deleting expense:", error);
      toast({
        title: "Erro ao remover despesa",
        description: "Não foi possível remover o registro.",
        variant: "destructive",
      });
    },
  });

  // Get expenses for a specific store and month
  const getExpensesForStoreMonth = (storeId: string, monthYear: string) => {
    return expenses.filter((e) => {
      const expenseMonth = e.data_despesa.substring(0, 7); // YYYY-MM
      return e.store_id === storeId && expenseMonth === monthYear;
    });
  };

  // Get totals by category for a specific store and month
  const getTotalsForStoreMonth = (storeId: string, monthYear: string) => {
    const filtered = getExpensesForStoreMonth(storeId, monthYear);
    const uniformes = filtered
      .filter((e) => e.category === "uniformes")
      .reduce((sum, e) => sum + e.valor, 0);
    const limpeza = filtered
      .filter((e) => e.category === "limpeza")
      .reduce((sum, e) => sum + e.valor, 0);
    
    return { uniformes, limpeza, total: uniformes + limpeza };
  };

  return {
    expenses,
    isLoading,
    addExpense: addExpenseMutation.mutateAsync,
    deleteExpense: deleteExpenseMutation.mutateAsync,
    getExpensesForStoreMonth,
    getTotalsForStoreMonth,
    isAdding: addExpenseMutation.isPending,
    isDeleting: deleteExpenseMutation.isPending,
  };
}
