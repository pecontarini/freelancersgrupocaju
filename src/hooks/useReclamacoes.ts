import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";
import { format } from "date-fns";

export type FonteReclamacao = 'google' | 'ifood' | 'tripadvisor' | 'getin' | 'manual' | 'sheets';
export type TipoOperacao = 'salao' | 'delivery';

export interface Reclamacao {
  id: string;
  loja_id: string;
  fonte: FonteReclamacao;
  tipo_operacao: TipoOperacao;
  data_reclamacao: string;
  nota_reclamacao: number;
  is_grave: boolean;
  texto_original: string | null;
  resumo_ia: string | null;
  temas: string[];
  palavras_chave: string[];
  anexo_url: string | null;
  referencia_mes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReclamacaoInput {
  loja_id: string;
  fonte: FonteReclamacao;
  tipo_operacao: TipoOperacao;
  data_reclamacao: string;
  nota_reclamacao: number;
  texto_original?: string;
  resumo_ia?: string;
  temas?: string[];
  palavras_chave?: string[];
  anexo_url?: string;
}

export interface ImageExtractionResult {
  success: boolean;
  nota_estrelas?: number;
  texto_reclamacao?: string;
  fonte?: FonteReclamacao;
  tipo_operacao?: TipoOperacao;
  resumo?: string;
  temas?: string[];
  palavras_chave?: string[];
  confianca?: "alta" | "media" | "baixa";
  error?: string;
}

export interface ReclamacoesAgregadas {
  loja_id: string;
  total: number;
  graves: number;
  nao_graves: number;
  por_fonte: Record<FonteReclamacao, number>;
  por_operacao: { salao: number; delivery: number };
}

export function useReclamacoes(lojaId?: string, referenciaMes?: string) {
  const queryClient = useQueryClient();
  const currentMonth = referenciaMes || format(new Date(), "yyyy-MM");

  const { data: reclamacoes = [], isLoading, refetch } = useQuery({
    queryKey: ['reclamacoes', lojaId, referenciaMes],
    queryFn: async () => {
      let query = supabase
        .from('reclamacoes')
        .select('*')
        .order('data_reclamacao', { ascending: false });

      if (lojaId) {
        query = query.eq('loja_id', lojaId);
      }

      if (referenciaMes) {
        query = query.eq('referencia_mes', referenciaMes);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Parse JSON fields
      return (data || []).map((r) => ({
        ...r,
        temas: Array.isArray(r.temas) ? r.temas : [],
        palavras_chave: Array.isArray(r.palavras_chave) ? r.palavras_chave : [],
      })) as Reclamacao[];
    },
  });

  // Aggregate by store
  const agregadoPorLoja = useMemo((): Record<string, ReclamacoesAgregadas> => {
    const result: Record<string, ReclamacoesAgregadas> = {};

    for (const r of reclamacoes) {
      if (!result[r.loja_id]) {
        result[r.loja_id] = {
          loja_id: r.loja_id,
          total: 0,
          graves: 0,
          nao_graves: 0,
          por_fonte: { google: 0, ifood: 0, tripadvisor: 0, getin: 0, manual: 0, sheets: 0 },
          por_operacao: { salao: 0, delivery: 0 },
        };
      }

      const agg = result[r.loja_id];
      agg.total += 1;
      if (r.is_grave) {
        agg.graves += 1;
      } else {
        agg.nao_graves += 1;
      }
      agg.por_fonte[r.fonte] = (agg.por_fonte[r.fonte] || 0) + 1;
      agg.por_operacao[r.tipo_operacao] = (agg.por_operacao[r.tipo_operacao] || 0) + 1;
    }

    return result;
  }, [reclamacoes]);

  // Get graves count for a store
  const getGravesCount = (lojaId: string): number => {
    return agregadoPorLoja[lojaId]?.graves || 0;
  };

  // Get total count for a store
  const getTotalCount = (lojaId: string): number => {
    return agregadoPorLoja[lojaId]?.total || 0;
  };

  const createReclamacao = useMutation({
    mutationFn: async (input: ReclamacaoInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Calculate referencia_mes from data_reclamacao
      const refMes = input.data_reclamacao.substring(0, 7);

      const { error } = await supabase
        .from('reclamacoes')
        .insert({
          ...input,
          referencia_mes: refMes,
          created_by: userData.user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reclamacoes'] });
      // Trigger propagation to rankings
      queryClient.invalidateQueries({ queryKey: ['performance_entries'] });
      toast.success('Reclamação registrada!');
    },
    onError: () => {
      toast.error('Erro ao registrar reclamação.');
    },
  });

  const deleteReclamacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reclamacoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reclamacoes'] });
      queryClient.invalidateQueries({ queryKey: ['performance_entries'] });
      toast.success('Reclamação removida!');
    },
    onError: () => {
      toast.error('Erro ao remover reclamação.');
    },
  });

  return {
    reclamacoes,
    isLoading,
    refetch,
    agregadoPorLoja,
    getGravesCount,
    getTotalCount,
    createReclamacao,
    deleteReclamacao,
    currentMonth,
  };
}
