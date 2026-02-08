import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
export interface CMVItem {
  id: string;
  nome: string;
  unidade: string;
  peso_padrao_g: number | null;
  preco_custo_atual: number;
  categoria: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CMVSalesMapping {
  id: string;
  nome_venda: string;
  cmv_item_id: string;
  multiplicador: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
  cmv_item?: CMVItem;
}

export interface CMVMovement {
  id: string;
  cmv_item_id: string;
  loja_id: string;
  tipo_movimento: "entrada" | "saida" | "inventario";
  quantidade: number;
  preco_unitario: number | null;
  data_movimento: string;
  referencia: string | null;
  created_by: string | null;
  created_at: string;
  cmv_item?: CMVItem;
}

export interface CMVInventory {
  id: string;
  cmv_item_id: string;
  loja_id: string;
  quantidade_atual: number;
  ultima_contagem: string | null;
  updated_at: string;
  cmv_item?: CMVItem;
}

// Hook for CMV Items
export function useCMVItems() {
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["cmv-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_items")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as CMVItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async (item: Omit<CMVItem, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("cmv_items")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-items"] });
      toast.success("Item cadastrado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar item: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CMVItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("cmv_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-items"] });
      toast.success("Item atualizado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar item: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cmv_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-items"] });
      toast.success("Item removido com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover item: ${error.message}`);
    },
  });

  return { items, isLoading, addItem, updateItem, deleteItem };
}

// Hook for Sales Mappings
export function useCMVSalesMappings() {
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["cmv-sales-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_sales_mappings")
        .select("*, cmv_item:cmv_items(*)")
        .order("nome_venda");
      if (error) throw error;
      return data as CMVSalesMapping[];
    },
  });

  const addMapping = useMutation({
    mutationFn: async (mapping: {
      nome_venda: string;
      cmv_item_id: string;
      multiplicador: number;
      notas?: string;
      is_global?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("cmv_sales_mappings")
        .insert({
          nome_venda: mapping.nome_venda,
          cmv_item_id: mapping.cmv_item_id,
          multiplicador: mapping.multiplicador,
          notas: mapping.notas,
          is_global: mapping.is_global ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-sales-mappings"] });
      toast.success("Mapeamento salvo com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar mapeamento: ${error.message}`);
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cmv_sales_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-sales-mappings"] });
      toast.success("Mapeamento removido!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover mapeamento: ${error.message}`);
    },
  });

  return { mappings, isLoading, addMapping, deleteMapping };
}

// Hook for Inventory
export function useCMVInventory(lojaId?: string) {
  const queryClient = useQueryClient();

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["cmv-inventory", lojaId],
    queryFn: async () => {
      let query = supabase
        .from("cmv_inventory")
        .select("*, cmv_item:cmv_items(*)");
      
      if (lojaId) {
        query = query.eq("loja_id", lojaId);
      }

      const { data, error } = await query.order("updated_at", { ascending: false });
      if (error) throw error;
      return data as CMVInventory[];
    },
    enabled: !!lojaId,
  });

  const upsertInventory = useMutation({
    mutationFn: async (inv: {
      cmv_item_id: string;
      loja_id: string;
      quantidade_atual: number;
      ultima_contagem?: string;
    }) => {
      const { data, error } = await supabase
        .from("cmv_inventory")
        .upsert(inv, { onConflict: "cmv_item_id,loja_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-inventory"] });
      toast.success("Inventário atualizado!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar inventário: ${error.message}`);
    },
  });

  return { inventory, isLoading, upsertInventory };
}

// Hook for Movements
export function useCMVMovements(lojaId?: string) {
  const queryClient = useQueryClient();

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["cmv-movements", lojaId],
    queryFn: async () => {
      let query = supabase
        .from("cmv_movements")
        .select("*, cmv_item:cmv_items(*)");
      
      if (lojaId) {
        query = query.eq("loja_id", lojaId);
      }

      const { data, error } = await query.order("data_movimento", { ascending: false }).limit(100);
      if (error) throw error;
      return data as CMVMovement[];
    },
    enabled: !!lojaId,
  });

  const addMovement = useMutation({
    mutationFn: async (mov: {
      cmv_item_id: string;
      loja_id: string;
      tipo_movimento: "entrada" | "saida" | "inventario";
      quantidade: number;
      preco_unitario?: number;
      data_movimento: string;
      referencia?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("cmv_movements")
        .insert({ ...mov, created_by: user.user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cmv-movements"] });
      queryClient.invalidateQueries({ queryKey: ["cmv-inventory"] });
      toast.success("Movimentação registrada!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar movimentação: ${error.message}`);
    },
  });

  return { movements, isLoading, addMovement };
}
