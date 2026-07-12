import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types matching the database enums
export type FamiliaOperacional = 'front' | 'back';
export type SetorBack = 'cozinha' | 'bar' | 'parrilla' | 'sushi';
export type CategoriaCargo = 'gerencia' | 'chefia';
export type CodigoMeta = 'nps_salao' | 'nps_delivery' | 'supervisao' | 'conformidade_setor' | 'tempo_prato';
export type OrigemDado = 'sheets' | 'pdf' | 'kds' | 'manual';

export interface Cargo {
  id: string;
  nome: string;
  categoria: CategoriaCargo;
  familia_operacional: FamiliaOperacional;
  setor_back: SetorBack | null;
  pote_variavel_max: number;
  marca_aplicavel: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaCargo {
  id: string;
  cargo_id: string;
  codigo_meta: CodigoMeta;
  teto_valor: number;
  peso: number;
  origem_dado: OrigemDado;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Display labels for cargo names
export const CARGO_LABELS: Record<string, string> = {
  'Gerente de Front': 'Gerente de Front',
  'Gerente de Back': 'Gerente de Back',
  'Chefe de Salão': 'Chefe de Salão',
  'Chefe de APV': 'Chefe de APV',
  'Chefe de Cozinha': 'Chefe de Cozinha',
  'Chefe de Bar': 'Chefe de Bar',
  'Chefe de Parrilla': 'Chefe de Parrilla',
  'Chefe de Sushi': 'Chefe de Sushi',
};

// Setor display labels
export const SETOR_BACK_LABELS: Record<SetorBack, string> = {
  cozinha: 'Cozinha',
  bar: 'Bar',
  parrilla: 'Parrilla',
  sushi: 'Sushi',
};

// Meta display labels
export const META_LABELS: Record<CodigoMeta, string> = {
  nps_salao: 'NPS Salão',
  nps_delivery: 'NPS Delivery',
  supervisao: 'Supervisão',
  conformidade_setor: 'Conformidade do Setor',
  tempo_prato: 'Tempo de Prato',
};

// Origem display labels
export const ORIGEM_LABELS: Record<OrigemDado, string> = {
  sheets: 'Google Sheets',
  pdf: 'PDF (Auditoria)',
  kds: 'KDS',
  manual: 'Manual',
};

// Tier configuration (reused from useBonusRules for compatibility)
export type BonusTier = 'ouro' | 'prata' | 'bronze' | 'aceitavel';

export const TIER_CONFIG: Record<BonusTier, { label: string; color: string; gradient: string; minPercent: number }> = {
  ouro: { label: 'Ouro', color: 'text-amber-500', gradient: 'from-amber-400 to-amber-600', minPercent: 95 },
  prata: { label: 'Prata', color: 'text-slate-400', gradient: 'from-slate-300 to-slate-500', minPercent: 90 },
  bronze: { label: 'Bronze', color: 'text-amber-700', gradient: 'from-amber-600 to-amber-800', minPercent: 80 },
  aceitavel: { label: 'Aceitável', color: 'text-emerald-600', gradient: 'from-emerald-400 to-emerald-600', minPercent: 0 },
};

// Hook for cargos
export function useCargos() {
  const queryClient = useQueryClient();

  const { data: cargos = [], isLoading } = useQuery({
    queryKey: ['cargos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargos')
        .select('*')
        .eq('ativo', true)
        .order('categoria')
        .order('familia_operacional')
        .order('nome');

      if (error) throw error;
      return data as Cargo[];
    },
  });

  const updateCargo = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cargo> & { id: string }) => {
      const { error } = await supabase
        .from('cargos')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      toast.success('Cargo atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar cargo.');
    },
  });

  // Get cargos by category
  const getCargosByCategoria = (categoria: CategoriaCargo) => {
    return cargos.filter((c) => c.categoria === categoria);
  };

  // Get cargos by family
  const getCargosByFamilia = (familia: FamiliaOperacional) => {
    return cargos.filter((c) => c.familia_operacional === familia);
  };

  // Get cargo by name
  const getCargoByNome = (nome: string) => {
    return cargos.find((c) => c.nome === nome);
  };

  // Get gerencia cargos
  const gerencias = cargos.filter((c) => c.categoria === 'gerencia');

  // Get chefia cargos
  const chefias = cargos.filter((c) => c.categoria === 'chefia');

  // Get chefias back (specific positions)
  const chefiasBack = cargos.filter((c) => c.categoria === 'chefia' && c.familia_operacional === 'back');

  // Get chefias front
  const chefiasFront = cargos.filter((c) => c.categoria === 'chefia' && c.familia_operacional === 'front');

  return {
    cargos,
    isLoading,
    updateCargo,
    getCargosByCategoria,
    getCargosByFamilia,
    getCargoByNome,
    gerencias,
    chefias,
    chefiasBack,
    chefiasFront,
  };
}

// Hook for metas_cargo


