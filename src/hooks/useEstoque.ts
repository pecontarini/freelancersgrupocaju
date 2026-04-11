import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { toast } from "sonner";

export function useSetores() {
  return useQuery({
    queryKey: ["setores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setores")
        .select("*")
        .eq("is_active", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });
}

export function useSetorItems(lojaId: string | null) {
  return useQuery({
    queryKey: ["setor_items", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setor_items")
        .select("*, items_catalog(*), setores(*)")
        .eq("loja_id", lojaId!)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });
}

export function useInventarios(lojaId: string | null) {
  return useQuery({
    queryKey: ["inventarios", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventarios")
        .select("*, setores(nome)")
        .eq("loja_id", lojaId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useInventarioItems(inventarioId: string | null) {
  return useQuery({
    queryKey: ["inventario_items", inventarioId],
    enabled: !!inventarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventario_items")
        .select("*, setor_items(*, items_catalog(*))")
        .eq("inventario_id", inventarioId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useMovimentacoes(lojaId: string | null) {
  return useQuery({
    queryKey: ["movimentacoes_estoque", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_estoque")
        .select("*, setor_items(*, items_catalog(*), setores(nome))")
        .eq("loja_id", lojaId!)
        .order("data_movimentacao", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useItemsCatalog() {
  return useQuery({
    queryKey: ["items_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items_catalog")
        .select("*", { count: "exact" })
        .eq("is_active", true)
        .order("name")
        .range(0, 1999);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inv: {
      setor_id: string;
      loja_id: string;
      tipo: string;
      turno?: string;
      data_inventario: string;
      semana_referencia?: string;
      responsavel?: string;
    }) => {
      const { data, error } = await supabase
        .from("inventarios")
        .insert(inv)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      toast.success("Inventário criado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSaveInventarioItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{
      inventario_id: string;
      setor_item_id: string;
      quantidade_anterior: number;
      quantidade_contada: number;
      observacao?: string;
    }>) => {
      const { error } = await supabase.from("inventario_items").insert(items);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventario_items"] });
      toast.success("Contagem salva com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useConcluirInventario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inventarioId: string) => {
      const { error } = await supabase
        .from("inventarios")
        .update({ status: "CONCLUIDO" })
        .eq("id", inventarioId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventarios"] });
      toast.success("Inventário concluído");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreateMovimentacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mov: {
      setor_item_id: string;
      loja_id: string;
      tipo_movimentacao: string;
      quantidade: number;
      setor_destino_id?: string;
      responsavel?: string;
      observacao?: string;
    }) => {
      const { error } = await supabase.from("movimentacoes_estoque").insert(mov);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      toast.success("Movimentação registrada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreateSetorItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: {
      catalog_item_id: string;
      setor_id: string;
      loja_id: string;
      estoque_minimo: number;
      estoque_maximo?: number;
      ponto_pedido?: number;
    }) => {
      const { error } = await supabase.from("setor_items").insert(item);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["setor_items"] });
      toast.success("Item vinculado ao setor");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateSetorItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      estoque_minimo?: number;
      estoque_maximo?: number;
      ponto_pedido?: number;
    }) => {
      const { error } = await supabase
        .from("setor_items")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["setor_items"] });
      toast.success("Vínculo atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateCatalogItemCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, preco_custo }: { id: string; preco_custo: number }) => {
      const { error } = await supabase
        .from("items_catalog")
        .update({ preco_custo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items_catalog"] });
      toast.success("Custo atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useLatestInventarioItems(lojaId: string | null) {
  return useQuery({
    queryKey: ["latest_inventario_items", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      // Get the latest CONCLUIDO inventario per setor_item
      const { data: inventarios, error: invErr } = await supabase
        .from("inventarios")
        .select("id, setor_id, status, data_inventario")
        .eq("loja_id", lojaId!)
        .eq("status", "CONCLUIDO")
        .order("data_inventario", { ascending: false });
      if (invErr) throw invErr;
      if (!inventarios?.length) return [];

      const invIds = inventarios.map((i: any) => i.id);
      const { data: items, error: itemsErr } = await supabase
        .from("inventario_items")
        .select("*, setor_items(catalog_item_id)")
        .in("inventario_id", invIds);
      if (itemsErr) throw itemsErr;
      return items || [];
    },
  });
}

export function useMovimentacoesAfterDate(lojaId: string | null) {
  return useQuery({
    queryKey: ["movimentacoes_after", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_estoque")
        .select("*, setor_items(catalog_item_id)")
        .eq("loja_id", lojaId!)
        .order("data_movimentacao", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}
