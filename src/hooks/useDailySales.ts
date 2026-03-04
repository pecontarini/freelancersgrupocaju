import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { fetchAllRows } from "@/lib/fetchAllRows";

export interface DailySale {
  id: string;
  sale_date: string;
  item_name: string;
  quantity: number;
  total_amount: number;
  unit_id: string;
  created_at: string;
  updated_at: string;
}

export interface ParseFailure {
  line: number;
  rawData: string;
  reason: string;
}

export interface ParsedSaleResult {
  rows: ParsedSaleRow[];
  failures: ParseFailure[];
  totalLines: number;
}

export interface SalesImportResult {
  dateRange: { start: string; end: string };
  inserted: number;
  updated: number;
  total: number;
  failures: ParseFailure[];
  totalFileLines: number;
  dbErrors: ParseFailure[];
}

export interface ParsedSaleRow {
  sale_date: string;
  item_name: string;
  quantity: number;
  total_amount: number;
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
  if (value === null || value === undefined || value === "") return 0;
  
  if (typeof value === "number") {
    return value;
  }
  
  const strValue = String(value).trim().replace(",", ".");
  const num = parseFloat(strValue);
  
  return isNaN(num) ? null : num;
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
export function parseExcelSales(buffer: ArrayBuffer): ParsedSaleResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Arquivo Excel vazio");
  
  const sheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(sheet, { 
    header: 1,
    raw: true,
    defval: null
  }) as unknown[][];
  
  if (jsonData.length < 2) {
    throw new Error("Arquivo Excel deve ter pelo menos uma linha de cabeçalho e uma de dados");
  }
  
  const headers = (jsonData[0] || []).map(h => String(h || ""));
  
  const dateIndex = findColumnIndex(headers, "dt_contabil", "dtcontabil", "data", "date");
  const itemIndex = findColumnIndex(headers, "material_descr", "materialdescr", "descr", "item", "produto", "material");
  const qtyIndex = findColumnIndex(headers, "qtd", "quantidade", "qty", "quantity");
  const amountIndex = findColumnIndex(headers, "vl_tot", "vltot", "valor_total", "valortotal", "total", "amount");
  
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
  const failures: ParseFailure[] = [];
  const totalLines = jsonData.length - 1; // exclude header
  
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) continue;
    
    const rawDate = row[dateIndex];
    const rawItem = row[itemIndex];
    const rawQty = row[qtyIndex];
    const rawAmount = amountIndex !== -1 ? row[amountIndex] : 0;
    const rawDataStr = `Data=${String(rawDate ?? "")}, Item=${String(rawItem ?? "")}, Qtd=${String(rawQty ?? "")}, Valor=${String(rawAmount ?? "")}`;
    
    const itemName = rawItem ? String(rawItem).toUpperCase().trim() : null;
    
    if (!itemName) {
      failures.push({ line: i + 1, rawData: rawDataStr, reason: "Nome do item vazio" });
      continue;
    }
    
    const saleDate = parseDate(rawDate);
    if (!saleDate) {
      failures.push({ line: i + 1, rawData: rawDataStr, reason: "Data inválida ou ausente" });
      continue;
    }
    
    const qty = parseQuantity(rawQty);
    if (qty === null) {
      failures.push({ line: i + 1, rawData: rawDataStr, reason: "Quantidade não numérica" });
      continue;
    }
    
    const totalAmount = parseQuantity(rawAmount) ?? 0;
    
    rows.push({
      sale_date: saleDate,
      item_name: itemName,
      quantity: qty,
      total_amount: totalAmount,
    });
  }
  
  return { rows, failures, totalLines };
}

/**
 * Parse CSV content from sales report
 * Expected columns: dt_contabil, material_descr, qtd
 */
export function parseCSVSales(csvContent: string): ParsedSaleResult {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { rows: [], failures: [], totalLines: 0 };

  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";
  const headers = headerLine.split(separator).map(h => h.trim().replace(/"/g, ""));

  const dateIndex = findColumnIndex(headers, "dt_contabil", "data", "date");
  const itemIndex = findColumnIndex(headers, "material_descr", "descr", "item", "produto");
  const qtyIndex = findColumnIndex(headers, "qtd", "quantidade", "qty");
  const amountIndex = findColumnIndex(headers, "vl_tot", "vltot", "valor_total", "valortotal", "total", "amount");

  if (dateIndex === -1 || itemIndex === -1 || qtyIndex === -1) {
    throw new Error(
      `Colunas obrigatórias não encontradas. Esperado: dt_contabil, material_descr, qtd. ` +
      `Encontrado: ${headers.join(", ")}`
    );
  }

  const rows: ParsedSaleRow[] = [];
  const failures: ParseFailure[] = [];
  const totalLines = lines.length - 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = line.split(separator).map(v => v.trim().replace(/"/g, ""));
    
    const rawDate = values[dateIndex];
    const rawItem = values[itemIndex];
    const rawQty = values[qtyIndex];
    const rawAmount = amountIndex !== -1 ? values[amountIndex] : "0";
    const rawDataStr = `Data=${rawDate ?? ""}, Item=${rawItem ?? ""}, Qtd=${rawQty ?? ""}`;

    const itemName = rawItem ? rawItem.toUpperCase().trim() : null;
    
    if (!itemName) {
      failures.push({ line: i + 1, rawData: rawDataStr, reason: "Nome do item vazio" });
      continue;
    }

    const saleDate = parseDate(rawDate);
    if (!saleDate) {
      failures.push({ line: i + 1, rawData: rawDataStr, reason: "Data inválida ou ausente" });
      continue;
    }

    const qty = parseQuantity(rawQty);
    if (qty === null) {
      failures.push({ line: i + 1, rawData: rawDataStr, reason: "Quantidade não numérica" });
      continue;
    }

    const totalAmount = parseQuantity(rawAmount) ?? 0;

    rows.push({
      sale_date: saleDate,
      item_name: itemName,
      quantity: qty,
      total_amount: totalAmount,
    });
  }

  return { rows, failures, totalLines };
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
      existing.total_amount += row.total_amount;
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

      return fetchAllRows<DailySale>(() => {
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

        return query;
      });
    },
    enabled: !!unitId,
  });

  const importSales = useMutation({
    mutationFn: async ({
      unitId,
      rows,
      parseFailures = [],
      totalFileLines = 0,
    }: {
      unitId: string;
      rows: ParsedSaleRow[];
      parseFailures?: ParseFailure[];
      totalFileLines?: number;
    }): Promise<SalesImportResult> => {
      const aggregated = aggregateSales(rows);
      const dbErrors: ParseFailure[] = [];

      if (aggregated.length === 0) {
        return {
          dateRange: { start: "", end: "" },
          inserted: 0,
          updated: 0,
          total: 0,
          failures: parseFailures,
          totalFileLines,
          dbErrors,
        };
      }

      const dates = aggregated.map(r => r.sale_date).sort();
      const dateRange = {
        start: dates[0],
        end: dates[dates.length - 1],
      };

      const { data: existing, error: fetchError } = await supabase
        .from("daily_sales")
        .select("id, sale_date, item_name")
        .eq("unit_id", unitId)
        .gte("sale_date", dateRange.start)
        .lte("sale_date", dateRange.end);

      if (fetchError) throw fetchError;

      const existingKeys = new Set(
        (existing || []).map(e => `${e.sale_date}|${e.item_name}`)
      );
      const existingMap = new Map(
        (existing || []).map(e => [`${e.sale_date}|${e.item_name}`, e.id])
      );

      const toInsert: Array<{
        sale_date: string;
        item_name: string;
        quantity: number;
        total_amount: number;
        unit_id: string;
      }> = [];
      const toUpdate: Array<{
        id: string;
        quantity: number;
        total_amount: number;
        item_name: string;
        sale_date: string;
      }> = [];

      for (const row of aggregated) {
        const key = `${row.sale_date}|${row.item_name}`;
        if (existingKeys.has(key)) {
          toUpdate.push({
            id: existingMap.get(key)!,
            quantity: row.quantity,
            total_amount: row.total_amount,
            item_name: row.item_name,
            sale_date: row.sale_date,
          });
        } else {
          toInsert.push({
            sale_date: row.sale_date,
            item_name: row.item_name,
            quantity: row.quantity,
            total_amount: row.total_amount,
            unit_id: unitId,
          });
        }
      }

      let insertedCount = 0;

      // Perform inserts in batches — capture errors per batch
      if (toInsert.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from("daily_sales")
            .insert(batch);
          if (insertError) {
            for (const item of batch) {
              dbErrors.push({
                line: 0,
                rawData: `Data=${item.sale_date}, Item=${item.item_name}, Qtd=${item.quantity}`,
                reason: `Erro DB INSERT: ${insertError.message}`,
              });
            }
          } else {
            insertedCount += batch.length;
          }
        }
      }

      let updatedCount = 0;

      // Perform updates — capture errors individually
      for (const update of toUpdate) {
        const { error: updateError } = await supabase
          .from("daily_sales")
          .update({ quantity: update.quantity, total_amount: update.total_amount } as any)
          .eq("id", update.id);
        if (updateError) {
          dbErrors.push({
            line: 0,
            rawData: `Data=${update.sale_date}, Item=${update.item_name}, Qtd=${update.quantity}`,
            reason: `Erro DB UPDATE: ${updateError.message}`,
          });
        } else {
          updatedCount++;
        }
      }

      return {
        dateRange,
        inserted: insertedCount,
        updated: updatedCount,
        total: aggregated.length,
        failures: parseFailures,
        totalFileLines,
        dbErrors,
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
