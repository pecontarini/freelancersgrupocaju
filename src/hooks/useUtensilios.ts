import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
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
        .eq("ativo", true);
      if (error) throw error;
      return data;
    },
  });
}

export function useUtensiliosSemanas(lojaId: string | null) {
  return useQuery({
    queryKey: ["utensilios_semanas", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_semanas")
        .select("*")
        .eq("loja_id", lojaId!)
        .order("data_inicio", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export function useUtensiliosContagens(semanaId: string | null) {
  return useQuery({
    queryKey: ["utensilios_contagens", semanaId],
    enabled: !!semanaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_contagens")
        .select("*, utensilios_items(*, items_catalog(*))")
        .eq("semana_id", semanaId!);
      if (error) throw error;
      return data;
    },
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

export function useCreateSemana() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (semana: {
      loja_id: string;
      data_inicio: string;
      data_fim: string;
      semana_label: string;
    }) => {
      const { data, error } = await supabase
        .from("utensilios_semanas")
        .insert(semana)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utensilios_semanas"] });
      toast.success("Semana criada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSaveContagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contagens: Array<{
      semana_id: string;
      utensilio_item_id: string;
      turno: string;
      quantidade_contada: number;
      responsavel?: string;
    }>) => {
      const { error } = await supabase.from("utensilios_contagens").upsert(contagens, {
        onConflict: "semana_id,utensilio_item_id,turno",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utensilios_contagens"] });
      toast.success("Contagem salva");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useCreatePedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pedidos: Array<{
      loja_id: string;
      utensilio_item_id: string;
      semana_id: string;
      qtd_necessaria: number;
      qtd_aprovada: number;
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

export function useUtensiliosBudgetConfig(lojaId: string | null) {
  return useQuery({
    queryKey: ["utensilios_budget_config", lojaId],
    enabled: !!lojaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utensilios_items")
        .select("*, items_catalog(name, code, preco_custo)")
        .eq("loja_id", lojaId!)
        .eq("ativo", true)
        .order("prioridade_reposicao", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
