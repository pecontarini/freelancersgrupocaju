import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CMVContagem {
  id: string;
  cmv_item_id: string;
  loja_id: string;
  data_contagem: string;
  quantidade: number;
  preco_custo_snapshot: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  cmv_items?: {
    id: string;
    nome: string;
    unidade: string;
    categoria: string | null;
    peso_padrao_g: number | null;
  };
}

export function useCMVContagens(lojaId?: string, startDate?: string, endDate?: string) {
  const queryClient = useQueryClient();

  const contagensQuery = useQuery({
    queryKey: ["cmv-contagens", lojaId, startDate, endDate],
    queryFn: async () => {
      if (!lojaId) return [];
      
      let query = supabase
        .from("cmv_contagens")
        .select(`
          *,
          cmv_items (
            id,
            nome,
            unidade,
            categoria,
            peso_padrao_g
          )
        `)
        .eq("loja_id", lojaId)
        .order("data_contagem", { ascending: false });

      if (startDate) {
        query = query.gte("data_contagem", startDate);
      }
      if (endDate) {
        query = query.lte("data_contagem", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CMVContagem[];
    },
    enabled: !!lojaId,
  });

  const contagensByDateQuery = useQuery({
    queryKey: ["cmv-contagens-by-date", lojaId, startDate],
    queryFn: async () => {
      if (!lojaId || !startDate) return [];
      
      const { data, error } = await supabase
        .from("cmv_contagens")
        .select(`
          *,
          cmv_items (
            id,
            nome,
            unidade,
            categoria,
            peso_padrao_g
          )
        `)
        .eq("loja_id", lojaId)
        .eq("data_contagem", startDate)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as CMVContagem[];
    },
    enabled: !!lojaId && !!startDate,
  });

  const upsertContagem = useMutation({
    mutationFn: async (contagem: {
      cmv_item_id: string;
      loja_id: string;
      data_contagem: string;
      quantidade: number;
      preco_custo_snapshot: number;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("cmv_contagens")
        .upsert({
          ...contagem,
          created_by: user.user?.id,
        }, {
          onConflict: "cmv_item_id,loja_id,data_contagem",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-contagens"] });
      toast.success("Contagem salva!");
    },
    onError: (error) => {
      console.error("Error saving contagem:", error);
      toast.error("Erro ao salvar contagem");
    },
  });

  const bulkUpsertContagens = useMutation({
    mutationFn: async (contagens: {
      cmv_item_id: string;
      loja_id: string;
      data_contagem: string;
      quantidade: number;
      preco_custo_snapshot: number;
    }[]) => {
      const { data: user } = await supabase.auth.getUser();
      
      const contagensWithUser = contagens.map(c => ({
        ...c,
        created_by: user.user?.id,
      }));

      const { data, error } = await supabase
        .from("cmv_contagens")
        .upsert(contagensWithUser, {
          onConflict: "cmv_item_id,loja_id,data_contagem",
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["cmv-contagens"] });
      toast.success(`${data.length} contagens salvas!`);
    },
    onError: (error) => {
      console.error("Error saving contagens:", error);
      toast.error("Erro ao salvar contagens");
    },
  });

  return {
    contagens: contagensQuery.data || [],
    contagensByDate: contagensByDateQuery.data || [],
    isLoading: contagensQuery.isLoading,
    isLoadingByDate: contagensByDateQuery.isLoading,
    upsertContagem,
    bulkUpsertContagens,
  };
}

export interface AuditPeriodRow {
  item_id: string;
  item_name: string;
  categoria: string;
  unidade: string;
  initial_stock: number;
  initial_cost: number;
  purchases_qty: number;
  sales_consumption: number;
  waste_qty: number;
  transfers_qty: number;
  theoretical_final: number;
  real_final_stock: number;
  final_cost: number;
  divergence: number;
  financial_loss: number;
  has_initial_count: boolean;
  has_final_count: boolean;
}

export function useCMVAuditPeriod(lojaId?: string, startDate?: string, endDate?: string) {
  // Check if initial counts exist for start date
  const initialCheckQuery = useQuery({
    queryKey: ["cmv-audit-initial-check", lojaId, startDate],
    queryFn: async () => {
      if (!lojaId || !startDate) return 0;
      const { count, error } = await supabase
        .from("cmv_contagens")
        .select("*", { count: "exact", head: true })
        .eq("loja_id", lojaId)
        .eq("data_contagem", startDate);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!lojaId && !!startDate,
  });

  // Check if final counts exist for end date
  const finalCheckQuery = useQuery({
    queryKey: ["cmv-audit-final-check", lojaId, endDate],
    queryFn: async () => {
      if (!lojaId || !endDate) return 0;
      const { count, error } = await supabase
        .from("cmv_contagens")
        .select("*", { count: "exact", head: true })
        .eq("loja_id", lojaId)
        .eq("data_contagem", endDate);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!lojaId && !!endDate,
  });

  // Main audit calculation via DB function
  const auditQuery = useQuery({
    queryKey: ["cmv-audit-calculate", lojaId, startDate, endDate],
    queryFn: async () => {
      if (!lojaId || !startDate || !endDate) return [];
      const { data, error } = await supabase.rpc("calculate_audit_period", {
        p_loja_id: lojaId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return (data || []) as AuditPeriodRow[];
    },
    enabled: !!lojaId && !!startDate && !!endDate
      && (initialCheckQuery.data ?? 0) > 0
      && (finalCheckQuery.data ?? 0) > 0,
  });

  return {
    auditData: auditQuery.data || [],
    hasInitialCounts: (initialCheckQuery.data ?? 0) > 0,
    hasFinalCounts: (finalCheckQuery.data ?? 0) > 0,
    initialCountsLoading: initialCheckQuery.isLoading,
    finalCountsLoading: finalCheckQuery.isLoading,
    isLoading: auditQuery.isLoading || initialCheckQuery.isLoading || finalCheckQuery.isLoading,
    // Legacy exports for backward compatibility
    initialCounts: [],
    finalCounts: [],
    entries: [],
    sales: [],
  };
}
