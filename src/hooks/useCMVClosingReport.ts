import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface WasteEntry {
  ingredientId: string;
  ingredientName: string;
  categoria: string;
  totalQuantity: number;
  totalCost: number;
  mainReason: string;
  entries: Array<{
    date: string;
    quantity: number;
    notes: string | null;
  }>;
}

export interface CMVClosingSummary {
  // Financial CMV
  estoqueInicialValue: number;
  comprasValue: number;
  estoqueFinalValue: number;
  cmvFinanceiroValue: number;
  cmvFinanceiroPercent: number;
  // Theoretical CMV
  cmvTeoricoValue: number;
  cmvTeoricoPercent: number;
  // Gap
  gapValue: number;
  gapPercent: number;
  // Waste
  totalWasteValue: number;
  totalWasteQty: number;
  wasteRanking: WasteEntry[];
  // Revenue (from daily_sales total_amount)
  faturamento: number;
}

export function useCMVClosingReport(
  unitId: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined
) {
  // 1. Fetch audit period data (contagens + purchases + sales consumption)
  const { data: auditData = [], isLoading: isLoadingAudit } = useQuery({
    queryKey: ["cmv-closing-audit", unitId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_audit_period", {
        p_loja_id: unitId!,
        p_start_date: startDate!,
        p_end_date: endDate!,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!unitId && !!startDate && !!endDate,
  });

  // 2. Fetch waste transactions from inventory_transactions
  const { data: wasteTransactions = [], isLoading: isLoadingWaste } = useQuery({
    queryKey: ["cmv-waste-transactions", unitId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("*, ingredient:cmv_items(nome, categoria, preco_custo_atual)")
        .eq("unit_id", unitId!)
        .eq("transaction_type", "waste")
        .gte("date", `${startDate}T00:00:00`)
        .lte("date", `${endDate}T23:59:59`)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!unitId && !!startDate && !!endDate,
  });

  // 3. Fetch revenue from daily_sales
  const { data: salesRevenue = [], isLoading: isLoadingRevenue } = useQuery({
    queryKey: ["cmv-closing-revenue", unitId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_sales")
        .select("total_amount")
        .eq("unit_id", unitId!)
        .gte("sale_date", startDate!)
        .lte("sale_date", endDate!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!unitId && !!startDate && !!endDate,
  });

  const summary = useMemo((): CMVClosingSummary | null => {
    if (!unitId || !startDate || !endDate || auditData.length === 0) return null;

    const faturamento = salesRevenue.reduce(
      (sum, s) => sum + (Number(s.total_amount) || 0),
      0
    );

    // Financial CMV = (Estoque Inicial + Compras - Estoque Final)
    let estoqueInicialValue = 0;
    let comprasValue = 0;
    let estoqueFinalValue = 0;
    let cmvTeoricoValue = 0;

    auditData.forEach((row: any) => {
      const initialStock = Number(row.initial_stock);
      const initialCost = Number(row.initial_cost);
      const purchases = Number(row.purchases_qty);
      const finalStock = Number(row.real_final_stock);
      const finalCost = Number(row.final_cost);
      const salesConsumption = Number(row.sales_consumption);

      estoqueInicialValue += initialStock * initialCost;
      comprasValue += purchases * initialCost;
      estoqueFinalValue += finalStock * finalCost;
      // Theoretical CMV = sum of (sales_consumption * cost)
      cmvTeoricoValue += salesConsumption * initialCost;
    });

    const cmvFinanceiroValue = estoqueInicialValue + comprasValue - estoqueFinalValue;
    const cmvFinanceiroPercent = faturamento > 0 ? (cmvFinanceiroValue / faturamento) * 100 : 0;
    const cmvTeoricoPercent = faturamento > 0 ? (cmvTeoricoValue / faturamento) * 100 : 0;
    const gapValue = cmvFinanceiroValue - cmvTeoricoValue;
    const gapPercent = cmvFinanceiroPercent - cmvTeoricoPercent;

    // Build waste ranking
    const wasteMap = new Map<string, WasteEntry>();

    wasteTransactions.forEach((tx: any) => {
      const ingredientId = tx.ingredient_id;
      const ingredient = tx.ingredient;
      const qty = Math.abs(Number(tx.quantity));
      const cost = qty * (ingredient?.preco_custo_atual || 0);

      if (!wasteMap.has(ingredientId)) {
        wasteMap.set(ingredientId, {
          ingredientId,
          ingredientName: ingredient?.nome || "Desconhecido",
          categoria: ingredient?.categoria || "Sem categoria",
          totalQuantity: 0,
          totalCost: 0,
          mainReason: "",
          entries: [],
        });
      }

      const entry = wasteMap.get(ingredientId)!;
      entry.totalQuantity += qty;
      entry.totalCost += cost;
      entry.entries.push({
        date: tx.date,
        quantity: qty,
        notes: tx.notes,
      });
    });

    // Determine main reason per ingredient
    wasteMap.forEach((entry) => {
      const reasonCounts = new Map<string, number>();
      entry.entries.forEach((e) => {
        const reason = e.notes || "Não informado";
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      });
      let maxCount = 0;
      let mainReason = "Não informado";
      reasonCounts.forEach((count, reason) => {
        if (count > maxCount) {
          maxCount = count;
          mainReason = reason;
        }
      });
      entry.mainReason = mainReason;
    });

    const wasteRanking = Array.from(wasteMap.values()).sort(
      (a, b) => b.totalCost - a.totalCost
    );

    const totalWasteValue = wasteRanking.reduce((s, w) => s + w.totalCost, 0);
    const totalWasteQty = wasteRanking.reduce((s, w) => s + w.totalQuantity, 0);

    return {
      estoqueInicialValue,
      comprasValue,
      estoqueFinalValue,
      cmvFinanceiroValue,
      cmvFinanceiroPercent,
      cmvTeoricoValue,
      cmvTeoricoPercent,
      gapValue,
      gapPercent,
      totalWasteValue,
      totalWasteQty,
      wasteRanking,
      faturamento,
    };
  }, [auditData, wasteTransactions, salesRevenue, unitId, startDate, endDate]);

  return {
    summary,
    isLoading: isLoadingAudit || isLoadingWaste || isLoadingRevenue,
  };
}
