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
  meta_key: string | null;
  ultimo_status?: 'ok' | 'erro' | 'pendente' | null;
  ultimo_erro?: string | null;
}

export interface SheetsSourceInput {
  nome: string;
  url: string;
  gid?: string;
  ativo?: boolean;
  meta_key?: string | null;
}

// Extrai sheetId + gid de qualquer URL Google Sheets
export function extractSheetParams(url: string): { sheetId: string; gid: string | null } {
  const idMatch = (url || '').match(/\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = (url || '').match(/[#&?]gid=(\d+)/);
  return { sheetId: idMatch?.[1] ?? '', gid: gidMatch?.[1] ?? null };
}

export function buildGvizUrl(sheetId: string, gidOrName: string | null): string {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
  if (!gidOrName) return base;
  return isNaN(Number(gidOrName))
    ? `${base}&sheet=${encodeURIComponent(gidOrName)}`
    : `${base}&gid=${gidOrName}`;
}

function extractSheetId(url: string): string | null {
  return extractSheetParams(url).sheetId || null;
}

function extractGid(url: string): string {
  return extractSheetParams(url).gid ?? '0';
}

/**
 * Normaliza qualquer link de Google Sheets para o gviz/tq canônico:
 * https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:json&gid={GID}
 */
export function normalizeSheetsUrl(url: string): string | null {
  if (!url) return null;
  const { sheetId, gid } = extractSheetParams(url.trim());
  if (!sheetId) return null;
  return buildGvizUrl(sheetId, gid);
}

// Valida que a URL é reconhecível como uma planilha Google Sheets
export function validateSheetsCsvUrl(url: string): { valid: boolean; error?: string } {
  if (!url || !url.trim()) return { valid: false, error: 'Cole o link da planilha.' };
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url.trim())) {
    return {
      valid: false,
      error: 'URL inválida. Cole um link do Google Sheets (docs.google.com/spreadsheets/...).',
    };
  }
  if (!extractSheetId(url)) {
    return { valid: false, error: 'Não foi possível identificar o ID da planilha.' };
  }
  return { valid: true };
}

// Extract sheet ID and GID from URL (qualquer formato aceito)
export function parseSheetsCsvUrl(url: string): { sheetId: string; gid: string } | null {
  const sheetId = extractSheetId(url);
  if (!sheetId) return null;
  return { sheetId, gid: extractGid(url) };
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

      const normalizedUrl = normalizeSheetsUrl(input.url) ?? input.url;
      const parsed = parseSheetsCsvUrl(normalizedUrl);

      const { error } = await supabase
        .from('sheets_sources')
        .insert({
          nome: input.nome,
          url: normalizedUrl,
          gid: input.gid || parsed?.gid || '0',
          ativo: input.ativo ?? true,
          meta_key: input.meta_key ?? null,
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

      const payload = { ...input };
      if (payload.url) {
        payload.url = normalizeSheetsUrl(payload.url) ?? payload.url;
      }

      const { error } = await supabase
        .from('sheets_sources')
        .update(payload)
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
      const { data, error } = await supabase
        .from('sheets_sources')
        .update({ ativo })
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Sem permissão para alterar esta fonte (apenas admins).');
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['sheets_sources'] });
      toast.success(vars.ativo ? 'Fonte ativada.' : 'Fonte desativada.');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar status da fonte.');
    },
  });

  // Vincula (ou substitui) a fonte ativa de uma meta específica.
  const linkSourceToMeta = useMutation({
    mutationFn: async ({ metaKey, url, nome }: { metaKey: string; url: string; nome: string }) => {
      const validation = validateSheetsCsvUrl(url);
      if (!validation.valid) throw new Error(validation.error);

      await supabase
        .from('sheets_sources')
        .update({ ativo: false })
        .eq('meta_key', metaKey)
        .eq('ativo', true);

      const normalizedUrl = normalizeSheetsUrl(url) ?? url;
      const parsed = parseSheetsCsvUrl(normalizedUrl);
      const { error } = await supabase
        .from('sheets_sources')
        .insert({
          nome,
          url: normalizedUrl,
          gid: parsed?.gid || '0',
          ativo: true,
          meta_key: metaKey,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets_sources'] });
      toast.success('Planilha vinculada à meta!');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao vincular planilha.');
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
    linkSourceToMeta,
  };
}

/** Retorna a fonte ATIVA vinculada a uma meta específica do Painel. */
export function useSourceForMeta(metaKey: string | null | undefined) {
  const { sources, isLoading } = useSheetsSources();
  const source = metaKey
    ? sources.find((s) => s.meta_key === metaKey && s.ativo) ?? null
    : null;
  return { source, isLoading };
}
