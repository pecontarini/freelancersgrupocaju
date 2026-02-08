import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
 * Convert Excel serial date to YYYY-MM-DD string
 * Excel dates are days since 1899-12-30 (with a bug for 1900 leap year)
 */
function excelSerialToDate(serial: number): string {
  // Excel incorrectly considers 1900 as a leap year, so we adjust
  const utcDays = Math.floor(serial - 25569); // Days since 1970-01-01
  const utcValue = utcDays * 86400 * 1000;
  const date = new Date(utcValue);
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}

/**
 * Parse date from various formats (string DD/MM/YYYY, YYYY-MM-DD, or Excel serial)
 */
function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  // If it's a number (Excel serial date)
  if (typeof value === "number") {
    if (value > 25000 && value < 60000) { // Reasonable date range (1968-2064)
      return excelSerialToDate(value);
    }
    return null;
  }

  // If it's a Date object
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // If it's a string
  const strValue = String(value).trim();
  if (!strValue) return null;

  // Handle DD/MM/YYYY
  if (strValue.includes("/")) {
    const parts = strValue.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  // Handle YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(strValue)) {
    return strValue.substring(0, 10);
  }

  return null;
}

/**
 * Parse quantity from various formats
 */
function parseQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  
  if (typeof value === "number") {
    return value === 0 ? null : value;
  }
  
  const strValue = String(value).trim().replace(",", ".");
  const num = parseFloat(strValue);
  
  return isNaN(num) || num === 0 ? null : num;
}

/**
 * Find column index by matching possible header names
 */
function findColumnIndex(headers: string[], ...patterns: string[]): number {
  const normalizedHeaders = headers.map(h => 
    String(h || "").toLowerCase().trim().replace(/[_\s]+/g, "")
  );
  
  for (const pattern of patterns) {
    const normalizedPattern = pattern.toLowerCase().replace(/[_\s]+/g, "");
    const index = normalizedHeaders.findIndex(h => h.includes(normalizedPattern));
    if (index !== -1) return index;
  }
  
  return -1;
}

/**
 * Parse Excel file (.xlsx, .xls) from ArrayBuffer
 */
export function parseExcelSales(buffer: ArrayBuffer): ParsedSaleRow[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Arquivo Excel vazio");
  
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header row as array of arrays
  const jsonData = XLSX.utils.sheet_to_json(sheet, { 
    header: 1,
    raw: true,
    defval: null
  }) as unknown[][];
  
  if (jsonData.length < 2) {
    throw new Error("Arquivo Excel deve ter pelo menos uma linha de cabeçalho e uma de dados");
  }
  
  // First row is headers
  const headers = (jsonData[0] || []).map(h => String(h || ""));
  
  // Find column indices
  const dateIndex = findColumnIndex(headers, "dt_contabil", "dtcontabil", "data", "date");
  const itemIndex = findColumnIndex(headers, "material_descr", "materialdescr", "descr", "item", "produto", "material");
  const qtyIndex = findColumnIndex(headers, "qtd", "quantidade", "qty", "quantity");
  
  if (dateIndex === -1) {
    throw new Error(`Coluna de data não encontrada. Esperado: dt_contabil. Colunas: ${headers.join(", ")}`);
  }
  if (itemIndex === -1) {
    throw new Error(`Coluna de item não encontrada. Esperado: material_descr. Colunas: ${headers.join(", ")}`);
  }
  if (qtyIndex === -1) {
    throw new Error(`Coluna de quantidade não encontrada. Esperado: qtd. Colunas: ${headers.join(", ")}`);
  }
  
  const rows: ParsedSaleRow[] = [];
  
  // Process data rows (skip header)
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;
    
    const rawDate = row[dateIndex];
    const rawItem = row[itemIndex];
    const rawQty = row[qtyIndex];
    
    const saleDate = parseDate(rawDate);
    const qty = parseQuantity(rawQty);
    const itemName = rawItem ? String(rawItem).toUpperCase().trim() : null;
    
    // Skip invalid rows (missing data or zero quantity)
    if (!saleDate || !itemName || qty === null) continue;
    
    rows.push({
      sale_date: saleDate,
      item_name: itemName,
      quantity: qty,
    });
  }
  
  return rows;
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
  const headers = headerLine.split(separator).map(h => h.trim().replace(/"/g, ""));

  const dateIndex = findColumnIndex(headers, "dt_contabil", "data", "date");
  const itemIndex = findColumnIndex(headers, "material_descr", "descr", "item", "produto");
  const qtyIndex = findColumnIndex(headers, "qtd", "quantidade", "qty");

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
    const rawItem = values[itemIndex];
    const rawQty = values[qtyIndex];

    const saleDate = parseDate(rawDate);
    const qty = parseQuantity(rawQty);
    const itemName = rawItem ? rawItem.toUpperCase().trim() : null;
    
    if (!saleDate || !itemName || qty === null) continue;

    rows.push({
      sale_date: saleDate,
      item_name: itemName,
      quantity: qty,
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
