import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays } from "date-fns";

export type SalesItemStatus = "pending" | "linked" | "ignored";

export interface SalesItemWithStatus {
  item_name: string;
  total_quantity: number;
  first_seen: string;
  last_seen: string;
  days_count: number;
  is_new: boolean;
  status: SalesItemStatus;
  /** For linked items: the inventory item name */
  linked_to?: string;
  /** For linked items: multiplier */
  multiplier?: number;
  /** For linked items: is_global flag */
  is_global?: boolean;
}

export interface CoverageStats {
  total: number;
  linked: number;
  pending: number;
  ignored: number;
  linkedPercent: number;
  pendingPercent: number;
  ignoredPercent: number;
}

/**
 * Fetch ALL unique sales items from daily_sales with their mapping status.
 * Used for the "Pente Fino" review mode.
 */
export function useAllSalesItems(unitId?: string) {
  return useQuery({
    queryKey: ["all-sales-items", unitId],
    queryFn: async () => {
      // Fetch mappings, ignored items, and sales in parallel
      const [mappingsRes, ignoredRes, salesRes, inventoryRes] = await Promise.all([
        supabase.from("cmv_sales_mappings").select("nome_venda, cmv_item_id, multiplicador, is_global"),
        supabase.from("cmv_ignored_items").select("item_name"),
        unitId
          ? supabase.from("daily_sales").select("item_name, quantity, sale_date").eq("unit_id", unitId)
          : supabase.from("daily_sales").select("item_name, quantity, sale_date"),
        supabase.from("cmv_items").select("id, nome"),
      ]);

      if (mappingsRes.error) throw mappingsRes.error;
      if (ignoredRes.error) throw ignoredRes.error;
      if (salesRes.error) throw salesRes.error;
      if (inventoryRes.error) throw inventoryRes.error;

      // Build lookup maps
      const mappingsMap = new Map<string, { cmv_item_id: string; multiplicador: number; is_global: boolean }>();
      for (const m of mappingsRes.data || []) {
        mappingsMap.set(m.nome_venda.toUpperCase().trim(), {
          cmv_item_id: m.cmv_item_id,
          multiplicador: m.multiplicador,
          is_global: m.is_global,
        });
      }

      const ignoredSet = new Set(
        (ignoredRes.data || []).map(i => i.item_name.toUpperCase().trim())
      );

      const inventoryMap = new Map<string, string>();
      for (const item of inventoryRes.data || []) {
        inventoryMap.set(item.id, item.nome);
      }

      // Aggregate sales by item_name
      const itemsMap = new Map<string, {
        total_quantity: number;
        first_seen: string;
        last_seen: string;
        dates: Set<string>;
      }>();

      for (const sale of salesRes.data || []) {
        const name = sale.item_name.toUpperCase().trim();
        const existing = itemsMap.get(name);
        if (existing) {
          existing.total_quantity += Number(sale.quantity);
          existing.dates.add(sale.sale_date);
          if (sale.sale_date < existing.first_seen) existing.first_seen = sale.sale_date;
          if (sale.sale_date > existing.last_seen) existing.last_seen = sale.sale_date;
        } else {
          itemsMap.set(name, {
            total_quantity: Number(sale.quantity),
            first_seen: sale.sale_date,
            last_seen: sale.sale_date,
            dates: new Set([sale.sale_date]),
          });
        }
      }

      const sevenDaysAgo = subDays(new Date(), 7).toISOString().split("T")[0];

      const allItems: SalesItemWithStatus[] = Array.from(itemsMap.entries())
        .map(([name, data]) => {
          const mapping = mappingsMap.get(name);
          const isIgnored = ignoredSet.has(name);

          let status: SalesItemStatus = "pending";
          if (mapping) status = "linked";
          else if (isIgnored) status = "ignored";

          return {
            item_name: name,
            total_quantity: data.total_quantity,
            first_seen: data.first_seen,
            last_seen: data.last_seen,
            days_count: data.dates.size,
            is_new: data.first_seen >= sevenDaysAgo,
            status,
            linked_to: mapping ? inventoryMap.get(mapping.cmv_item_id) : undefined,
            multiplier: mapping?.multiplicador,
            is_global: mapping?.is_global,
          };
        })
        .sort((a, b) => {
          if (a.is_new !== b.is_new) return a.is_new ? -1 : 1;
          return b.total_quantity - a.total_quantity;
        });

      // Coverage stats
      const total = allItems.length;
      const linked = allItems.filter(i => i.status === "linked").length;
      const pending = allItems.filter(i => i.status === "pending").length;
      const ignored = allItems.filter(i => i.status === "ignored").length;

      const stats: CoverageStats = {
        total,
        linked,
        pending,
        ignored,
        linkedPercent: total > 0 ? Math.round((linked / total) * 100) : 0,
        pendingPercent: total > 0 ? Math.round((pending / total) * 100) : 0,
        ignoredPercent: total > 0 ? Math.round((ignored / total) * 100) : 0,
      };

      return { items: allItems, stats };
    },
    enabled: true,
  });
}
