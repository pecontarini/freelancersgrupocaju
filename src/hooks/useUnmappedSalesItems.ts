import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export interface UnmappedSalesItem {
  item_name: string;
  total_quantity: number;
  first_seen: string;
  last_seen: string;
  days_count: number;
  is_new: boolean; // Seen in last 7 days
}

/**
 * Find sales items that don't have a mapping to inventory items
 * Excludes: already mapped items and ignored items
 */
export function useUnmappedSalesItems(unitId?: string) {
  return useQuery({
    queryKey: ["unmapped-sales-items", unitId],
    queryFn: async () => {
      // Get all existing mappings (normalized names)
      const { data: mappings, error: mappingsError } = await supabase
        .from("cmv_sales_mappings")
        .select("nome_venda");

      if (mappingsError) throw mappingsError;

      const mappedNames = new Set(
        (mappings || []).map(m => m.nome_venda.toUpperCase().trim())
      );

      // Get all ignored items
      const { data: ignoredItems, error: ignoredError } = await supabase
        .from("cmv_ignored_items")
        .select("item_name");

      if (ignoredError) throw ignoredError;

      const ignoredNames = new Set(
        (ignoredItems || []).map(i => i.item_name.toUpperCase().trim())
      );

      // Get all unique sales items from daily_sales
      let query = supabase
        .from("daily_sales")
        .select("item_name, quantity, sale_date");

      if (unitId) {
        query = query.eq("unit_id", unitId);
      }

      const { data: sales, error: salesError } = await query;
      if (salesError) throw salesError;

      // Aggregate sales by item_name
      const itemsMap = new Map<string, {
        total_quantity: number;
        first_seen: string;
        last_seen: string;
        dates: Set<string>;
      }>();

      for (const sale of sales || []) {
        const name = sale.item_name.toUpperCase().trim();
        
        // Skip if already mapped OR ignored
        if (mappedNames.has(name) || ignoredNames.has(name)) continue;

        const existing = itemsMap.get(name);
        if (existing) {
          existing.total_quantity += Number(sale.quantity);
          existing.dates.add(sale.sale_date);
          if (sale.sale_date < existing.first_seen) {
            existing.first_seen = sale.sale_date;
          }
          if (sale.sale_date > existing.last_seen) {
            existing.last_seen = sale.sale_date;
          }
        } else {
          itemsMap.set(name, {
            total_quantity: Number(sale.quantity),
            first_seen: sale.sale_date,
            last_seen: sale.sale_date,
            dates: new Set([sale.sale_date]),
          });
        }
      }

      // Convert to array and determine if "new"
      const sevenDaysAgo = subDays(new Date(), 7).toISOString().split("T")[0];

      const unmappedItems: UnmappedSalesItem[] = Array.from(itemsMap.entries())
        .map(([name, data]) => ({
          item_name: name,
          total_quantity: data.total_quantity,
          first_seen: data.first_seen,
          last_seen: data.last_seen,
          days_count: data.dates.size,
          is_new: data.first_seen >= sevenDaysAgo,
        }))
        .sort((a, b) => {
          // New items first, then by total quantity
          if (a.is_new !== b.is_new) return a.is_new ? -1 : 1;
          return b.total_quantity - a.total_quantity;
        });

      return unmappedItems;
    },
    enabled: true,
  });
}
