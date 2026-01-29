import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SheetsSource {
  id: string;
  nome: string;
  url: string;
  gid: string;
  ativo: boolean;
  ultima_sincronizacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface SheetsSourceInput {
  nome: string;
  url: string;
  gid?: string;
  ativo?: boolean;
}

// Validate that URL is a valid Google Sheets export CSV format
export function validateSheetsCsvUrl(url: string): { valid: boolean; error?: string } {
  const exportPattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/export\?format=csv/;
  
  if (!exportPattern.test(url)) {
    // Check if it's an edit/view URL
    if (url.includes('/edit') || url.includes('/view')) {
      return {
        valid: false,
        error: 'Use o formato de exportação CSV. URLs com /edit ou /view não são aceitas.',
      };
    }
    return {
      valid: false,
      error: 'URL inválida. Use: https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}',
    };
  }
  
  return { valid: true };
}

// Extract sheet ID and GID from URL
export function parseSheetsCsvUrl(url: string): { sheetId: string; gid: string } | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)\/export\?format=csv(?:&gid=(\d+))?/);
  if (!match) return null;
  
  return {
    sheetId: match[1],
    gid: match[2] || '0',
  };
}

export function useSheetsSources() {
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading, refetch } = useQuery({
    queryKey: ['sheets_sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sheets_sources')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as SheetsSource[];
    },
  });

  const activeSources = sources.filter((s) => s.ativo);

  const createSource = useMutation({
    mutationFn: async (input: SheetsSourceInput) => {
      // Validate URL format
      const validation = validateSheetsCsvUrl(input.url);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const { error } = await supabase
        .from('sheets_sources')
        .insert({
          nome: input.nome,
          url: input.url,
          gid: input.gid || '0',
          ativo: input.ativo ?? true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets_sources'] });
      toast.success('Fonte de dados adicionada!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao adicionar fonte.');
    },
  });

  const updateSource = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SheetsSourceInput> & { id: string }) => {
      if (input.url) {
        const validation = validateSheetsCsvUrl(input.url);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      const { error } = await supabase
        .from('sheets_sources')
        .update(input)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets_sources'] });
      toast.success('Fonte atualizada!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao atualizar fonte.');
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sheets_sources')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets_sources'] });
      toast.success('Sincronização removida com sucesso');
    },
    onError: () => {
      toast.error('Erro ao remover fonte.');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('sheets_sources')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets_sources'] });
    },
  });

  return {
    sources,
    activeSources,
    isLoading,
    refetch,
    createSource,
    updateSource,
    deleteSource,
    toggleActive,
  };
}
