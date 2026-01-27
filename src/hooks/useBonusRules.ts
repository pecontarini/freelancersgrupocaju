import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types matching the database enums
export type PositionType = 'gerente_front' | 'gerente_back' | 'chefia_front' | 'chefia_back';
export type SectorType = 'salao' | 'back' | 'apv' | 'delivery';
export type BonusTier = 'ouro' | 'prata' | 'bronze' | 'aceitavel';

export interface NpsTarget {
  id: string;
  sector_type: SectorType;
  tier: BonusTier;
  min_efficiency: number;
  created_at: string;
  updated_at: string;
}

export interface BonusRule {
  id: string;
  position_type: PositionType;
  tier: BonusTier;
  percentage: number;
  created_at: string;
  updated_at: string;
}

export interface BonusConfig {
  id: string;
  loja_id: string;
  position_type: PositionType;
  base_bonus_value: number;
  month_year: string;
  created_at: string;
  updated_at: string;
}

export interface StorePerformance {
  id: string;
  loja_id: string;
  month_year: string;
  faturamento: number;
  num_reclamacoes: number;
  nps_score: number | null;
  supervisao_score: number;
  tempo_prato_avg: number | null;
  tempo_comanda_avg: number | null;
  created_at: string;
  updated_at: string;
}

// Position type display names
export const POSITION_LABELS: Record<PositionType, string> = {
  gerente_front: 'Gerente Front',
  gerente_back: 'Gerente Back',
  chefia_front: 'Chefia Front',
  chefia_back: 'Chefia Back',
};

// Sector type display names
export const SECTOR_LABELS: Record<SectorType, string> = {
  salao: 'Salão',
  back: 'Back',
  apv: 'APV',
  delivery: 'Delivery',
};

// Tier display names and colors
export const TIER_CONFIG: Record<BonusTier, { label: string; color: string; gradient: string }> = {
  ouro: { label: 'Ouro', color: 'text-amber-500', gradient: 'from-amber-400 to-amber-600' },
  prata: { label: 'Prata', color: 'text-slate-400', gradient: 'from-slate-300 to-slate-500' },
  bronze: { label: 'Bronze', color: 'text-amber-700', gradient: 'from-amber-600 to-amber-800' },
  aceitavel: { label: 'Aceitável', color: 'text-emerald-600', gradient: 'from-emerald-400 to-emerald-600' },
};

// Custom hook for NPS targets
export function useNpsTargets() {
  const queryClient = useQueryClient();

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ['nps_targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nps_targets')
        .select('*')
        .order('sector_type')
        .order('tier');

      if (error) throw error;
      return data as NpsTarget[];
    },
  });

  const updateTarget = useMutation({
    mutationFn: async ({ id, min_efficiency }: { id: string; min_efficiency: number }) => {
      const { error } = await supabase
        .from('nps_targets')
        .update({ min_efficiency })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nps_targets'] });
      toast.success('Meta de NPS atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar meta.');
    },
  });

  // Helper to get targets by sector
  const getTargetsBySector = (sector: SectorType) => {
    return targets.filter((t) => t.sector_type === sector);
  };

  // Helper to determine tier based on efficiency value
  const determineTier = (sector: SectorType, efficiency: number): BonusTier | null => {
    const sectorTargets = getTargetsBySector(sector).sort((a, b) => b.min_efficiency - a.min_efficiency);
    
    for (const target of sectorTargets) {
      if (efficiency >= target.min_efficiency) {
        return target.tier;
      }
    }
    return null; // Below bronze = Red Flag
  };

  return {
    targets,
    isLoading,
    updateTarget,
    getTargetsBySector,
    determineTier,
  };
}

// Custom hook for bonus rules
export function useBonusRules() {
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['bonus_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_rules')
        .select('*')
        .order('position_type')
        .order('tier');

      if (error) throw error;
      return data as BonusRule[];
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, percentage }: { id: string; percentage: number }) => {
      const { error } = await supabase
        .from('bonus_rules')
        .update({ percentage })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus_rules'] });
      toast.success('Regra de bônus atualizada!');
    },
    onError: () => {
      toast.error('Erro ao atualizar regra.');
    },
  });

  // Helper to get rules by position
  const getRulesByPosition = (position: PositionType) => {
    return rules.filter((r) => r.position_type === position);
  };

  // Helper to get percentage for a specific position and tier
  const getPercentage = (position: PositionType, tier: BonusTier): number => {
    const rule = rules.find((r) => r.position_type === position && r.tier === tier);
    return rule?.percentage || 0;
  };

  return {
    rules,
    isLoading,
    updateRule,
    getRulesByPosition,
    getPercentage,
  };
}

// Custom hook for bonus config (base values per store/position)
export function useBonusConfig() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['bonus_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_config')
        .select('*')
        .order('month_year', { ascending: false });

      if (error) throw error;
      return data as BonusConfig[];
    },
  });

  const upsertConfig = useMutation({
    mutationFn: async (config: Omit<BonusConfig, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase
        .from('bonus_config')
        .upsert(config, { onConflict: 'loja_id,position_type,month_year' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonus_config'] });
      toast.success('Configuração de bônus salva!');
    },
    onError: () => {
      toast.error('Erro ao salvar configuração.');
    },
  });

  // Get config for a specific store, position, and month
  const getConfig = (lojaId: string, position: PositionType, monthYear: string) => {
    return configs.find(
      (c) => c.loja_id === lojaId && c.position_type === position && c.month_year === monthYear
    );
  };

  return {
    configs,
    isLoading,
    upsertConfig,
    getConfig,
  };
}

// Custom hook for store performance metrics
export function useStorePerformance() {
  const queryClient = useQueryClient();

  const { data: performances = [], isLoading } = useQuery({
    queryKey: ['store_performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_performance')
        .select('*')
        .order('month_year', { ascending: false });

      if (error) throw error;
      return data as StorePerformance[];
    },
  });

  const upsertPerformance = useMutation({
    mutationFn: async (performance: Omit<StorePerformance, 'id' | 'created_at' | 'updated_at'>) => {
      // Calculate NPS score = faturamento / num_reclamacoes
      const nps_score = performance.num_reclamacoes > 0 
        ? performance.faturamento / performance.num_reclamacoes 
        : performance.faturamento;

      const { error } = await supabase
        .from('store_performance')
        .upsert({ ...performance, nps_score }, { onConflict: 'loja_id,month_year' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store_performance'] });
      toast.success('Desempenho atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar desempenho.');
    },
  });

  // Get performance for a specific store and month
  const getPerformance = (lojaId: string, monthYear: string) => {
    return performances.find((p) => p.loja_id === lojaId && p.month_year === monthYear);
  };

  // Get all performances for a specific month (for ranking)
  const getPerformancesByMonth = (monthYear: string) => {
    return performances.filter((p) => p.month_year === monthYear);
  };

  return {
    performances,
    isLoading,
    upsertPerformance,
    getPerformance,
    getPerformancesByMonth,
  };
}

// Bonus calculator utility
export function calculateBonus(
  baseValue: number,
  tier: BonusTier | null,
  rules: BonusRule[],
  position: PositionType,
  isRedFlag: boolean
): { amount: number; percentage: number; tier: BonusTier | null } {
  if (isRedFlag || !tier) {
    return { amount: 0, percentage: 0, tier: null };
  }

  const rule = rules.find((r) => r.position_type === position && r.tier === tier);
  const percentage = rule?.percentage || 0;
  const amount = (baseValue * percentage) / 100;

  return { amount, percentage, tier };
}

// Red flag check - any KPI below 80% or below bronze tier
export function checkRedFlag(
  supervisaoScore: number,
  npsTier: BonusTier | null,
  minSupervisionPercent: number = 80
): boolean {
  // Below minimum supervision score
  if (supervisaoScore < minSupervisionPercent) {
    return true;
  }
  
  // NPS below bronze (null means below all tiers)
  if (npsTier === null) {
    return true;
  }

  return false;
}
