import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CMVPendingItem {
  id: string;
  nome_venda_normalizado: string;
  nome_venda_original: string;
  primeira_ocorrencia: string;
  ultima_ocorrencia: string;
  total_ocorrencias: number;
  loja_id: string | null;
  status: "pendente" | "ignorado";
  created_at: string;
  updated_at: string;
}

// Normalize item name to match database function
export function normalizeItemName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function useCMVPendingItems() {
  const queryClient = useQueryClient();

  const { data: pendingItems = [], isLoading } = useQuery({
    queryKey: ["cmv-pending-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_pending_sales_items")
        .select("*")
        .eq("status", "pendente")
        .order("ultima_ocorrencia", { ascending: false });
      if (error) throw error;
      return data as CMVPendingItem[];
    },
  });

  const addPendingItem = useMutation({
    mutationFn: async (item: {
      nome_venda_original: string;
      loja_id?: string;
    }) => {
      const normalized = normalizeItemName(item.nome_venda_original);
      
      // Try to upsert - increment occurrences if exists
      const { data: existing } = await supabase
        .from("cmv_pending_sales_items")
        .select("id, total_ocorrencias")
        .eq("nome_venda_normalizado", normalized)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("cmv_pending_sales_items")
          .update({
            total_ocorrencias: existing.total_ocorrencias + 1,
            ultima_ocorrencia: new Date().toISOString().split("T")[0],
          })
          .eq("id", existing.id);
        if (error) throw error;
        return existing;
      }

      const { data, error } = await supabase
        .from("cmv_pending_sales_items")
        .insert({
          nome_venda_normalizado: normalized,
          nome_venda_original: item.nome_venda_original,
          loja_id: item.loja_id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-pending-items"] });
    },
  });

  const removePendingItem = useMutation({
    mutationFn: async (nomeNormalizado: string) => {
      const { error } = await supabase
        .from("cmv_pending_sales_items")
        .delete()
        .eq("nome_venda_normalizado", nomeNormalizado);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-pending-items"] });
    },
  });

  const ignorePendingItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cmv_pending_sales_items")
        .update({ status: "ignorado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-pending-items"] });
      toast.success("Item marcado como ignorado");
    },
  });

  return {
    pendingItems,
    isLoading,
    addPendingItem,
    removePendingItem,
    ignorePendingItem,
  };
}
