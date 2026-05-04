import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { currentMesRef } from "@/lib/metasUtils";

export interface MetaSnapshotRow {
  id: string;
  loja_codigo: string;
  loja_id: string | null;
  mes_ref: string;
  nps: number | null;
  nps_anterior: number | null;
  cmv_salmao: number | null;
  cmv_salmao_anterior: number | null;
  cmv_carnes: number | null;
  cmv_carnes_anterior: number | null;
  kds: number | null;
  kds_anterior: number | null;
  conformidade: number | null;
  conformidade_anterior: number | null;
  red_flag: boolean;
  observacoes: string | null;
  updated_at: string;
}

interface Options {
  /** Filtra por loja específica (opcional). */
  lojaCodigo?: string | null;
  /** Mês de referência 'YYYY-MM' (default: mês corrente). */
  mesRef?: string;
  /** Habilita realtime (default: true). */
  realtime?: boolean;
}

interface Result {
  data: MetaSnapshotRow[];
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  refetch: () => Promise<void>;
}

export function useMetasSnapshot(options: Options = {}): Result {
  const { lojaCodigo, mesRef = currentMesRef(), realtime = true } = options;
  const [data, setData] = useState<MetaSnapshotRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("metas_snapshot")
        .select("*")
        .eq("mes_ref", mesRef)
        .order("loja_codigo", { ascending: true });

      if (lojaCodigo) query = query.eq("loja_codigo", lojaCodigo);

      const { data: rows, error: err } = await query;
      if (err) throw err;
      setData((rows ?? []) as MetaSnapshotRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar metas");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesRef, lojaCodigo]);

  // Realtime
  useEffect(() => {
    if (!realtime) return;
    const channel = supabase
      .channel(`metas_snapshot_${mesRef}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "metas_snapshot",
          filter: `mes_ref=eq.${mesRef}`,
        },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesRef, realtime]);

  return {
    data,
    isLoading,
    error,
    isEmpty: !isLoading && data.length === 0,
    refetch: fetchData,
  };
}
