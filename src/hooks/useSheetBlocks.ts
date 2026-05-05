import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SheetBlockType = "ranking" | "matrix" | "series" | "distribution" | "item_table" | "kpi_strip";

export interface SheetBlock {
  id: string;
  meta_key: string;
  block_key: string;
  block_type: SheetBlockType;
  mes_ref: string;
  loja_codigo: string | null;
  payload: Record<string, unknown>;
  ordem: number;
  updated_at: string;
}

/** Busca todos os blocos estruturados de uma meta + mes. */
export function useSheetBlocks(metaKey: string | null | undefined, mesRef?: string) {
  const month = mesRef || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  return useQuery({
    queryKey: ["sheet_blocks", metaKey, month],
    enabled: !!metaKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sheets_blocks_snapshot")
        .select("*")
        .eq("meta_key", metaKey!)
        .eq("mes_ref", month)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as SheetBlock[];
    },
    staleTime: 60_000,
  });
}
