import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Json } from "@/integrations/supabase/types";
import type { CodigoMeta, OrigemDado } from "./useCargos";

export interface Avaliacao {
  id: string;
  loja_id: string;
  cargo_id: string;
  codigo_meta: CodigoMeta;
  score_percentual: number;
  referencia_mes: string;
  fonte: OrigemDado;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface AvaliacaoInput {
  loja_id: string;
  cargo_id: string;
  codigo_meta: CodigoMeta;
  score_percentual: number;
  referencia_mes: string;
  fonte: OrigemDado;
  metadata?: Json;
}

// Hook for avaliacoes
export function useAvaliacoes(lojaId?: string, referenciaMes?: string) {
  const queryClient = useQueryClient();

  const currentMonth = referenciaMes || format(new Date(), "yyyy-MM");

  const { data: avaliacoes = [], isLoading } = useQuery({
    queryKey: ['avaliacoes', lojaId, referenciaMes],
    queryFn: async () => {
      let query = supabase
        .from('avaliacoes')
        .select('*')
        .order('referencia_mes', { ascending: false })
        .order('codigo_meta');

      if (lojaId) {
        query = query.eq('loja_id', lojaId);
      }

      if (referenciaMes) {
        query = query.eq('referencia_mes', referenciaMes);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Avaliacao[];
    },
  });

  const upsertAvaliacao = useMutation({
    mutationFn: async (input: AvaliacaoInput) => {
      const { error } = await supabase
        .from('avaliacoes')
        .upsert(input, { 
          onConflict: 'loja_id,cargo_id,codigo_meta,referencia_mes' 
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoes'] });
      toast.success('Avaliação salva!');
    },
    onError: () => {
      toast.error('Erro ao salvar avaliação.');
    },
  });

  const bulkUpsertAvaliacoes = useMutation({
    mutationFn: async (inputs: AvaliacaoInput[]) => {
      const { error } = await supabase
        .from('avaliacoes')
        .upsert(inputs, { 
          onConflict: 'loja_id,cargo_id,codigo_meta,referencia_mes' 
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avaliacoes'] });
      toast.success('Avaliações importadas!');
    },
    onError: () => {
      toast.error('Erro ao importar avaliações.');
    },
  });

  // Get avaliacoes for a specific cargo
  const getAvaliacoesByCargo = (cargoId: string) => {
    return avaliacoes.filter((a) => a.cargo_id === cargoId);
  };

  // Get avaliacoes for a specific meta
  const getAvaliacoesByMeta = (codigoMeta: CodigoMeta) => {
    return avaliacoes.filter((a) => a.codigo_meta === codigoMeta);
  };

  // Get avaliacoes for a specific loja and month
  const getAvaliacoesByLojaMonth = (lojaId: string, mes: string) => {
    return avaliacoes.filter((a) => a.loja_id === lojaId && a.referencia_mes === mes);
  };

  // Get score for a specific combination
  const getScore = (lojaId: string, cargoId: string, codigoMeta: CodigoMeta, mes?: string) => {
    const refMes = mes || currentMonth;
    const avaliacao = avaliacoes.find(
      (a) => 
        a.loja_id === lojaId && 
        a.cargo_id === cargoId && 
        a.codigo_meta === codigoMeta &&
        a.referencia_mes === refMes
    );
    return avaliacao?.score_percentual || 0;
  };

  // Aggregate scores by loja for ranking
  const getAggregatedScoresByLoja = (mes?: string) => {
    const refMes = mes || currentMonth;
    const filtered = avaliacoes.filter((a) => a.referencia_mes === refMes);
    
    const aggregated: Record<string, { 
      loja_id: string; 
      totalScore: number; 
      count: number; 
      avgScore: number 
    }> = {};

    for (const av of filtered) {
      if (!aggregated[av.loja_id]) {
        aggregated[av.loja_id] = { loja_id: av.loja_id, totalScore: 0, count: 0, avgScore: 0 };
      }
      aggregated[av.loja_id].totalScore += av.score_percentual;
      aggregated[av.loja_id].count += 1;
      aggregated[av.loja_id].avgScore = aggregated[av.loja_id].totalScore / aggregated[av.loja_id].count;
    }

    return Object.values(aggregated).sort((a, b) => b.avgScore - a.avgScore);
  };

  return {
    avaliacoes,
    isLoading,
    upsertAvaliacao,
    bulkUpsertAvaliacoes,
    getAvaliacoesByCargo,
    getAvaliacoesByMeta,
    getAvaliacoesByLojaMonth,
    getScore,
    getAggregatedScoresByLoja,
  };
}
