import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Sincronizacao {
  id: string;
  url: string;
  loja_id: string | null;
  referencia_mes: string;
  linhas_importadas: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  erro: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SincronizacaoInput {
  url: string;
  loja_id?: string | null;
  referencia_mes: string;
}

// Hook for sincronizacoes_sheets
export function useSincronizacoes() {
  const queryClient = useQueryClient();

  const { data: sincronizacoes = [], isLoading, refetch } = useQuery({
    queryKey: ['sincronizacoes_sheets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sincronizacoes_sheets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Sincronizacao[];
    },
  });

  const createSincronizacao = useMutation({
    mutationFn: async (input: SincronizacaoInput) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('sincronizacoes_sheets')
        .insert({
          ...input,
          status: 'pending',
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Sincronizacao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sincronizacoes_sheets'] });
    },
    onError: () => {
      toast.error('Erro ao criar sincronização.');
    },
  });

  const updateSincronizacao = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      linhas_importadas, 
      erro 
    }: { 
      id: string; 
      status: Sincronizacao['status']; 
      linhas_importadas?: number; 
      erro?: string | null 
    }) => {
      const updates: Partial<Sincronizacao> = { status };
      
      if (linhas_importadas !== undefined) {
        updates.linhas_importadas = linhas_importadas;
      }
      
      if (erro !== undefined) {
        updates.erro = erro;
      }
      
      if (status === 'success' || status === 'error') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('sincronizacoes_sheets')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sincronizacoes_sheets'] });
    },
  });

  // Get last successful sync
  const getLastSuccessfulSync = () => {
    return sincronizacoes.find((s) => s.status === 'success');
  };

  // Get pending syncs
  const getPendingSyncs = () => {
    return sincronizacoes.filter((s) => s.status === 'pending' || s.status === 'processing');
  };

  // Process a Google Sheets sync
  const processSheetsSync = async (input: SincronizacaoInput) => {
    try {
      // Create the sync record
      const sync = await createSincronizacao.mutateAsync(input);
      
      // Call the edge function to process the sheet
      const { data, error } = await supabase.functions.invoke('sync-google-sheets', {
        body: {
          syncId: sync.id,
          url: input.url,
          referenciaMes: input.referencia_mes,
          lojaId: input.loja_id,
        },
      });

      if (error) throw error;

      toast.success(`Sincronização concluída! ${data.linhasImportadas || 0} linhas importadas.`);
      
      // Refresh data
      refetch();
      queryClient.invalidateQueries({ queryKey: ['avaliacoes'] });
      
      return data;
    } catch (error) {
      console.error('Error processing sheets sync:', error);
      toast.error('Erro ao processar planilha. Verifique o link e tente novamente.');
      throw error;
    }
  };

  return {
    sincronizacoes,
    isLoading,
    createSincronizacao,
    updateSincronizacao,
    getLastSuccessfulSync,
    getPendingSyncs,
    processSheetsSync,
    refetch,
  };
}

// Helper to extract Google Sheets ID from URL
export function extractSheetsId(url: string): string | null {
  // Match various Google Sheets URL formats
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /\/d\/([a-zA-Z0-9-_]+)\//,
    /^([a-zA-Z0-9-_]{40,})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Helper to build CSV export URL from Sheets ID
export function buildSheetsCsvUrl(sheetsId: string, gid: string = '0'): string {
  return `https://docs.google.com/spreadsheets/d/${sheetsId}/export?format=csv&gid=${gid}`;
}
