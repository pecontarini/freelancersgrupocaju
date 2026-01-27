import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface PerformanceEntry {
  id: string;
  loja_id: string;
  entry_date: string;
  faturamento_salao: number;
  faturamento_delivery: number;
  reclamacoes_salao: number;
  reclamacoes_ifood: number;
  created_by: string | null;
  created_at: string;
  notes: string | null;
}

export interface AggregatedPerformance {
  loja_id: string;
  month_year: string;
  total_faturamento_salao: number;
  total_faturamento_delivery: number;
  total_faturamento: number;
  total_reclamacoes_salao: number;
  total_reclamacoes_ifood: number;
  total_reclamacoes: number;
  entries_count: number;
  first_entry_date: string | null;
  last_entry_date: string | null;
  daily_average_faturamento: number;
  days_with_entries: number;
}

export interface PerformanceEntryInput {
  loja_id: string;
  entry_date: string;
  faturamento_salao: number;
  faturamento_delivery: number;
  reclamacoes_salao: number;
  reclamacoes_ifood: number;
  notes?: string;
}

export function usePerformanceEntries(monthYear?: string) {
  const queryClient = useQueryClient();
  const currentMonthYear = monthYear || format(new Date(), "yyyy-MM");

  // Get start and end of month for date filtering
  const monthStart = format(startOfMonth(new Date(currentMonthYear + "-01")), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date(currentMonthYear + "-01")), "yyyy-MM-dd");

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['performance_entries', currentMonthYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_performance_entries')
        .select('*')
        .gte('entry_date', monthStart)
        .lte('entry_date', monthEnd)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      return data as PerformanceEntry[];
    },
  });

  // Aggregate entries by store for the current month
  const aggregatedByStore = useMemo((): Record<string, AggregatedPerformance> => {
    const result: Record<string, AggregatedPerformance> = {};

    entries.forEach((entry) => {
      if (!result[entry.loja_id]) {
        result[entry.loja_id] = {
          loja_id: entry.loja_id,
          month_year: currentMonthYear,
          total_faturamento_salao: 0,
          total_faturamento_delivery: 0,
          total_faturamento: 0,
          total_reclamacoes_salao: 0,
          total_reclamacoes_ifood: 0,
          total_reclamacoes: 0,
          entries_count: 0,
          first_entry_date: null,
          last_entry_date: null,
          daily_average_faturamento: 0,
          days_with_entries: 0,
        };
      }

      const agg = result[entry.loja_id];
      agg.total_faturamento_salao += Number(entry.faturamento_salao);
      agg.total_faturamento_delivery += Number(entry.faturamento_delivery);
      agg.total_faturamento += Number(entry.faturamento_salao) + Number(entry.faturamento_delivery);
      agg.total_reclamacoes_salao += entry.reclamacoes_salao;
      agg.total_reclamacoes_ifood += entry.reclamacoes_ifood;
      agg.total_reclamacoes += entry.reclamacoes_salao + entry.reclamacoes_ifood;
      agg.entries_count += 1;

      // Track date range
      if (!agg.first_entry_date || entry.entry_date < agg.first_entry_date) {
        agg.first_entry_date = entry.entry_date;
      }
      if (!agg.last_entry_date || entry.entry_date > agg.last_entry_date) {
        agg.last_entry_date = entry.entry_date;
      }
    });

    // Calculate daily averages based on unique entry dates
    Object.values(result).forEach((agg) => {
      const uniqueDates = new Set(
        entries
          .filter((e) => e.loja_id === agg.loja_id)
          .map((e) => e.entry_date)
      );
      agg.days_with_entries = uniqueDates.size;
      agg.daily_average_faturamento = agg.days_with_entries > 0 
        ? agg.total_faturamento / agg.days_with_entries 
        : 0;
    });

    return result;
  }, [entries, currentMonthYear]);

  // Get aggregated performance for a specific store
  const getStoreAggregated = (lojaId: string): AggregatedPerformance | null => {
    return aggregatedByStore[lojaId] || null;
  };

  // Get entries for a specific store
  const getStoreEntries = (lojaId: string): PerformanceEntry[] => {
    return entries.filter((e) => e.loja_id === lojaId);
  };

  // Add new entry (additive - not replacing)
  const addEntry = useMutation({
    mutationFn: async (input: PerformanceEntryInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('store_performance_entries')
        .insert({
          ...input,
          created_by: userData.user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance_entries'] });
      toast.success('Lançamento de performance adicionado!');
    },
    onError: (err) => {
      console.error('Error adding entry:', err);
      toast.error('Erro ao adicionar lançamento.');
    },
  });

  // Delete an entry
  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('store_performance_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['performance_entries'] });
      toast.success('Lançamento removido!');
    },
    onError: () => {
      toast.error('Erro ao remover lançamento.');
    },
  });

  return {
    entries,
    isLoading,
    error,
    aggregatedByStore,
    getStoreAggregated,
    getStoreEntries,
    addEntry,
    deleteEntry,
    currentMonthYear,
  };
}

// Utility to calculate projection based on real entries
export function calculateProjection(
  aggregated: AggregatedPerformance | null,
  daysInMonth: number
): {
  projectedFaturamento: number;
  projectedReclamacoes: number;
  dailyAverage: number;
  confidenceLevel: 'high' | 'medium' | 'low';
} {
  if (!aggregated || aggregated.days_with_entries === 0) {
    return {
      projectedFaturamento: 0,
      projectedReclamacoes: 0,
      dailyAverage: 0,
      confidenceLevel: 'low',
    };
  }

  const dailyAverage = aggregated.daily_average_faturamento;
  const projectedFaturamento = dailyAverage * daysInMonth;
  
  const dailyReclamacoes = aggregated.total_reclamacoes / aggregated.days_with_entries;
  const projectedReclamacoes = Math.round(dailyReclamacoes * daysInMonth);

  // Confidence based on how many days of data we have
  let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
  if (aggregated.days_with_entries >= 14) {
    confidenceLevel = 'high';
  } else if (aggregated.days_with_entries >= 7) {
    confidenceLevel = 'medium';
  }

  return {
    projectedFaturamento,
    projectedReclamacoes,
    dailyAverage,
    confidenceLevel,
  };
}
