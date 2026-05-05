import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Fish, Beef, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import { MetricKpiCard } from "../shared/MetricKpiCard";
import { PainelFilters, type BrandFilter } from "../shared/PainelFilters";
import { getLojaDisplay, lojaHasRankingMetric } from "@/lib/lojaUtils";
import { METRIC_META, statusFor, type RankingMetric, type RankingStatus } from "../shared/mockLojas";

interface Props {
  variant: "salmao" | "carnes";
  restrictToLojaCodigo?: string | null;
}

const STATUS_BAR: Record<RankingStatus, string> = {
  excelente: "bg-emerald-500/70",
  bom: "bg-amber-500/70",
  regular: "bg-orange-500/70",
  redflag: "bg-red-500/80",
};

const STATUS_BADGE: Record<RankingStatus, string> = {
  excelente: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  bom: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  regular: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  redflag: "bg-red-500/15 text-red-300 ring-red-500/40",
};

const STATUS_LABEL: Record<RankingStatus, string> = {
  excelente: "Excelente",
  bom: "Bom",
  regular: "Regular",
  redflag: "Red Flag",
};

function fmt(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function CmvDetailView({ variant, restrictToLojaCodigo }: Props) {
  const metric: RankingMetric = variant === "salmao" ? "cmv-salmao" : "cmv-carnes";
  const meta = METRIC_META[metric];
  const fixedBrand: BrandFilter = variant === "salmao" ? "NZ" : "CP";
  const Icon = variant === "salmao" ? Fish : Beef;

  const { data: snapshots, isLoading, error } = useMetasSnapshot();
  const [loja, setLoja] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    let d = snapshots.filter((s) => lojaHasRankingMetric(s.loja_codigo, metric));
    if (restrictToLojaCodigo) d = d.filter((s) => s.loja_codigo === restrictToLojaCodigo);
    else if (loja !== "all") d = d.filter((s) => s.loja_codigo === loja);
    return d;
  }, [snapshots, metric, restrictToLojaCodigo, loja]);

  const pick = (r: any) => (variant === "salmao" ? r.cmv_salmao : r.cmv_carnes);
  const pickPrev = (r: any) =>
    variant === "salmao" ? r.cmv_salmao_anterior : r.cmv_carnes_anterior;

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const cur = avg(filtered.map(pick).filter((v): v is number => typeof v === "number"));
  const prev = avg(filtered.map(pickPrev).filter((v): v is number => typeof v === "number"));
  const delta = cur !== null && prev !== null ? prev - cur : null;
  const status: RankingStatus = statusFor(metric, cur);

  const rows = useMemo(() => {
    return [...filtered]
      .map((s) => {
        const v = pick(s);
        const p = pickPrev(s);
        return { code: s.loja_codigo, value: v, prev: p, status: statusFor(metric, v) };
      })
      .sort((a, b) => {
        const av = a.value ?? Infinity;
        const bv = b.value ?? Infinity;
        return av - bv;
      });
  }, [filtered, metric]);

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
      <div className="glass-card p-8 text-center text-sm text-red-300 ring-1 ring-red-500/30">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[Sora] text-xl font-bold text-white">
            {variant === "salmao" ? "CMV Salmão · Nazo" : "CMV Carnes · Caminito"}
          </h2>
          <p className="text-xs text-white/60">
            {variant === "salmao"
              ? "kg consumidos por R$1.000 faturado · meta 1,55 · red flag 1,90"
              : "Desvio % sobre valor transferido · meta 0,6% · red flag 2,0%"}
          </p>
        </div>
        <PainelFilters
          brand={fixedBrand}
          onBrandChange={() => {}}
          loja={loja}
          onLojaChange={setLoja}
          lockedLoja={restrictToLojaCodigo ?? null}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricKpiCard
          label={variant === "salmao" ? "Média kg/R$1k" : "Média desvio %"}
          value={fmt(cur)}
          suffix={meta.suffix}
          delta={delta}
          deltaPositiveIsGood
          status={status === "redflag" ? "redflag" : status}
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
          value={String(rows.filter((r) => r.status === "redflag").length)}
          status={
            rows.some((r) => r.status === "redflag") ? "redflag" : "excelente"
          }
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Ranking por unidade · {variant === "salmao" ? "Nazo" : "Caminito"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Ordenado do menor (melhor) para o maior (pior)
          </p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.02] p-8 text-xs text-white/50 ring-1 ring-white/5">
              <Clock className="h-4 w-4" />
              Sem snapshots para esta marca neste mês
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r, idx) => {
                const d = getLojaDisplay(r.code);
                const dlt =
                  r.value !== null && r.prev !== null ? r.prev - r.value : null;
                const better = dlt !== null && dlt > 0;
                return (
                  <motion.li
                    key={r.code}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={cn(
                      "rounded-xl p-3 ring-1 transition-all",
                      r.status === "redflag"
                        ? "bg-red-500/5 ring-red-500/30"
                        : "bg-white/[0.03] ring-white/10 hover:bg-white/5",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-xs font-bold tabular-nums text-white/60">
                        {idx + 1}
                      </span>
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-white/15"
                        style={{ backgroundColor: `${d.cor}30`, color: d.cor }}
                      >
                        {d.sigla}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{d.nome}</p>
                        <p className="text-[10px] text-white/40">{r.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-[Sora] text-base font-bold tabular-nums text-white">
                          {fmt(r.value)}
                          <span className="ml-1 text-[10px] text-white/50">{meta.suffix}</span>
                        </p>
                        {dlt !== null && (
                          <p
                            className={cn(
                              "text-[10px] tabular-nums",
                              better ? "text-emerald-300" : "text-red-300",
                            )}
                          >
                            {better ? "▼" : "▲"} {Math.abs(dlt).toFixed(2)} vs anterior
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                          STATUS_BADGE[r.status],
                        )}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/5">
                      <div
                        className={cn("h-full rounded-full transition-all", STATUS_BAR[r.status])}
                        style={{
                          width: `${Math.min(
                            100,
                            r.value === null
                              ? 0
                              : Math.max(2, ((meta.redFlag - r.value) / (meta.redFlag - meta.meta)) * 100),
                          )}%`,
                        }}
                      />
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
