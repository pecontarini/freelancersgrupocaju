import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SnapshotMeta {
  referenciaMes: string;
  referenciaLabel: string;
  createdAt: string;
  arquivoNome: string;
  linhasImportadas: number;
}

export interface SnapshotFull<T = any> extends SnapshotMeta {
  dados: T;
}

/**
 * Busca um snapshot específico (referenciaMes) ou o mais recente.
 */
export function useIndicadoresSnapshot<T = any>(
  metaKey: string | null | undefined,
  referenciaMes?: string,
) {
  return useQuery({
    queryKey: ["indicadores_snapshot", metaKey, referenciaMes ?? "latest"],
    enabled: !!metaKey,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("indicadores_snapshots" as any)
        .select("dados, referencia_mes, referencia_label, created_at, arquivo_nome, linhas_importadas")
        .eq("meta_key", metaKey!);

      if (referenciaMes) {
        q = q.eq("referencia_mes", referenciaMes);
      } else {
        q = q.order("referencia_mes", { ascending: false }).limit(1);
      }

      const { data, error } = await q;
      if (error) throw error;
      const row = (data as any[])?.[0];
      if (!row) return null;
      return {
        dados: row.dados as T,
        meta: {
          referenciaMes: row.referencia_mes,
          referenciaLabel: row.referencia_label,
          createdAt: row.created_at,
          arquivoNome: row.arquivo_nome ?? "",
          linhasImportadas: row.linhas_importadas ?? 0,
        } as SnapshotMeta,
      };
    },
  });
}

/**
 * Lista todos os meses disponíveis (apenas metadados).
 */
export function useIndicadoresHistorico(metaKey: string | null | undefined) {
  return useQuery({
    queryKey: ["indicadores_historico", metaKey],
    enabled: !!metaKey,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("indicadores_snapshots" as any)
        .select("referencia_mes, referencia_label, created_at, arquivo_nome, linhas_importadas")
        .eq("meta_key", metaKey!)
        .order("referencia_mes", { ascending: false });
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({
        referenciaMes: r.referencia_mes,
        referenciaLabel: r.referencia_label,
        createdAt: r.created_at,
        arquivoNome: r.arquivo_nome ?? "",
        linhasImportadas: r.linhas_importadas ?? 0,
      })) as SnapshotMeta[];
    },
  });
}
