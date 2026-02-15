import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RealtimeStockPosition {
  item_id: string;
  item_name: string;
  categoria: string;
  unidade: string;
  last_count_qty: number;
  last_count_date: string | null;
  entries_qty: number;
  exits_qty: number;
  current_qty: number;
  preco_custo_atual: number;
  current_value: number;
  days_since_count: number | null;
}

export function useRealtimeStock(unitId?: string) {
  const query = useQuery({
    queryKey: ["realtime-stock", unitId],
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase.rpc("get_realtime_stock_positions", {
        p_unit_id: unitId,
      });
      if (error) throw error;
      return (data || []) as unknown as RealtimeStockPosition[];
    },
    enabled: !!unitId,
    refetchInterval: 30_000, // auto-refresh every 30s for "live" feel
  });

  const positions = query.data || [];

  const totalValue = positions.reduce((sum, p) => sum + (p.current_value || 0), 0);
  const totalItems = positions.length;
  const totalEntries = positions.reduce((sum, p) => sum + (p.entries_qty || 0), 0);

  // Find the most recent count date across all items
  const lastGeneralCountDate = positions.reduce<string | null>((latest, p) => {
    if (!p.last_count_date) return latest;
    if (!latest) return p.last_count_date;
    return p.last_count_date > latest ? p.last_count_date : latest;
  }, null);

  // Items with negative stock (alerts)
  const negativeItems = positions.filter((p) => p.current_qty < 0);

  // Items never counted
  const uncountedItems = positions.filter((p) => p.last_count_date === null);

  return {
    positions,
    totalValue,
    totalItems,
    totalEntries,
    lastGeneralCountDate,
    negativeItems,
    uncountedItems,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
