import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { currentMesRef } from "@/lib/metasUtils";
import type { MetaSnapshotRow } from "./useMetasSnapshot";

/**
 * Busca os snapshots de metas dos últimos N meses (default 6) para
 * sparklines, séries temporais e drawer de detalhe.
 */
export interface UseMetasHistoricoOptions {
  monthsBack?: number;
  lojaCodigo?: string | null;
}

function shiftMonth(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function useMetasHistorico(options: UseMetasHistoricoOptions = {}) {
  const { monthsBack = 6, lojaCodigo = null } = options;
  const current = currentMesRef();
  const oldest = shiftMonth(current, -(monthsBack - 1));

  return useQuery<MetaSnapshotRow[]>({
    queryKey: ["metas-historico", monthsBack, lojaCodigo, current],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const rows = await fetchAllRows<MetaSnapshotRow>(() => {
        let q = supabase
          .from("metas_snapshot")
          .select("*")
          .gte("mes_ref", oldest)
          .lte("mes_ref", current)
          .order("mes_ref", { ascending: true });
        if (lojaCodigo) q = q.eq("loja_codigo", lojaCodigo);
        return q;
      });
      return rows;
    },
  });
}

export type { MetaSnapshotRow };
