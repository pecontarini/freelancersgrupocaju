import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useLojaCodigoMap } from "@/components/dashboard/painel-metas/shared/useLojaCodigoMap";
import { useMemo } from "react";

export interface SectorScoreRow {
  id: string;
  audit_id: string;
  loja_id: string;
  sector_code: string;
  checklist_type: string | null;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
  item_count: number | null;
  audit_date: string;
  month_year: string;
}

export interface AuditRow {
  id: string;
  loja_id: string;
  audit_date: string;
  global_score: number | null;
  pdf_url: string | null;
}

/** Setores classificados como Back e Front */
export const BACK_SECTORS = new Set(["cozinha", "sushi", "parrilla", "estoque", "lavagem", "manutencao"]);
export const FRONT_SECTORS = new Set(["salao", "bar", "delivery", "area_comum", "brinquedoteca", "asg"]);

export type SectorGroup = "back" | "front" | "outros";

export function classifySector(code: string): SectorGroup {
  if (BACK_SECTORS.has(code)) return "back";
  if (FRONT_SECTORS.has(code)) return "front";
  return "outros";
}

export interface UseConformidadeOptions {
  lojaCodigo?: string | null;
  monthsBack?: number;
}

function shiftMonth(mesRef: string, delta: number): string {
  const [y, m] = mesRef.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function useConformidadeData(options: UseConformidadeOptions = {}) {
  const { lojaCodigo = null, monthsBack = 6 } = options;
  const { data: map } = useLojaCodigoMap();
  const lojaId = lojaCodigo && map ? map.codigoToId[lojaCodigo] ?? null : null;

  const now = new Date();
  const currentMes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const oldestMes = shiftMonth(currentMes, -(monthsBack - 1));

  const scoresQ = useQuery<SectorScoreRow[]>({
    queryKey: ["conformidade-scores", lojaId, monthsBack, currentMes],
    enabled: !!map,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const rows = await fetchAllRows<SectorScoreRow>(() => {
        let q = supabase
          .from("audit_sector_scores")
          .select(
            "id, audit_id, loja_id, sector_code, checklist_type, score, total_points, earned_points, item_count, audit_date, month_year"
          )
          .gte("month_year", oldestMes)
          .lte("month_year", currentMes)
          .order("audit_date", { ascending: false });
        if (lojaId) q = q.eq("loja_id", lojaId);
        return q;
      });
      return rows;
    },
  });

  const auditsQ = useQuery<AuditRow[]>({
    queryKey: ["conformidade-audits", lojaId, monthsBack, currentMes],
    enabled: !!map,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const rows = await fetchAllRows<AuditRow>(() => {
        let q = supabase
          .from("supervision_audits")
          .select("id, loja_id, audit_date, global_score, pdf_url")
          .gte("audit_date", `${oldestMes}-01`)
          .order("audit_date", { ascending: false });
        if (lojaId) q = q.eq("loja_id", lojaId);
        return q;
      });
      return rows;
    },
  });

  const aggregated = useMemo(() => {
    const scores = scoresQ.data ?? [];
    const audits = auditsQ.data ?? [];

    // Por loja (mês corrente) — média do score
    const byLojaCurrent: Record<string, { back: number[]; front: number[]; all: number[] }> = {};
    scores
      .filter((s) => s.month_year === currentMes && s.score !== null)
      .forEach((s) => {
        const g = classifySector(s.sector_code);
        if (!byLojaCurrent[s.loja_id]) byLojaCurrent[s.loja_id] = { back: [], front: [], all: [] };
        byLojaCurrent[s.loja_id].all.push(Number(s.score));
        if (g === "back") byLojaCurrent[s.loja_id].back.push(Number(s.score));
        if (g === "front") byLojaCurrent[s.loja_id].front.push(Number(s.score));
      });

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const lojas = Object.entries(byLojaCurrent).map(([loja_id, v]) => ({
      loja_id,
      back: avg(v.back),
      front: avg(v.front),
      total: avg(v.all),
    }));

    // Série mensal (todas lojas, por grupo)
    const porMesGrupo: Record<string, { back: number[]; front: number[]; all: number[] }> = {};
    scores.forEach((s) => {
      if (s.score === null) return;
      const m = s.month_year;
      if (!porMesGrupo[m]) porMesGrupo[m] = { back: [], front: [], all: [] };
      porMesGrupo[m].all.push(Number(s.score));
      const g = classifySector(s.sector_code);
      if (g === "back") porMesGrupo[m].back.push(Number(s.score));
      if (g === "front") porMesGrupo[m].front.push(Number(s.score));
    });
    const serie = Object.entries(porMesGrupo)
      .map(([mes, v]) => ({ mes, back: avg(v.back), front: avg(v.front), total: avg(v.all) }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    // Por setor (mês corrente)
    const porSetor: Record<string, number[]> = {};
    scores
      .filter((s) => s.month_year === currentMes && s.score !== null)
      .forEach((s) => {
        if (!porSetor[s.sector_code]) porSetor[s.sector_code] = [];
        porSetor[s.sector_code].push(Number(s.score));
      });
    const setores = Object.entries(porSetor)
      .map(([code, arr]) => ({ code, score: avg(arr), grupo: classifySector(code), n: arr.length }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return {
      lojas,
      serie,
      setores,
      audits: audits.slice(0, 12),
    };
  }, [scoresQ.data, auditsQ.data, currentMes]);

  return {
    scores: scoresQ.data ?? [],
    audits: auditsQ.data ?? [],
    aggregated,
    isLoading: scoresQ.isLoading || auditsQ.isLoading,
    error: scoresQ.error || auditsQ.error ? String(scoresQ.error || auditsQ.error) : null,
    isEmpty:
      !scoresQ.isLoading &&
      !auditsQ.isLoading &&
      (scoresQ.data?.length ?? 0) === 0 &&
      (auditsQ.data?.length ?? 0) === 0,
  };
}
