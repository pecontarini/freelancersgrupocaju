import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useLojaCodigoMap } from "@/components/dashboard/painel-metas/shared/useLojaCodigoMap";
import { useMemo } from "react";

export interface ReclamacaoRow {
  id: string;
  loja_id: string;
  fonte: string;
  tipo_operacao: string | null;
  data_reclamacao: string;
  nota_reclamacao: number | null;
  is_grave: boolean | null;
  texto_original: string | null;
  resumo_ia: string | null;
  temas: string[] | null;
  palavras_chave: string[] | null;
  referencia_mes: string | null;
}

export interface UseReclamacoesOptions {
  /** loja_codigo (NZ_AS, etc.) — opcional para restringir. */
  lojaCodigo?: string | null;
  /** quantos meses para trás carregar (default 6). */
  monthsBack?: number;
}

function shiftMonth(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function useReclamacoesData(options: UseReclamacoesOptions = {}) {
  const { lojaCodigo = null, monthsBack = 6 } = options;
  const { data: map } = useLojaCodigoMap();

  const lojaId = lojaCodigo && map ? map.codigoToId[lojaCodigo] ?? null : null;

  const now = new Date();
  const currentMes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const oldestMes = shiftMonth(currentMes, -(monthsBack - 1));

  const query = useQuery<ReclamacaoRow[]>({
    queryKey: ["reclamacoes-data", lojaId, monthsBack, currentMes],
    enabled: !!map,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const rows = await fetchAllRows<ReclamacaoRow>(() => {
        let q = supabase
          .from("reclamacoes")
          .select(
            "id, loja_id, fonte, tipo_operacao, data_reclamacao, nota_reclamacao, is_grave, texto_original, resumo_ia, temas, palavras_chave, referencia_mes"
          )
          .gte("referencia_mes", oldestMes)
          .lte("referencia_mes", currentMes)
          .order("data_reclamacao", { ascending: false });
        if (lojaId) q = q.eq("loja_id", lojaId);
        return q;
      });
      return rows;
    },
  });

  const aggregated = useMemo(() => {
    const rows = query.data ?? [];
    // Pareto de temas
    const temasCount: Record<string, number> = {};
    rows.forEach((r) => {
      (r.temas ?? []).forEach((t) => {
        const key = String(t).trim().toLowerCase();
        if (!key) return;
        temasCount[key] = (temasCount[key] ?? 0) + 1;
      });
    });
    const pareto = Object.entries(temasCount)
      .map(([tema, count]) => ({ tema, count }))
      .sort((a, b) => b.count - a.count);

    // Heatmap loja × tema (top 8 temas)
    const topTemas = pareto.slice(0, 8).map((t) => t.tema);
    const lojaTema: Record<string, Record<string, number>> = {};
    rows.forEach((r) => {
      const lid = r.loja_id;
      if (!lojaTema[lid]) lojaTema[lid] = {};
      (r.temas ?? []).forEach((t) => {
        const key = String(t).trim().toLowerCase();
        if (topTemas.includes(key)) {
          lojaTema[lid][key] = (lojaTema[lid][key] ?? 0) + 1;
        }
      });
    });

    // Por fonte
    const porFonte: Record<string, number> = {};
    rows.forEach((r) => {
      porFonte[r.fonte] = (porFonte[r.fonte] ?? 0) + 1;
    });

    // Série mensal
    const porMes: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.referencia_mes) porMes[r.referencia_mes] = (porMes[r.referencia_mes] ?? 0) + 1;
    });
    const serie = Object.entries(porMes)
      .map(([mes, count]) => ({ mes, count }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // Graves ordenadas
    const graves = rows
      .filter((r) => r.is_grave)
      .slice(0, 20);

    return { pareto, topTemas, lojaTema, porFonte, serie, graves, total: rows.length };
  }, [query.data]);

  return {
    rows: query.data ?? [],
    aggregated,
    isLoading: query.isLoading,
    error: query.error ? String(query.error) : null,
    isEmpty: !query.isLoading && (query.data?.length ?? 0) === 0,
  };
}
