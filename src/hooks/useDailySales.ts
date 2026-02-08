import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DailySale {
  id: string;
  sale_date: string;
  item_name: string;
  quantity: number;
  unit_id: string;
  created_at: string;
  updated_at: string;
}

export interface SalesImportResult {
  dateRange: { start: string; end: string };
  inserted: number;
  updated: number;
  total: number;
}

export interface ParsedSaleRow {
  sale_date: string;
  item_name: string;
  quantity: number;
}

/**
 * Parse CSV content from sales report
 * Expected columns: dt_contabil, material_descr, qtd
 */
export function parseCSVSales(csvContent: string): ParsedSaleRow[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // Find header row and column indices
  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = headerLine.split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ""));

  const dateIndex = headers.findIndex(h => 
    h.includes("dt_contabil") || h.includes("data") || h.includes("date")
  );
  const itemIndex = headers.findIndex(h => 
    h.includes("material_descr") || h.includes("descr") || h.includes("item") || h.includes("produto")
  );
  const qtyIndex = headers.findIndex(h => 
    h.includes("qtd") || h.includes("quantidade") || h.includes("qty")
  );

  if (dateIndex === -1 || itemIndex === -1 || qtyIndex === -1) {
    throw new Error(
      `Colunas obrigatórias não encontradas. Esperado: dt_contabil, material_descr, qtd. ` +
      `Encontrado: ${headers.join(", ")}`
    );
  }

  const rows: ParsedSaleRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = line.split(separator).map(v => v.trim().replace(/"/g, ""));
    
    const rawDate = values[dateIndex];
    const itemName = values[itemIndex];
    const rawQty = values[qtyIndex];

    if (!rawDate || !itemName || !rawQty) continue;

    // Parse date (handle DD/MM/YYYY or YYYY-MM-DD)
    let saleDate: string;
    if (rawDate.includes("/")) {
      const [day, month, year] = rawDate.split("/");
      saleDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    } else {
      saleDate = rawDate;
    }

    // Parse quantity (handle comma as decimal separator)
    const quantity = parseFloat(rawQty.replace(",", "."));
    if (isNaN(quantity)) continue;

    rows.push({
      sale_date: saleDate,
      item_name: itemName.toUpperCase().trim(),
      quantity,
    });
  }

  return rows;
}

/**
 * Group sales by date + item and sum quantities
 */
export function aggregateSales(rows: ParsedSaleRow[]): ParsedSaleRow[] {
  const map = new Map<string, ParsedSaleRow>();

  for (const row of rows) {
    const key = `${row.sale_date}|${row.item_name}`;
    const existing = map.get(key);

    if (existing) {
      existing.quantity += row.quantity;
    } else {
      map.set(key, { ...row });
    }
  }

  return Array.from(map.values());
}

export function useDailySales(unitId?: string, startDate?: string, endDate?: string) {
  const queryClient = useQueryClient();

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["daily-sales", unitId, startDate, endDate],
    queryFn: async () => {
      if (!unitId) return [];

      let query = supabase
        .from("daily_sales")
        .select("*")
        .eq("unit_id", unitId)
        .order("sale_date", { ascending: false });

      if (startDate) {
        query = query.gte("sale_date", startDate);
      }
      if (endDate) {
        query = query.lte("sale_date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DailySale[];
    },
    enabled: !!unitId,
  });

  const importSales = useMutation({
    mutationFn: async ({
      unitId,
      rows,
    }: {
      unitId: string;
      rows: ParsedSaleRow[];
    }): Promise<SalesImportResult> => {
      // Aggregate sales first
      const aggregated = aggregateSales(rows);
      if (aggregated.length === 0) {
        throw new Error("Nenhum registro válido encontrado no arquivo");
      }

      // Get date range
      const dates = aggregated.map(r => r.sale_date).sort();
      const dateRange = {
        start: dates[0],
        end: dates[dates.length - 1],
      };

      // Check existing records for this date range
      const { data: existing, error: fetchError } = await supabase
        .from("daily_sales")
        .select("id, sale_date, item_name")
        .eq("unit_id", unitId)
        .gte("sale_date", dateRange.start)
        .lte("sale_date", dateRange.end);

      if (fetchError) throw fetchError;

      // Build a set of existing keys for quick lookup
      const existingKeys = new Set(
        (existing || []).map(e => `${e.sale_date}|${e.item_name}`)
      );
      const existingMap = new Map(
        (existing || []).map(e => [`${e.sale_date}|${e.item_name}`, e.id])
      );

      // Separate inserts and updates
      const toInsert: Array<{
        sale_date: string;
        item_name: string;
        quantity: number;
        unit_id: string;
      }> = [];
      const toUpdate: Array<{
        id: string;
        quantity: number;
      }> = [];

      for (const row of aggregated) {
        const key = `${row.sale_date}|${row.item_name}`;
        if (existingKeys.has(key)) {
          toUpdate.push({
            id: existingMap.get(key)!,
            quantity: row.quantity,
          });
        } else {
          toInsert.push({
            sale_date: row.sale_date,
            item_name: row.item_name,
            quantity: row.quantity,
            unit_id: unitId,
          });
        }
      }

      // Perform inserts in batches
      if (toInsert.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from("daily_sales")
            .insert(batch);
          if (insertError) throw insertError;
        }
      }

      // Perform updates in batches
      for (const update of toUpdate) {
        const { error: updateError } = await supabase
          .from("daily_sales")
          .update({ quantity: update.quantity })
          .eq("id", update.id);
        if (updateError) throw updateError;
      }

      return {
        dateRange,
        inserted: toInsert.length,
        updated: toUpdate.length,
        total: aggregated.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["daily-sales"] });
      toast.success(
        `Processado: vendas de ${formatDateBR(result.dateRange.start)} a ${formatDateBR(result.dateRange.end)}. ` +
        `${result.updated} registros atualizados, ${result.inserted} novos registros criados.`
      );
    },
    onError: (error: Error) => {
      toast.error(`Erro na importação: ${error.message}`);
    },
  });

  return { sales, isLoading, importSales };
}

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}
