import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lastSixMonths, monthRange, shortMonthLabel } from "./dateUtils";
import type { MetaKey, MonthValue } from "./types";

interface UseSixMonthsArgs {
  metaKey: MetaKey;
  unidadeId: string | null | undefined;
  /** Mês "atual" da visão. */
  mes: string;
  /** Quando false, a query não roda (ex.: meta sem suporte). */
  enabled?: boolean;
}

/**
 * Busca a série dos últimos 6 meses de uma meta para uma única loja.
 * Cada meta tem sua própria fonte; o componente usa esta abstração.
 */
export function useSixMonthsSeries({
  metaKey,
  unidadeId,
  mes,
  enabled = true,
}: UseSixMonthsArgs) {
  const months = lastSixMonths(mes);

  return useQuery({
    enabled: enabled && !!unidadeId,
    queryKey: ["painel-six-months", metaKey, unidadeId, mes],
    queryFn: async (): Promise<MonthValue[]> => {
      if (!unidadeId) return [];

      switch (metaKey) {
        // ───────────────────────── NPS (R$/reclamação) ─────────────────────────
        case "nps": {
          const earliest = `${months[0]}-01`;
          const lastEnd = monthRange(months[months.length - 1]).end;

          const [reclamRes, perfRes] = await Promise.all([
            supabase
              .from("reclamacoes")
              .select("referencia_mes")
              .eq("loja_id", unidadeId)
              .eq("tipo_operacao", "salao")
              .in("referencia_mes", months),
            supabase
              .from("store_performance_entries")
              .select("entry_date, faturamento_salao")
              .eq("loja_id", unidadeId)
              .gte("entry_date", earliest)
              .lte("entry_date", lastEnd),
          ]);
          if (reclamRes.error) throw reclamRes.error;
          if (perfRes.error) throw perfRes.error;

          const reclamCount = new Map<string, number>();
          (reclamRes.data ?? []).forEach((r: any) => {
            reclamCount.set(r.referencia_mes, (reclamCount.get(r.referencia_mes) ?? 0) + 1);
          });

          const fatByMes = new Map<string, number>();
          (perfRes.data ?? []).forEach((p: any) => {
            const m = String(p.entry_date).slice(0, 7);
            fatByMes.set(m, (fatByMes.get(m) ?? 0) + Number(p.faturamento_salao ?? 0));
          });

          return months.map((m) => {
            const fat = fatByMes.get(m) ?? 0;
            const rec = reclamCount.get(m) ?? 0;
            const value = rec > 0 ? fat / rec : null;
            return { mes: m, label: shortMonthLabel(m), value };
          });
        }

        // ───────────────────────── Conformidade (general_score) ────────────────
        case "conformidade": {
          const { data, error } = await supabase
            .from("leadership_store_scores")
            .select("month_year, general_score")
            .eq("loja_id", unidadeId)
            .in("month_year", months);
          if (error) throw error;

          const byMes = new Map<string, number | null>();
          (data ?? []).forEach((r: any) => {
            byMes.set(r.month_year, typeof r.general_score === "number" ? r.general_score : null);
          });
          return months.map((m) => ({
            mes: m,
            label: shortMonthLabel(m),
            value: byMes.get(m) ?? null,
          }));
        }

        // ───────────────────────── KDS (% pratos OK · tempo_prato) ──────────────
        case "kds": {
          const { data, error } = await supabase
            .from("avaliacoes")
            .select("referencia_mes, score_percentual")
            .eq("loja_id", unidadeId)
            .eq("codigo_meta", "tempo_prato")
            .in("referencia_mes", months);
          if (error) throw error;

          const acc = new Map<string, { sum: number; n: number }>();
          (data ?? []).forEach((r: any) => {
            if (typeof r.score_percentual !== "number") return;
            const cur = acc.get(r.referencia_mes) ?? { sum: 0, n: 0 };
            cur.sum += r.score_percentual;
            cur.n += 1;
            acc.set(r.referencia_mes, cur);
          });

          return months.map((m) => {
            const cur = acc.get(m);
            const value = cur && cur.n > 0 ? cur.sum / cur.n : null;
            return { mes: m, label: shortMonthLabel(m), value };
          });
        }

        // ─────────────── CMV Salmão / CMV Carnes ───────────────
        // Ainda não há agregação mensal canônica nas tabelas cmv_*.
        // O componente exibirá "Sem dados suficientes" até que a
        // série mensal seja consolidada.
        case "cmv-salmao":
        case "cmv-carnes":
        default:
          return months.map((m) => ({ mes: m, label: shortMonthLabel(m), value: null }));
      }
    },
  });
}
