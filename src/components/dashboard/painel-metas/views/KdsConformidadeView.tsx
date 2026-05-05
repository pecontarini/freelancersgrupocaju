import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Timer, ClipboardCheck, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import { MetricKpiCard } from "../shared/MetricKpiCard";
import { PainelFilters, type BrandFilter } from "../shared/PainelFilters";
import { getLojaDisplay, lojaHasRankingMetric } from "@/lib/lojaUtils";
import { METRIC_META, statusFor, type RankingMetric, type RankingStatus } from "../shared/mockLojas";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

interface Props {
  metric: "kds" | "conformidade";
  restrictToLojaCodigo?: string | null;
}

const STATUS_BADGE: Record<RankingStatus, string> = {
  excelente: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
  bom: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
  regular: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30",
  redflag: "bg-red-500/15 text-red-600 dark:text-red-300 ring-red-500/40",
};

const STATUS_FILL: Record<RankingStatus, string> = {
  excelente: "rgba(16,185,129,0.85)",
  bom: "rgba(245,158,11,0.85)",
  regular: "rgba(249,115,22,0.85)",
  redflag: "rgba(239,68,68,0.9)",
};

function fmt(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function KdsConformidadeView({ metric, restrictToLojaCodigo }: Props) {
  const m: RankingMetric = metric;
  const meta = METRIC_META[m];
  const Icon = metric === "kds" ? Timer : ClipboardCheck;

  const { data: snapshots, isLoading, error } = useMetasSnapshot();
  const [brand, setBrand] = useState<BrandFilter>("all");
  const [loja, setLoja] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    let d = snapshots.filter((s) => lojaHasRankingMetric(s.loja_codigo, m));
    if (restrictToLojaCodigo) d = d.filter((s) => s.loja_codigo === restrictToLojaCodigo);
    else if (brand !== "all") d = d.filter((s) => s.loja_codigo.startsWith(`${brand}_`));
    if (!restrictToLojaCodigo && loja !== "all") d = d.filter((s) => s.loja_codigo === loja);
    return d;
  }, [snapshots, m, restrictToLojaCodigo, brand, loja]);

  const pick = (r: any) => (metric === "kds" ? r.kds : r.conformidade);
  const pickPrev = (r: any) => (metric === "kds" ? r.kds_anterior : r.conformidade_anterior);

  const nums = filtered.map(pick).filter((v): v is number => typeof v === "number");
  const cur = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  const prevNums = filtered.map(pickPrev).filter((v): v is number => typeof v === "number");
  const prev = prevNums.length ? prevNums.reduce((a, b) => a + b, 0) / prevNums.length : null;
  const delta = cur !== null && prev !== null
    ? meta.polarity === "higher" ? cur - prev : prev - cur
    : null;

  const chartData = useMemo(() => {
    return filtered
      .map((s) => {
        const v = pick(s);
        return {
          code: s.loja_codigo,
          nome: getLojaDisplay(s.loja_codigo).sigla + " · " + s.loja_codigo.split("_")[1],
          value: v,
          status: statusFor(m, v),
        };
      })
      .filter((r) => r.value !== null)
      .sort((a, b) => (meta.polarity === "higher" ? (b.value! - a.value!) : (a.value! - b.value!)));
  }, [filtered, m, meta.polarity]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass-card p-8 text-center text-sm text-red-600 dark:text-red-300 ring-1 ring-red-500/30">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {metric === "kds" ? "KDS · Tempo de Prato" : "Conformidade · Auditorias"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {metric === "kds"
              ? "% de pratos fora do target preto · meta ≤ 5% · red flag ≥ 10%"
              : "Score consolidado por unidade · meta ≥ 90 · red flag < 75"}
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricKpiCard
          label="Média da rede"
          value={fmt(cur)}
          suffix={meta.suffix}
          delta={delta}
          deltaPositiveIsGood
          status={statusFor(m, cur)}
          icon={<Icon className="h-4 w-4" />}
        />
        <MetricKpiCard
          label="Meta"
          value={String(meta.meta)}
          suffix={meta.suffix}
          status="neutro"
        />
        <MetricKpiCard
          label="Lojas em Red Flag"
          value={String(chartData.filter((c) => c.status === "redflag").length)}
          status={
            chartData.some((c) => c.status === "redflag") ? "redflag" : "excelente"
          }
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comparativo entre lojas</CardTitle>
          <p className="text-xs text-muted-foreground">
            {meta.polarity === "higher" ? "Maior é melhor" : "Menor é melhor"} · cor por status
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-foreground/[0.03] p-8 text-xs text-muted-foreground ring-1 ring-border/60">
              <Clock className="h-4 w-4" />
              Sem dados nesta seleção
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="nome" tick={{ fill: "#ffffff80", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#ffffff80", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,30,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [fmt(v) + meta.suffix, meta.label]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((c) => (
                      <Cell key={c.code} fill={STATUS_FILL[c.status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhamento por loja</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5">
            {chartData.map((r, idx) => {
              const d = getLojaDisplay(r.code);
              return (
                <motion.li
                  key={r.code}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-2.5 ring-1 transition-all",
                    r.status === "redflag"
                      ? "bg-red-500/5 ring-red-500/30"
                      : "bg-foreground/[0.04] ring-border",
                  )}
                >
                  <span className="w-6 text-center text-xs font-bold tabular-nums text-muted-foreground">
                    {idx + 1}
                  </span>
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-border"
                    style={{ backgroundColor: `${d.cor}30`, color: d.cor }}
                  >
                    {d.sigla}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{d.nome}</span>
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {fmt(r.value)}
                    <span className="ml-0.5 text-[10px] text-muted-foreground">{meta.suffix}</span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                      STATUS_BADGE[r.status],
                    )}
                  >
                    {r.status === "redflag" ? "Red Flag" : r.status === "excelente" ? "Excelente" : r.status === "bom" ? "Bom" : "Regular"}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
