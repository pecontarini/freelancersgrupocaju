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

export function useCMVAuditPeriod(lojaId?: string, startDate?: string, endDate?: string) {
  // Get initial count (start date)
  const initialCountQuery = useQuery({
    queryKey: ["cmv-audit-initial", lojaId, startDate],
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
            peso_padrao_g,
            preco_custo_atual
          )
        `)
        .eq("loja_id", lojaId)
        .eq("data_contagem", startDate);

      if (error) throw error;
      return data;
    },
    enabled: !!lojaId && !!startDate,
  });

  // Get final count (end date)
  const finalCountQuery = useQuery({
    queryKey: ["cmv-audit-final", lojaId, endDate],
    queryFn: async () => {
      if (!lojaId || !endDate) return [];
      
      const { data, error } = await supabase
        .from("cmv_contagens")
        .select(`
          *,
          cmv_items (
            id,
            nome,
            unidade,
            categoria,
            peso_padrao_g,
            preco_custo_atual
          )
        `)
        .eq("loja_id", lojaId)
        .eq("data_contagem", endDate);

      if (error) throw error;
      return data;
    },
    enabled: !!lojaId && !!endDate,
  });

  // Get entries (NFe) in period
  const entriesQuery = useQuery({
    queryKey: ["cmv-audit-entries", lojaId, startDate, endDate],
    queryFn: async () => {
      if (!lojaId || !startDate || !endDate) return [];
      
      const { data, error } = await supabase
        .from("cmv_movements")
        .select(`
          *,
          cmv_items (
            id,
            nome
          )
        `)
        .eq("loja_id", lojaId)
        .eq("tipo_movimento", "entrada")
        .gte("data_movimento", startDate)
        .lte("data_movimento", endDate);

      if (error) throw error;
      return data;
    },
    enabled: !!lojaId && !!startDate && !!endDate,
  });

  // Get sales (exits) in period
  const salesQuery = useQuery({
    queryKey: ["cmv-audit-sales", lojaId, startDate, endDate],
    queryFn: async () => {
      if (!lojaId || !startDate || !endDate) return [];
      
      const { data, error } = await supabase
        .from("cmv_movements")
        .select(`
          *,
          cmv_items (
            id,
            nome
          )
        `)
        .eq("loja_id", lojaId)
        .eq("tipo_movimento", "saida")
        .gte("data_movimento", startDate)
        .lte("data_movimento", endDate);

      if (error) throw error;
      return data;
    },
    enabled: !!lojaId && !!startDate && !!endDate,
  });

  return {
    initialCounts: initialCountQuery.data || [],
    finalCounts: finalCountQuery.data || [],
    entries: entriesQuery.data || [],
    sales: salesQuery.data || [],
    isLoading: initialCountQuery.isLoading || finalCountQuery.isLoading || 
               entriesQuery.isLoading || salesQuery.isLoading,
  };
}
