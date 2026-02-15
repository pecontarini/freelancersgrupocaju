import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KardexDayRow {
  date: string;
  opening_balance: number;
  total_entry: number;
  total_sales: number;
  total_waste: number;
  theoretical_balance: number;
  physical_count: number | null;
  divergence: number | null;
}

export interface InventoryTransaction {
  id: string;
  date: string;
  quantity: number;
  transaction_type: string;
  reference_id: string | null;
  notes: string | null;
}

export function useInventoryKardex(
  unitId: string | undefined,
  ingredientId: string | undefined,
  startDate: string,
  endDate: string
) {
  // Fetch daily stock positions
  const { data: positions = [], isLoading: isLoadingPositions } = useQuery({
    queryKey: ["daily-stock-positions", unitId, ingredientId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_stock_positions")
        .select("*")
        .eq("unit_id", unitId!)
        .eq("ingredient_id", ingredientId!)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as KardexDayRow[];
    },
    enabled: !!unitId && !!ingredientId,
  });

  // Fetch raw transactions for drill-down
  const { data: transactions = [], isLoading: isLoadingTx } = useQuery({
    queryKey: ["inventory-transactions", unitId, ingredientId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("*")
        .eq("unit_id", unitId!)
        .eq("ingredient_id", ingredientId!)
        .gte("date", `${startDate}T00:00:00`)
        .lte("date", `${endDate}T23:59:59`)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as InventoryTransaction[];
    },
    enabled: !!unitId && !!ingredientId,
  });

  return {
    positions,
    transactions,
    isLoading: isLoadingPositions || isLoadingTx,
  };
}
