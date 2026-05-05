import { getLojaDisplay, lojaHasRankingMetric } from "@/lib/lojaUtils";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Sparkles, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetaCard, type MetaCardProps } from "@/components/metas/MetaCard";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import {
  calcCmvCarnesStatus,
  calcCmvSalmaoStatus,
  calcConformidadeStatus,
  calcMetaPercentual,
  calcMetaStatus,
  calcNpsStatus,
  formatNpsDisplay,
} from "@/lib/metasUtils";
import {
  METRIC_META,
  RANKING_METRICS,
  bandeiraStyles,
  snapshotToLoja,
  type RankingMetric,
} from "../shared/mockLojas";
import { cn } from "@/lib/utils";

interface MetricSpec {
  key: RankingMetric;
  titulo: string;
  tipo: string;
  meta: number;
  redFlag: number;
  polarity: "higher" | "lower";
  unidadeSufixo?: string;
  pick: (r: any) => number | null;
}

const SPECS: MetricSpec[] = [
  { key: "nps", titulo: "NPS Salão", tipo: "Experiência", meta: 120000, redFlag: 70000, polarity: "higher", pick: (r) => r.nps },
  { key: "cmv-salmao", titulo: "CMV Salmão", tipo: "kg por R$1k vendido", meta: 1.55, redFlag: 1.9, polarity: "lower", unidadeSufixo: "kg", pick: (r) => r.cmv_salmao },
  { key: "cmv-carnes", titulo: "CMV Carnes", tipo: "% desvio s/ transferido", meta: 0.6, redFlag: 2.0, polarity: "lower", unidadeSufixo: "%", pick: (r) => r.cmv_carnes },
  { key: "conformidade", titulo: "Conformidade Auditoria", tipo: "Operação", meta: 90, redFlag: 75, polarity: "higher", unidadeSufixo: "%", pick: (r) => r.conformidade },
  { key: "kds", titulo: "KDS · Tempo de Prato", tipo: "% pratos black target", meta: 5, redFlag: 10, polarity: "lower", unidadeSufixo: "%", pick: (r) => r.kds },
];

const PODIUM_ICONS = ["🥇", "🥈", "🥉"];

function avg(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

interface VisaoGeralProps {
  /** Se definido, restringe a visualização à loja indicada (ex: gerente_unidade). */
  restrictToLojaCodigo?: string | null;
}

export function VisaoGeralCompactView({ restrictToLojaCodigo }: VisaoGeralProps = {}) {
  const { data: rawData, isLoading, isEmpty, error } = useMetasSnapshot();
  const data = useMemo(
    () =>
      restrictToLojaCodigo
        ? rawData.filter((r) => r.loja_codigo === restrictToLojaCodigo)
        : rawData,
    [rawData, restrictToLojaCodigo],
  );
  const lojas = useMemo(() => data.map(snapshotToLoja), [data]);

  const metas: MetaCardProps[] = useMemo(() => {
    if (!data.length) return [];
    return SPECS.map((spec) => {
      const eligible = data.filter((r) => lojaHasRankingMetric(r.loja_codigo, spec.key));
      const value = avg(eligible.map(spec.pick));
      let status: MetaCardProps["status"];
      if (spec.titulo.startsWith("NPS")) status = calcNpsStatus(value);
      else if (spec.titulo.startsWith("Conformidade")) status = calcConformidadeStatus(value);
      else if (spec.titulo === "CMV Carnes") status = calcCmvCarnesStatus(value);
      else if (spec.titulo === "CMV Salmão") status = calcCmvSalmaoStatus(value);
      else status = calcMetaStatus(value, spec.meta, spec.redFlag, spec.polarity);
      const isNps = spec.titulo.startsWith("NPS");
      return {
        titulo: spec.titulo,
        tipo: spec.tipo,
        valorAtual: value ?? 0,
        valorMeta: spec.meta,
        percentual: calcMetaPercentual(value, spec.meta, spec.polarity),
        status,
        redFlag: status === "redflag",
        unidadeSufixo: spec.unidadeSufixo ?? "",
        formatValor: isNps ? formatNpsDisplay : undefined,
        formatMeta: isNps ? formatNpsDisplay : undefined,
      };
    });
  }, [data]);

  const podiums = useMemo(() => {
    return RANKING_METRICS.map((m) => {
      const meta = METRIC_META[m];
      const sorted = [...lojas]
        .filter((l) => l.values[m] !== null && lojaHasRankingMetric(l.code, m))
        .sort((a, b) => {
          const av = a.values[m]!;
          const bv = b.values[m]!;
          return meta.polarity === "higher" ? bv - av : av - bv;
        });
      const top = sorted.slice(0, 3);
      const worst = sorted.length > 3 ? sorted[sorted.length - 1] : null;
      return { metric: m, top, worst };
    });
  }, [lojas]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl bg-foreground/5" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass-card p-8 text-center text-red-600 dark:text-red-300 ring-1 ring-red-500/30">
        {error}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 p-12 text-center ring-1 ring-amber-500/20">
        <Clock className="h-10 w-10 text-amber-400" />
        <p className="font-display text-base font-semibold text-foreground">
          Aguardando sincronização semanal
        </p>
        <p className="text-xs text-muted-foreground">
          Os snapshots de metas ainda não foram gerados para este mês.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {metas.map((m, i) => (
          <motion.div
            key={m.titulo}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.35 }}
          >
            <MetaCard {...m} />
          </motion.div>
        ))}
      </div>

      <Card className="vision-glass">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-amber-400" />
            Top 3 por Métrica
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            As três lojas com melhor desempenho em cada indicador da rede
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {podiums.map(({ metric, top, worst }) => {
              const meta = METRIC_META[metric];
              return (
                <div
                  key={metric}
                  className="rounded-xl bg-foreground/[0.04] p-3 ring-1 ring-border"
                >
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {meta.label}
                  </p>
                  <ul className="space-y-1.5">
                    {top.map((loja, idx) => {
                      const b = bandeiraStyles(loja.bandeira);
                      const value = loja.values[metric];
                      return (
                        <li
                          key={loja.code}
                          className="flex items-center gap-2 rounded-lg bg-foreground/5 px-2 py-1.5"
                        >
                          <span className="text-base leading-none">{PODIUM_ICONS[idx]}</span>
                          <span
                            className={cn(
                              "inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[9px] font-bold ring-1",
                              b.bg,
                              b.text,
                              b.ring,
                            )}
                          >
                            {b.label}
                          </span>
                          <span className="flex-1 truncate text-xs">{getLojaDisplay(loja.code).nome}</span>
                          <span className="font-display text-xs font-semibold tabular-nums">
                            {metric === "nps"
                              ? formatNpsDisplay(value)
                              : value?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                            <span className="ml-0.5 text-[10px] text-muted-foreground">
                              {meta.suffix}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                    {top.length === 0 && (
                      <li className="text-[11px] italic text-muted-foreground">
                        Sem dados
                      </li>
                    )}
                    {worst && (
                      <li className="mt-1 flex items-center gap-2 rounded-lg bg-red-500/10 px-2 py-1.5 ring-1 ring-red-500/30">
                        <span className="text-base leading-none">💀</span>
                        <span
                          className={cn(
                            "inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[9px] font-bold ring-1",
                            bandeiraStyles(worst.bandeira).bg,
                            bandeiraStyles(worst.bandeira).text,
                            bandeiraStyles(worst.bandeira).ring,
                          )}
                        >
                          {bandeiraStyles(worst.bandeira).label}
                        </span>
                        <span className="flex-1 truncate text-xs text-red-700 dark:text-red-200">{getLojaDisplay(worst.code).nome}</span>
                        <span className="font-display text-xs font-semibold tabular-nums text-red-700 dark:text-red-200">
                          {metric === "nps"
                            ? formatNpsDisplay(worst.values[metric])
                            : worst.values[metric]?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                          <span className="ml-0.5 text-[10px] opacity-70">{meta.suffix}</span>
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
