import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceDot,
} from "recharts";
import { TrendingDown, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberPt } from "./dateUtils";
import { bestOf, META_DEFINITIONS, worstOf } from "./metas";
import type { MetaKey, MonthValue } from "./types";

interface SixMonthsCardProps {
  metaKey: MetaKey;
  series: MonthValue[];
  loading?: boolean;
  /** Nome da loja exibido no header (ex.: "Caminito SIG"). */
  unitName: string | null;
  /** Para meses sem dado, mostrar mensagem. */
  emptyText?: string;
  /** Override do formatador de valor (ex.: "1,71kg"). */
  formatValue?: (v: number | null) => string;
}

/**
 * Comparativo dos últimos 6 meses LIMITADO à loja do usuário.
 * Mostra: valor do mês atual + melhor mês + pior mês + sparkline interativo.
 */
export function SixMonthsCard({
  metaKey,
  series,
  loading,
  unitName,
  emptyText = "Sem dados suficientes nos últimos 6 meses",
  formatValue,
}: SixMonthsCardProps) {
  const def = META_DEFINITIONS[metaKey];
  const polarity = def.polarity ?? "higher";
  const suffix = def.unitSuffix ?? "";

  const fmt = formatValue ?? ((v: number | null) => (v === null ? "—" : `${formatNumberPt(v, 2)}${suffix}`));

  const { current, best, worst, hasData } = useMemo(() => {
    const valid = series.filter((s) => typeof s.value === "number");
    const cur = series[series.length - 1] ?? null;
    const bestVal = bestOf(valid.map((s) => s.value), polarity);
    const worstVal = worstOf(valid.map((s) => s.value), polarity);

    return {
      current: cur,
      best: bestVal !== null ? valid.find((s) => s.value === bestVal) ?? null : null,
      worst: worstVal !== null ? valid.find((s) => s.value === worstVal) ?? null : null,
      hasData: valid.length > 0,
    };
  }, [series, polarity]);

  const variation = (a: number | null | undefined, b: number | null | undefined): number | null => {
    if (typeof a !== "number" || typeof b !== "number" || b === 0) return null;
    return ((a - b) / Math.abs(b)) * 100;
  };

  const deltaVsBest = variation(current?.value ?? null, best?.value ?? null);
  const deltaVsWorst = variation(current?.value ?? null, worst?.value ?? null);

  const chartData = useMemo(
    () => series.map((s) => ({ mes: s.label, value: s.value })),
    [series]
  );

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[180px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card relative overflow-hidden ring-1 ring-primary/20">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Sua loja · Últimos 6 meses
          </CardTitle>
          {unitName ? (
            <Badge variant="outline" className="text-[10px] font-semibold uppercase">
              {unitName}
            </Badge>
          ) : null}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Comparativo do mês atual com o melhor e o pior dos últimos 6 meses
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {!hasData ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 px-4 py-8 text-center text-xs text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SummaryTile
                label={`Atual · ${current?.label ?? "—"}`}
                value={fmt(current?.value ?? null)}
                tone="current"
              />
              <SummaryTile
                label={`Melhor · ${best?.label ?? "—"}`}
                value={fmt(best?.value ?? null)}
                hint={
                  deltaVsBest !== null && current?.label !== best?.label
                    ? `${deltaVsBest > 0 ? "+" : ""}${deltaVsBest.toFixed(1)}% vs atual`
                    : current?.label === best?.label
                    ? "Você está no melhor mês"
                    : undefined
                }
                tone="best"
              />
              <SummaryTile
                label={`Pior · ${worst?.label ?? "—"}`}
                value={fmt(worst?.value ?? null)}
                hint={
                  deltaVsWorst !== null && current?.label !== worst?.label
                    ? `${deltaVsWorst > 0 ? "+" : ""}${deltaVsWorst.toFixed(1)}% vs atual`
                    : undefined
                }
                tone="worst"
              />
            </div>

            <div className="h-[160px] w-full" style={{ touchAction: "pan-y" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${metaKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <RTooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--background))",
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [fmt(v), "Valor"]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill={`url(#grad-${metaKey})`}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                    connectNulls
                  />
                  {best && best.label === current?.label ? null : best ? (
                    <ReferenceDot
                      x={best.label}
                      y={best.value ?? 0}
                      r={5}
                      fill="hsl(var(--primary))"
                      stroke="white"
                      strokeWidth={2}
                    />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface SummaryTileProps {
  label: string;
  value: string;
  hint?: string;
  tone: "current" | "best" | "worst";
}

function SummaryTile({ label, value, hint, tone }: SummaryTileProps) {
  const Icon = tone === "best" ? TrendingUp : tone === "worst" ? TrendingDown : CalendarIcon;
  const toneClasses = {
    current: "border-primary/30 bg-primary/5",
    best: "border-emerald-300/40 bg-emerald-50/40 dark:border-emerald-500/20 dark:bg-emerald-900/10",
    worst: "border-red-300/40 bg-red-50/40 dark:border-red-500/20 dark:bg-red-900/10",
  }[tone];
  const iconClasses = {
    current: "text-primary",
    best: "text-emerald-600 dark:text-emerald-400",
    worst: "text-destructive",
  }[tone];

  return (
    <div className={cn("rounded-lg border p-3", toneClasses)}>
      <div className="flex items-center justify-between gap-1">
        <span className="line-clamp-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClasses)} />
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums leading-none">{value}</div>
      {hint ? (
        <div className={cn("mt-1.5 text-[10px] font-medium", iconClasses)}>{hint}</div>
      ) : null}
    </div>
  );
}
