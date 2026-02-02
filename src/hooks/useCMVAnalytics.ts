import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCMVItems, useCMVInventory, useCMVMovements } from "./useCMV";
import { useMemo } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface CMVReconciliation {
  itemId: string;
  itemName: string;
  categoria: string;
  precoCusto: number;
  estoqueInicial: number;
  entradasNfe: number;
  saidasVendas: number;
  estoqueEsperado: number;
  contagemReal: number;
  divergencia: number;
  prejuizo: number;
}

export interface CMVWeeklyAccuracy {
  week: string;
  weekLabel: string;
  accuracy: number;
  divergenciaTotal: number;
  itensConferidos: number;
}

export interface CMVDivergenceRanking {
  itemId: string;
  itemName: string;
  categoria: string;
  divergenciaUnidades: number;
  prejuizoReais: number;
  percentualDivergencia: number;
}

export function useCMVAnalytics(lojaId?: string) {
  const { items } = useCMVItems();
  const { inventory } = useCMVInventory(lojaId);
  const { movements } = useCMVMovements(lojaId);

  // Calculate reconciliation data
  const reconciliationData = useMemo(() => {
    if (!lojaId || items.length === 0) return [];

    const reconciliations: CMVReconciliation[] = [];

    items.filter(i => i.ativo).forEach(item => {
      const itemMovements = movements.filter(m => m.cmv_item_id === item.id);
      const itemInventory = inventory.find(inv => inv.cmv_item_id === item.id);

      // Calculate entries (NFe)
      const entradasNfe = itemMovements
        .filter(m => m.tipo_movimento === "entrada")
        .reduce((sum, m) => sum + m.quantidade, 0);

      // Calculate exits (sales)
      const saidasVendas = itemMovements
        .filter(m => m.tipo_movimento === "saida")
        .reduce((sum, m) => sum + m.quantidade, 0);

      // Get inventory adjustments (initial count)
      const inventarioAjustes = itemMovements
        .filter(m => m.tipo_movimento === "inventario")
        .reduce((sum, m) => sum + m.quantidade, 0);

      // Initial stock = first inventory count or 0
      const estoqueInicial = inventarioAjustes;

      // Expected stock = Initial + Entries - Sales
      const estoqueEsperado = estoqueInicial + entradasNfe - saidasVendas;

      // Real count from inventory table
      const contagemReal = itemInventory?.quantidade_atual || 0;

      // Divergence = Expected - Real (positive = missing stock)
      const divergencia = estoqueEsperado - contagemReal;

      // Loss = Divergence * Cost Price
      const prejuizo = Math.max(0, divergencia) * item.preco_custo_atual;

      reconciliations.push({
        itemId: item.id,
        itemName: item.nome,
        categoria: item.categoria || "Sem categoria",
        precoCusto: item.preco_custo_atual,
        estoqueInicial,
        entradasNfe,
        saidasVendas,
        estoqueEsperado,
        contagemReal,
        divergencia,
        prejuizo,
      });
    });

    return reconciliations;
  }, [items, inventory, movements, lojaId]);

  // Calculate total loss
  const totalPrejuizo = useMemo(() => {
    return reconciliationData.reduce((sum, r) => sum + r.prejuizo, 0);
  }, [reconciliationData]);

  // Top divergent items ranking
  const divergenceRanking = useMemo((): CMVDivergenceRanking[] => {
    return reconciliationData
      .filter(r => r.divergencia > 0)
      .map(r => ({
        itemId: r.itemId,
        itemName: r.itemName,
        categoria: r.categoria,
        divergenciaUnidades: r.divergencia,
        prejuizoReais: r.prejuizo,
        percentualDivergencia: r.estoqueEsperado > 0 
          ? (r.divergencia / r.estoqueEsperado) * 100 
          : 0,
      }))
      .sort((a, b) => b.prejuizoReais - a.prejuizoReais)
      .slice(0, 10);
  }, [reconciliationData]);

  // Weekly accuracy evolution (last 8 weeks)
  const weeklyAccuracy = useMemo((): CMVWeeklyAccuracy[] => {
    const weeks: CMVWeeklyAccuracy[] = [];
    const now = new Date();

    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { locale: ptBR });
      const weekEnd = endOfWeek(subWeeks(now, i), { locale: ptBR });
      const weekKey = format(weekStart, "yyyy-'W'ww");
      const weekLabel = format(weekStart, "dd/MM", { locale: ptBR });

      // Filter movements for this week
      const weekMovements = movements.filter(m => {
        const moveDate = parseISO(m.data_movimento);
        return moveDate >= weekStart && moveDate <= weekEnd;
      });

      // Calculate expected vs actual for the week
      let totalExpected = 0;
      let totalActual = 0;
      let itemsChecked = 0;

      items.filter(i => i.ativo).forEach(item => {
        const itemWeekMovements = weekMovements.filter(m => m.cmv_item_id === item.id);
        if (itemWeekMovements.length > 0) {
          const entries = itemWeekMovements
            .filter(m => m.tipo_movimento === "entrada")
            .reduce((sum, m) => sum + m.quantidade, 0);
          const exits = itemWeekMovements
            .filter(m => m.tipo_movimento === "saida")
            .reduce((sum, m) => sum + m.quantidade, 0);
          
          const inv = inventory.find(inv => inv.cmv_item_id === item.id);
          if (inv) {
            totalExpected += entries - exits;
            totalActual += inv.quantidade_atual;
            itemsChecked++;
          }
        }
      });

      const accuracy = totalExpected !== 0 
        ? Math.max(0, Math.min(100, (1 - Math.abs(totalExpected - totalActual) / Math.abs(totalExpected)) * 100))
        : 100;

      weeks.push({
        week: weekKey,
        weekLabel,
        accuracy: Math.round(accuracy * 10) / 10,
        divergenciaTotal: Math.abs(totalExpected - totalActual),
        itensConferidos: itemsChecked,
      });
    }

    return weeks;
  }, [movements, items, inventory]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const itemsWithDivergence = reconciliationData.filter(r => r.divergencia > 0).length;
    const totalItems = reconciliationData.length;
    const accuracyRate = totalItems > 0 
      ? ((totalItems - itemsWithDivergence) / totalItems) * 100 
      : 100;

    const latestWeek = weeklyAccuracy[weeklyAccuracy.length - 1];
    const previousWeek = weeklyAccuracy[weeklyAccuracy.length - 2];
    const accuracyTrend = latestWeek && previousWeek 
      ? latestWeek.accuracy - previousWeek.accuracy 
      : 0;

    return {
      totalPrejuizo,
      itemsWithDivergence,
      totalItems,
      accuracyRate: Math.round(accuracyRate * 10) / 10,
      accuracyTrend: Math.round(accuracyTrend * 10) / 10,
    };
  }, [reconciliationData, weeklyAccuracy, totalPrejuizo]);

  return {
    reconciliationData,
    totalPrejuizo,
    divergenceRanking,
    weeklyAccuracy,
    summaryStats,
    isLoading: false,
  };
}

// Hook to fetch movements with NFe references for reports
export function useCMVEntriesReport(lojaId?: string) {
  return useQuery({
    queryKey: ["cmv-entries-report", lojaId],
    queryFn: async () => {
      if (!lojaId) return [];

      const { data, error } = await supabase
        .from("cmv_movements")
        .select(`
          *,
          cmv_item:cmv_items(nome, categoria, unidade)
        `)
        .eq("loja_id", lojaId)
        .eq("tipo_movimento", "entrada")
        .order("data_movimento", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!lojaId,
  });
}

// Hook to fetch daily sales movements
export function useCMVSalesReport(lojaId?: string) {
  return useQuery({
    queryKey: ["cmv-sales-report", lojaId],
    queryFn: async () => {
      if (!lojaId) return [];

      const { data, error } = await supabase
        .from("cmv_movements")
        .select(`
          *,
          cmv_item:cmv_items(nome, categoria, unidade)
        `)
        .eq("loja_id", lojaId)
        .eq("tipo_movimento", "saida")
        .order("data_movimento", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!lojaId,
  });
}
