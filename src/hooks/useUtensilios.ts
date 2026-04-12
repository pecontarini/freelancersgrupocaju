import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useUtensiliosCatalog() {
  return useQuery({
    queryKey: ["utensilios_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items_catalog")
        .select("*")
        .eq("is_utensilio", true)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUtensiliosItems(lojaId: string | null) {
  return useQuery({
    queryKey: ["utensilios_items", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_items")
        .select("*, items_catalog(*)")
        .eq("loja_id", lojaId!)
        .eq("is_active", true)
        .order("ordem_prioridade");
      if (error) throw error;
      return data;
    },
  });
}

export function useUtensiliosContagens(lojaId: string | null, semanaRef: string | null) {
  return useQuery({
    queryKey: ["utensilios_contagens", lojaId, semanaRef],
    enabled: !!lojaId && !!semanaRef,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_contagens")
        .select("*, utensilios_items(*, items_catalog(*))")
        .eq("loja_id", lojaId!)
        .eq("semana_referencia", semanaRef!);
      if (error) throw error;
      return data;
    },
  });
}

export function useDistinctSemanas(lojaId: string | null) {
  return useQuery({
    queryKey: ["utensilios_semanas_distinct", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_contagens")
        .select("semana_referencia")
        .eq("loja_id", lojaId!)
        .order("semana_referencia", { ascending: false });
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.semana_referencia))];
      return unique;
    },
  });
}

export function useSaveContagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contagens: Array<{
      loja_id: string;
      utensilio_item_id: string;
      turno: string;
      quantidade_contada: number;
      data_contagem: string;
      semana_referencia: string;
      responsavel?: string;
    }>) => {
      const { error } = await supabase.from("utensilios_contagens").insert(contagens);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utensilios_contagens"] });
      qc.invalidateQueries({ queryKey: ["utensilios_semanas_distinct"] });
      toast.success("Contagem salva");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUtensiliosConfig(lojaId: string | null) {
  return useQuery({
    queryKey: ["utensilios_config", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_config")
        .select("*")
        .eq("loja_id", lojaId!)
        .order("mes_referencia", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
  });
}

export function useCreatePedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pedidos: Array<{
      loja_id: string;
      utensilio_item_id: string;
      config_id: string;
      qtd_deficit: number;
      qtd_aprovada: number;
      valor_unitario: number;
      status: string;
    }>) => {
      const { error } = await supabase.from("utensilios_pedidos").insert(pedidos);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utensilios_pedidos"] });
      toast.success("Pedidos gerados");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUtensiliosPedidos(lojaId: string | null) {
  return useQuery({
    queryKey: ["utensilios_pedidos", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_pedidos")
        .select("*, utensilios_items(*, items_catalog(*))")
        .eq("loja_id", lojaId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

// ── NEW: Bulk upsert utensilios_items for a store ──

export function useBulkCreateUtensiliosItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{
      catalog_item_id: string;
      loja_id: string;
      estoque_minimo: number;
      valor_unitario?: number;
      area_responsavel?: string;
    }>) => {
      // upsert using the unique constraint (catalog_item_id, loja_id)
      const rows = items.map((i) => ({
        catalog_item_id: i.catalog_item_id,
        loja_id: i.loja_id,
        estoque_minimo: i.estoque_minimo,
        valor_unitario: i.valor_unitario ?? 0,
        area_responsavel: i.area_responsavel || "Front",
        is_active: true,
      }));
      const { error } = await supabase
        .from("utensilios_items")
        .upsert(rows, { onConflict: "catalog_item_id,loja_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utensilios_items"] });
      toast.success("Estoque mínimo salvo com sucesso!");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateUtensilioItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (update: { id: string; estoque_minimo?: number; valor_unitario?: number }) => {
      const { id, ...fields } = update;
      const { error } = await supabase.from("utensilios_items").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utensilios_items"] });
      toast.success("Item atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ── Bulk: fetch ALL stores' utensilio items ──
export function useAllUtensiliosItems() {
  return useQuery({
    queryKey: ["utensilios_items_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_items")
        .select("catalog_item_id, loja_id, estoque_minimo, valor_unitario, area_responsavel")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });
}

// ── Bulk: upsert items for multiple stores ──
export function useBulkImportUtensiliosItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{
      catalog_item_id: string;
      loja_id: string;
      estoque_minimo: number;
      valor_unitario?: number;
      area_responsavel?: string;
    }>) => {
      const rows = items.map((i) => ({
        catalog_item_id: i.catalog_item_id,
        loja_id: i.loja_id,
        estoque_minimo: i.estoque_minimo,
        valor_unitario: i.valor_unitario ?? 0,
        area_responsavel: i.area_responsavel || "Front",
        is_active: true,
      }));
      // Upsert in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase
          .from("utensilios_items")
          .upsert(batch, { onConflict: "catalog_item_id,loja_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utensilios_items"] });
      qc.invalidateQueries({ queryKey: ["utensilios_items_all"] });
      toast.success("Importação em massa concluída!");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
