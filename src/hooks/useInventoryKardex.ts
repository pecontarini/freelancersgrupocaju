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

export function useInventoryKardex(
  unitId: string | undefined,
  ingredientId: string | undefined,
  startDate: string,
  endDate: string
) {
  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["kardex-daily", unitId, ingredientId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("compute_kardex_daily", {
        p_unit_id: unitId!,
        p_ingredient_id: ingredientId!,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        date: row.day,
        opening_balance: Number(row.opening_balance),
        total_entry: Number(row.total_entry),
        total_sales: Number(row.total_sales),
        total_waste: Number(row.total_waste),
        theoretical_balance: Number(row.theoretical_balance),
        physical_count: row.physical_count != null ? Number(row.physical_count) : null,
        divergence: row.divergence != null ? Number(row.divergence) : null,
      })) as KardexDayRow[];
    },
    enabled: !!unitId && !!ingredientId && !!startDate && !!endDate,
  });

  return {
    positions,
    transactions: [],
    isLoading,
  };
}
