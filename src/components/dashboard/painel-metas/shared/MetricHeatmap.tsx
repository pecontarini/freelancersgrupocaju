import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  METRIC_META,
  RANKING_METRICS,
  normalizeMetric,
  snapshotToLoja,
  statusFor,
  type RankingMetric,
} from "./mockLojas";
import { lojaHasRankingMetric, getLojaDisplay } from "@/lib/lojaUtils";
import type { MetaSnapshotRow } from "@/hooks/useMetasSnapshot";
import { formatNpsDisplay } from "@/lib/metasUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";

interface Props {
  snapshots: MetaSnapshotRow[];
  onCellClick?: (lojaCodigo: string, metric: RankingMetric) => void;
}

const STATUS_BG: Record<string, string> = {
  excelente: "bg-emerald-500/25 hover:bg-emerald-500/40 ring-emerald-400/30",
  bom: "bg-amber-500/25 hover:bg-amber-500/40 ring-amber-400/30",
  regular: "bg-orange-500/25 hover:bg-orange-500/45 ring-orange-400/30",
  redflag: "bg-red-500/30 hover:bg-red-500/50 ring-red-400/40",
};

function formatVal(metric: RankingMetric, value: number | null) {
  if (value === null) return "—";
  if (metric === "nps") return formatNpsDisplay(value);
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function MetricHeatmap({ snapshots, onCellClick }: Props) {
  const lojas = useMemo(() => snapshots.map(snapshotToLoja), [snapshots]);
  const [hover, setHover] = useState<{ row: string; col: RankingMetric } | null>(null);

  if (lojas.length === 0) {
    return null;
  }

  return (
    <Card className="vision-glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-primary" />
          Heatmap · Loja × Métrica
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Clique em uma célula para abrir o detalhe da loja na métrica selecionada
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[640px] gap-1.5"
            style={{
              gridTemplateColumns: `200px repeat(${RANKING_METRICS.length}, minmax(110px, 1fr))`,
            }}
          >
            <div />
            {RANKING_METRICS.map((m) => (
              <div
                key={m}
                className={cn(
                  "px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider transition-colors",
                  hover?.col === m ? "text-primary" : "text-white/60",
                )}
              >
                {METRIC_META[m].label}
              </div>
            ))}

            {lojas.map((loja) => (
              <div key={loja.code} className="contents">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors",
                    hover?.row === loja.code && "bg-white/5",
                  )}
                >
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-white/15"
                    style={{ backgroundColor: `${getLojaDisplay(loja.code).cor}30`, color: getLojaDisplay(loja.code).cor }}
                  >
                    {getLojaDisplay(loja.code).sigla}
                  </span>
                  <span className="truncate font-medium">{getLojaDisplay(loja.code).nome}</span>
                </div>
                {RANKING_METRICS.map((m) => {
                  const v = loja.values[m];
                  const applies = lojaHasRankingMetric(loja.code, m);
                  if (!applies) {
                    return (
                      <div
                        key={m}
                        className="flex items-center justify-center rounded-lg bg-white/[0.02] py-2 text-xs text-white/30 ring-1 ring-white/5"
                      >
                        —
                      </div>
                    );
                  }
                  const s = statusFor(m, v);
                  return (
                    <motion.button
                      key={m}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onMouseEnter={() => setHover({ row: loja.code, col: m })}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onCellClick?.(loja.code, m)}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-lg px-2 py-2 text-xs font-semibold tabular-nums ring-1 transition-all",
                        STATUS_BG[s],
                        hover?.row === loja.code && hover?.col === m && "ring-2 ring-primary",
                      )}
                      style={{
                        opacity: 0.6 + (normalizeMetric(m, v) / 100) * 0.4,
                      }}
                    >
                      <span>{formatVal(m, v)}</span>
                      <span className="mt-0.5 text-[9px] opacity-60">{METRIC_META[m].suffix}</span>
                    </motion.button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
