import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useMemo } from "react";
import type { CamaraEntry, PracaEntry, SemanaCMV } from "./useCMVSemanas";
import { DIAS } from "./useCMVSemanas";

export type VendasAjusteEntry = {
  id: string;
  semana_id: string;
  cmv_item_id: string;
  dia: string;
  quantidade_manual: number | null;
  notas: string | null;
};

type SalesMapping = {
  cmv_item_id: string;
  nome_venda: string;
  multiplicador: number;
};

type DailySale = {
  item_name: string;
  quantity: number;
  sale_date: string;
};

type CMVItem = { id: string; nome: string; unidade: string };

/** Map date to day-of-week label (SEG..DOM) */
function dateToDia(dateStr: string): string | null {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0=Sun
  const map: Record<number, string> = { 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB", 0: "DOM" };
  return map[day] ?? null;
}

export function useVendasAjuste(semanaId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["cmv_vendas_ajuste", semanaId],
    queryFn: async () => {
      if (!semanaId) return [];
      const { data, error } = await supabase
        .from("cmv_vendas_ajuste")
        .select("*")
        .eq("semana_id", semanaId);
      if (error) throw error;
      return (data || []) as VendasAjusteEntry[];
    },
    enabled: !!semanaId,
  });

  const upsert = useMutation({
    mutationFn: async (params: {
      semana_id: string;
      cmv_item_id: string;
      dia: string;
      quantidade_manual?: number | null;
      notas?: string | null;
    }) => {
      const { data: existing } = await supabase
        .from("cmv_vendas_ajuste")
        .select("*")
        .eq("semana_id", params.semana_id)
        .eq("cmv_item_id", params.cmv_item_id)
        .eq("dia", params.dia)
        .maybeSingle();

      const merged = {
        semana_id: params.semana_id,
        cmv_item_id: params.cmv_item_id,
        dia: params.dia,
        quantidade_manual: params.quantidade_manual !== undefined ? params.quantidade_manual : existing?.quantidade_manual ?? null,
        notas: params.notas !== undefined ? params.notas : existing?.notas ?? null,
      };

      const { data, error } = await supabase
        .from("cmv_vendas_ajuste")
        .upsert(merged, { onConflict: "semana_id,cmv_item_id,dia" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cmv_vendas_ajuste", semanaId] }),
  });

  return { ...query, entries: query.data || [], upsert };
}

export function useSalesMappings() {
  return useQuery<SalesMapping[]>({
    queryKey: ["cmv_sales_mappings_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cmv_sales_mappings")
        .select("cmv_item_id, nome_venda, multiplicador");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useWeeklySales(dataInicio: string | undefined, dataFim: string | undefined) {
  const { effectiveUnidadeId } = useUnidade();

  return useQuery<DailySale[]>({
    queryKey: ["daily_sales_week", effectiveUnidadeId, dataInicio, dataFim],
    queryFn: async () => {
      if (!effectiveUnidadeId || !dataInicio || !dataFim) return [];
      const { data, error } = await supabase
        .from("daily_sales")
        .select("item_name, quantity, sale_date")
        .eq("unit_id", effectiveUnidadeId)
        .gte("sale_date", dataInicio)
        .lte("sale_date", dataFim);
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveUnidadeId && !!dataInicio && !!dataFim,
  });
}

export type DesvioRow = {
  itemId: string;
  itemNome: string;
  consumoCamara: number;
  consumoPraca: number;
  vendasTeorico: number;
  ajusteManual: number;
  vendasTotal: number;
  desvioCamara: number;
  desvioPraca: number;
  desvioCamaraPct: number;
  desvioPracaPct: number;
};

/** Per-dia theoretical consumption for one cmv_item */
export type VendasAutoDia = {
  cmvItemId: string;
  dia: string;
  quantidade: number;
};

export function useDesvioCalculation(
  semana: SemanaCMV | undefined,
  items: CMVItem[],
  camaraEntries: CamaraEntry[],
  pracaEntries: PracaEntry[],
  ajusteEntries: VendasAjusteEntry[],
  salesData: DailySale[],
  mappings: SalesMapping[]
) {
  // Pre-compute auto sales per cmv_item per dia
  const vendasAutoPorItemDia = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    if (!mappings.length || !salesData.length) return result;

    // Build mapping: normalized sale name -> [{cmv_item_id, multiplicador}]
    const mapByName: Record<string, { cmv_item_id: string; multiplicador: number }[]> = {};
    mappings.forEach((m) => {
      const key = m.nome_venda.toLowerCase().trim();
      if (!mapByName[key]) mapByName[key] = [];
      mapByName[key].push({ cmv_item_id: m.cmv_item_id, multiplicador: m.multiplicador });
    });

    salesData.forEach((sale) => {
      const key = sale.item_name.toLowerCase().trim();
      const matches = mapByName[key];
      if (!matches) return;
      const dia = dateToDia(sale.sale_date);
      if (!dia) return;

      matches.forEach((m) => {
        if (!result[m.cmv_item_id]) result[m.cmv_item_id] = {};
        result[m.cmv_item_id][dia] = (result[m.cmv_item_id][dia] || 0) + sale.quantity * m.multiplicador;
      });
    });

    return result;
  }, [salesData, mappings]);

  // Flat list for the auto-sales grid
  const vendasAutoList = useMemo<VendasAutoDia[]>(() => {
    const list: VendasAutoDia[] = [];
    Object.entries(vendasAutoPorItemDia).forEach(([cmvItemId, dias]) => {
      Object.entries(dias).forEach(([dia, quantidade]) => {
        list.push({ cmvItemId, dia, quantidade });
      });
    });
    return list;
  }, [vendasAutoPorItemDia]);

  // Deviation rows
  const desvioRows = useMemo<DesvioRow[]>(() => {
    return items.map((item) => {
      // Consumo real câmara = total saídas
      let consumoCamara = 0;
      DIAS.forEach((dia) => {
        const e = camaraEntries.find((c) => c.cmv_item_id === item.id && c.dia === dia);
        consumoCamara += e?.saida ?? 0;
      });

      // Consumo real praça = Σ(T1 - T3)
      let consumoPraca = 0;
      DIAS.forEach((dia) => {
        const e = pracaEntries.find((p) => p.cmv_item_id === item.id && p.dia === dia);
        if (e?.t1_abertura != null && e?.t3_fechamento != null) {
          consumoPraca += e.t1_abertura - e.t3_fechamento;
        }
      });

      // Vendas teóricas (auto)
      let vendasTeorico = 0;
      DIAS.forEach((dia) => {
        vendasTeorico += vendasAutoPorItemDia[item.id]?.[dia] ?? 0;
      });

      // Ajuste manual
      let ajusteManual = 0;
      DIAS.forEach((dia) => {
        const a = ajusteEntries.find((e) => e.cmv_item_id === item.id && e.dia === dia);
        ajusteManual += a?.quantidade_manual ?? 0;
      });

      const vendasTotal = vendasTeorico + ajusteManual;
      const desvioCamara = consumoCamara - vendasTotal;
      const desvioPraca = consumoPraca - vendasTotal;
      const desvioCamaraPct = vendasTotal > 0 ? (desvioCamara / vendasTotal) * 100 : 0;
      const desvioPracaPct = vendasTotal > 0 ? (desvioPraca / vendasTotal) * 100 : 0;

      return {
        itemId: item.id,
        itemNome: item.nome,
        consumoCamara,
        consumoPraca,
        vendasTeorico,
        ajusteManual,
        vendasTotal,
        desvioCamara,
        desvioPraca,
        desvioCamaraPct,
        desvioPracaPct,
      };
    });
  }, [items, camaraEntries, pracaEntries, ajusteEntries, vendasAutoPorItemDia]);

  return { desvioRows, vendasAutoList, vendasAutoPorItemDia };
}
