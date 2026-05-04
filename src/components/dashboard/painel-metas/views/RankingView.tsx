import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  METRIC_META,
  RANKING_METRICS,
  bandeiraStyles,
  snapshotToLoja,
  statusFor,
  variation,
  type RankingMetric,
} from "../shared/mockLojas";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";

const STATUS_LABEL: Record<string, string> = {
  excelente: "Excelente",
  bom: "Bom",
  regular: "Regular",
  redflag: "Crítico",
};

const STATUS_DOT: Record<string, string> = {
  excelente: "bg-emerald-500/80 ring-emerald-400/40",
  bom: "bg-amber-500/80 ring-amber-400/40",
  regular: "bg-orange-500/80 ring-orange-400/40",
  redflag: "bg-red-500/90 ring-red-400/50",
};

export function RankingView() {
  const [metric, setMetric] = useState<RankingMetric>("nps");
  const { data: snapshots, isLoading, isEmpty, error } = useMetasSnapshot();

  const lojas = useMemo(() => snapshots.map(snapshotToLoja), [snapshots]);

  const rows = useMemo(() => {
    const meta = METRIC_META[metric];
    const sorted = [...lojas].sort((a, b) => {
      const av = a.values[metric] ?? (meta.polarity === "higher" ? -Infinity : Infinity);
      const bv = b.values[metric] ?? (meta.polarity === "higher" ? -Infinity : Infinity);
      return meta.polarity === "higher" ? bv - av : av - bv;
    });
    return sorted.map((loja, idx) => {
      const value = loja.values[metric];
      const prev = loja.prev[metric];
      const v = variation(metric, value, prev);
      const status = statusFor(metric, value);
      const isRed = status === "redflag" || loja.redFlag;
      return { loja, value, prev, variation: v, status, isRed, position: idx + 1 };
    });
  }, [lojas, metric]);

  return (
    <Card className="vision-glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-amber-500" />
          Ranking de Lojas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ordenação por métrica · top performers e red flags da rede
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as RankingMetric)}>
          <TabsList className="vision-glass mb-4 h-auto flex-wrap gap-1 bg-transparent p-1">
            {RANKING_METRICS.map((m) => (
              <TabsTrigger
                key={m}
                value={m}
                className="text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
              >
                {METRIC_META[m].label}
              </TabsTrigger>
            ))}
          </TabsList>

          {RANKING_METRICS.map((m) => (
            <TabsContent key={m} value={m} className="mt-0">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-xl bg-red-500/5 p-6 text-center text-sm text-red-300 ring-1 ring-red-500/20">
                  Erro ao carregar metas: {error}
                </div>
              ) : isEmpty ? (
                <EmptyState />
              ) : (
                <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="w-16 text-center">#</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Variação</TableHead>
                        <TableHead className="text-center">Red Flag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, idx) => {
                        const b = bandeiraStyles(r.loja.bandeira);
                        const trendUp = r.variation > 0.01;
                        const trendDown = r.variation < -0.01;
                        const isPodium = r.position <= 3;
                        return (
                          <motion.tr
                            key={r.loja.code}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: idx * 0.025 }}
                            className={cn(
                              "border-white/5 transition-colors",
                              "hover:bg-white/5",
                              r.isRed && "bg-red-500/5",
                            )}
                          >
                            <TableCell className="text-center">
                              <span
                                className={cn(
                                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                                  isPodium
                                    ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.45)]"
                                    : "bg-white/10 text-white/80",
                                )}
                              >
                                {r.position}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[10px] font-bold tracking-wider ring-1",
                                    b.bg,
                                    b.text,
                                    b.ring,
                                  )}
                                >
                                  {b.label}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {r.loja.code}
                                  </p>
                                  <p className="truncate text-[11px] text-muted-foreground">
                                    {r.loja.nome}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-[Sora] font-semibold">
                              {r.value !== null
                                ? r.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                                : "—"}
                              <span className="ml-0.5 text-xs text-muted-foreground">
                                {METRIC_META[m].suffix}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] ring-1 ring-white/10">
                                <span
                                  className={cn(
                                    "inline-block h-2 w-2 rounded-full ring-2",
                                    STATUS_DOT[r.status],
                                  )}
                                />
                                {STATUS_LABEL[r.status]}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs tabular-nums",
                                  trendUp && "text-emerald-400",
                                  trendDown && "text-red-400",
                                  !trendUp && !trendDown && "text-muted-foreground",
                                )}
                              >
                                {trendUp ? (
                                  <TrendingUp className="h-3.5 w-3.5" />
                                ) : trendDown ? (
                                  <TrendingDown className="h-3.5 w-3.5" />
                                ) : (
                                  <Minus className="h-3.5 w-3.5" />
                                )}
                                {Math.abs(r.variation).toLocaleString("pt-BR", {
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {r.isRed ? (
                                <motion.span
                                  animate={{ opacity: [1, 0.4, 1] }}
                                  transition={{ duration: 1.6, repeat: Infinity }}
                                  className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300 ring-1 ring-red-500/40"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Red Flag
                                </motion.span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-white/5 p-10 text-center ring-1 ring-white/10">
      <Clock className="h-8 w-8 text-amber-400/80" />
      <div>
        <p className="text-sm font-semibold text-foreground">Aguardando sincronização semanal</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Nenhum snapshot de metas disponível para o mês corrente.
        </p>
      </div>
    </div>
  );
}
