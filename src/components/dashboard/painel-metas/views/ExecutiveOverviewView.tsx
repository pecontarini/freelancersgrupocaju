import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  AlertTriangle,
  Clock,
  MessageSquare,
  Fish,
  Beef,
  Timer,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import {
  calcCmvCarnesStatus,
  calcCmvSalmaoStatus,
  calcConformidadeStatus,
  calcMetaStatus,
  calcNpsStatus,
  formatNpsDisplay,
} from "@/lib/metasUtils";
import {
  METRIC_META,
  RANKING_METRICS,
  snapshotToLoja,
  statusFor,
  variation,
  type RankingMetric,
} from "../shared/mockLojas";
import { MetricKpiCard } from "../shared/MetricKpiCard";
import { MetricHeatmap } from "../shared/MetricHeatmap";
import { MetricDrawer } from "../shared/MetricDrawer";
import { PainelFilters, type BrandFilter } from "../shared/PainelFilters";
import { lojaHasRankingMetric, getLojaDisplay } from "@/lib/lojaUtils";
import type { MetaKey } from "../shared/types";

interface Props {
  restrictToLojaCodigo?: string | null;
  onNavigate?: (view: MetaKey) => void;
}

interface KpiSpec {
  key: RankingMetric;
  label: string;
  icon: React.ReactNode;
  pick: (r: any) => number | null;
  pickPrev: (r: any) => number | null;
  meta: number;
  redFlag: number;
  polarity: "higher" | "lower";
  suffix: string;
  format: (v: number | null) => string;
  status: (v: number | null) => "excelente" | "bom" | "regular" | "redflag";
}

function fmtNum(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

const SPECS: KpiSpec[] = [
  {
    key: "nps",
    label: "NPS Salão",
    icon: <MessageSquare className="h-4 w-4" />,
    pick: (r) => r.nps,
    pickPrev: (r) => r.nps_anterior,
    meta: 120000,
    redFlag: 70000,
    polarity: "higher",
    suffix: "",
    format: formatNpsDisplay,
    status: (v) => calcNpsStatus(v),
  },
  {
    key: "cmv-salmao",
    label: "CMV Salmão",
    icon: <Fish className="h-4 w-4" />,
    pick: (r) => r.cmv_salmao,
    pickPrev: (r) => r.cmv_salmao_anterior,
    meta: 1.55,
    redFlag: 1.9,
    polarity: "lower",
    suffix: "kg/R$1k",
    format: fmtNum,
    status: (v) => calcCmvSalmaoStatus(v),
  },
  {
    key: "cmv-carnes",
    label: "CMV Carnes",
    icon: <Beef className="h-4 w-4" />,
    pick: (r) => r.cmv_carnes,
    pickPrev: (r) => r.cmv_carnes_anterior,
    meta: 0.6,
    redFlag: 2.0,
    polarity: "lower",
    suffix: "%",
    format: fmtNum,
    status: (v) => calcCmvCarnesStatus(v),
  },
  {
    key: "kds",
    label: "KDS · Tempo de Prato",
    icon: <Timer className="h-4 w-4" />,
    pick: (r) => r.kds,
    pickPrev: (r) => r.kds_anterior,
    meta: 5,
    redFlag: 10,
    polarity: "lower",
    suffix: "%",
    format: fmtNum,
    status: (v) => calcMetaStatus(v, 5, 10, "lower"),
  },
  {
    key: "conformidade",
    label: "Conformidade",
    icon: <ClipboardCheck className="h-4 w-4" />,
    pick: (r) => r.conformidade,
    pickPrev: (r) => r.conformidade_anterior,
    meta: 90,
    redFlag: 75,
    polarity: "higher",
    suffix: "%",
    format: fmtNum,
    status: (v) => calcConformidadeStatus(v),
  },
];

function avg(values: Array<number | null>) {
  const nums = values.filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function ExecutiveOverviewView({ restrictToLojaCodigo, onNavigate }: Props) {
  const { data: rawData, isLoading, isEmpty, error } = useMetasSnapshot();
  const [brand, setBrand] = useState<BrandFilter>("all");
  const [loja, setLoja] = useState<string | "all">("all");
  const [drawer, setDrawer] = useState<{ loja: string; metric: RankingMetric } | null>(null);

  const data = useMemo(() => {
    let d = rawData;
    if (restrictToLojaCodigo) d = d.filter((r) => r.loja_codigo === restrictToLojaCodigo);
    if (!restrictToLojaCodigo && brand !== "all") d = d.filter((r) => r.loja_codigo.startsWith(`${brand}_`));
    if (!restrictToLojaCodigo && loja !== "all") d = d.filter((r) => r.loja_codigo === loja);
    return d;
  }, [rawData, restrictToLojaCodigo, brand, loja]);

  const lojas = useMemo(() => data.map(snapshotToLoja), [data]);

  const kpis = useMemo(() => {
    return SPECS.map((spec) => {
      const eligible = data.filter((r) => lojaHasRankingMetric(r.loja_codigo, spec.key));
      const cur = avg(eligible.map(spec.pick));
      const prev = avg(eligible.map(spec.pickPrev));
      const delta = cur !== null && prev !== null
        ? (spec.polarity === "higher" ? cur - prev : prev - cur)
        : null;
      return { spec, cur, prev, delta, status: spec.status(cur) };
    });
  }, [data]);

  const ranking = useMemo(() => {
    const featuredMetric: RankingMetric = "nps";
    const meta = METRIC_META[featuredMetric];
    const sorted = [...lojas]
      .filter((l) => l.values[featuredMetric] !== null && lojaHasRankingMetric(l.code, featuredMetric))
      .sort((a, b) => {
        const av = a.values[featuredMetric]!;
        const bv = b.values[featuredMetric]!;
        return meta.polarity === "higher" ? bv - av : av - bv;
      });
    return { metric: featuredMetric, top: sorted.slice(0, 3), bottom: sorted.slice(-2).reverse() };
  }, [lojas]);

  const redFlagItems = useMemo(() => {
    const list: Array<{ loja: string; metric: RankingMetric; value: number | null }> = [];
    lojas.forEach((l) => {
      RANKING_METRICS.forEach((m) => {
        if (!lojaHasRankingMetric(l.code, m)) return;
        if (statusFor(m, l.values[m]) === "redflag") {
          list.push({ loja: l.code, metric: m, value: l.values[m] });
        }
      });
    });
    return list.slice(0, 8);
  }, [lojas]);

  const drawerSnapshot = useMemo(() => {
    if (!drawer) return null;
    return rawData.find((r) => r.loja_codigo === drawer.loja) ?? null;
  }, [drawer, rawData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <div className="glass-card p-8 text-center text-red-300 ring-1 ring-red-500/30">{error}</div>;
  }

  if (isEmpty) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 p-12 text-center ring-1 ring-amber-500/20">
        <Clock className="h-10 w-10 text-amber-400" />
        <p className="font-[Sora] text-base font-semibold text-white">
          Aguardando sincronização semanal
        </p>
        <p className="text-xs text-white/60">
          Os snapshots de metas ainda não foram gerados para este mês.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[Sora] text-xl font-bold text-white">Dashboard Executivo</h2>
          <p className="text-xs text-white/60">
            Visão consolidada de {lojas.length} loja{lojas.length === 1 ? "" : "s"} · clique em qualquer indicador para explorar
          </p>
        </div>
        <PainelFilters
          brand={brand}
          onBrandChange={(b) => {
            setBrand(b);
            setLoja("all");
          }}
          loja={loja}
          onLojaChange={setLoja}
          lockedLoja={restrictToLojaCodigo ?? null}
        />
      </div>

      {/* Faixa 1 — KPIs Hero */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map(({ spec, cur, delta, status }, i) => (
          <motion.div
            key={spec.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.35 }}
          >
            <MetricKpiCard
              label={spec.label}
              value={spec.format(cur)}
              suffix={spec.suffix}
              delta={delta}
              deltaPositiveIsGood={true}
              status={status}
              icon={spec.icon}
              onClick={onNavigate ? () => onNavigate(spec.key as MetaKey) : undefined}
            />
          </motion.div>
        ))}
      </div>

      {/* Faixa 2 — Heatmap */}
      <MetricHeatmap
        snapshots={data}
        onCellClick={(l, m) => setDrawer({ loja: l, metric: m })}
      />

      {/* Faixa 3 — Top/Bottom + Red Flags */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="vision-glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-400" />
              Pódio · {METRIC_META[ranking.metric].label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranking.top.map((l, idx) => {
              const d = getLojaDisplay(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setDrawer({ loja: l.code, metric: ranking.metric })}
                  className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 text-left ring-1 ring-white/5 transition-all hover:bg-white/10 hover:ring-primary/30"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      idx === 0 ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black" :
                      idx === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-black" :
                      "bg-gradient-to-br from-amber-700 to-amber-900 text-amber-100",
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-white/15"
                    style={{ backgroundColor: `${d.cor}30`, color: d.cor }}
                  >
                    {d.sigla}
                  </span>
                  <span className="flex-1 truncate text-sm">{d.nome}</span>
                  <span className="font-[Sora] text-sm font-semibold tabular-nums">
                    {ranking.metric === "nps"
                      ? formatNpsDisplay(l.values[ranking.metric])
                      : (l.values[ranking.metric] as number | null)?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                  </span>
                </button>
              );
            })}
            {ranking.bottom.length > 0 && (
              <div className="mt-3 border-t border-white/5 pt-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-red-300/70">
                  Atenção · piores
                </p>
                {ranking.bottom.map((l) => {
                  const d = getLojaDisplay(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setDrawer({ loja: l.code, metric: ranking.metric })}
                      className="mt-1 flex w-full items-center gap-3 rounded-xl bg-red-500/5 p-2.5 text-left ring-1 ring-red-500/20 transition-all hover:bg-red-500/15"
                    >
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-white/15"
                        style={{ backgroundColor: `${d.cor}30`, color: d.cor }}
                      >
                        {d.sigla}
                      </span>
                      <span className="flex-1 truncate text-sm text-red-100">{d.nome}</span>
                      <span className="font-[Sora] text-sm font-semibold tabular-nums text-red-200">
                        {ranking.metric === "nps"
                          ? formatNpsDisplay(l.values[ranking.metric])
                          : (l.values[ranking.metric] as number | null)?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="vision-glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Red Flags Ativos
              {redFlagItems.length > 0 && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-200 ring-1 ring-red-500/40">
                  {redFlagItems.length}
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Indicadores fora do limiar crítico — clique para investigar
            </p>
          </CardHeader>
          <CardContent>
            {redFlagItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-500/5 p-8 text-center ring-1 ring-emerald-500/20">
                <Sparkles className="h-7 w-7 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-200">
                  Nenhum red flag ativo
                </p>
                <p className="text-[11px] text-emerald-200/60">
                  Todos os indicadores acima do mínimo aceitável
                </p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {redFlagItems.map((it) => {
                  const d = getLojaDisplay(it.loja);
                  const m = METRIC_META[it.metric];
                  return (
                    <li key={`${it.loja}-${it.metric}`}>
                      <button
                        type="button"
                        onClick={() => setDrawer({ loja: it.loja, metric: it.metric })}
                        className="flex w-full items-center gap-3 rounded-xl bg-red-500/10 p-2.5 text-left ring-1 ring-red-500/30 transition-all hover:bg-red-500/20 hover:ring-red-500/60"
                      >
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-white/15"
                          style={{ backgroundColor: `${d.cor}30`, color: d.cor }}
                        >
                          {d.sigla}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-red-100">{d.nome}</p>
                          <p className="text-[10px] uppercase tracking-wider text-red-200/60">
                            {m.label}
                          </p>
                        </div>
                        <span className="font-[Sora] text-sm font-semibold tabular-nums text-red-200">
                          {it.metric === "nps"
                            ? formatNpsDisplay(it.value)
                            : it.value?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                          <span className="ml-0.5 text-[9px] opacity-70">{m.suffix}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <MetricDrawer
        open={!!drawer}
        onOpenChange={(o) => !o && setDrawer(null)}
        lojaCodigo={drawer?.loja ?? null}
        metric={drawer?.metric ?? null}
        snapshot={drawerSnapshot}
      />
    </div>
  );
}
