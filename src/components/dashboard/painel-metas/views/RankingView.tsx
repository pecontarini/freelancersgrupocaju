import { getLojaDisplay, lojaHasRankingMetric } from "@/lib/lojaUtils";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, AlertTriangle, Clock, Download, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type RankingMetric,
  type RankingStatus,
} from "../shared/mockLojas";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import { formatNpsDisplay } from "@/lib/metasUtils";

const STATUS_CELL: Record<RankingStatus, string> = {
  excelente: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 ring-emerald-500/30",
  bom: "bg-amber-500/15 text-amber-700 dark:text-amber-200 ring-amber-500/30",
  regular: "bg-orange-500/15 text-orange-200 ring-orange-500/30",
  redflag: "bg-red-500/20 text-red-700 dark:text-red-200 ring-red-500/40",
};

function formatVal(metric: RankingMetric, value: number | null): string {
  if (value === null) return "—";
  if (metric === "nps") return formatNpsDisplay(value);
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function RankingView() {
  const [sortBy, setSortBy] = useState<RankingMetric>("nps");
  const { data: snapshots, isLoading, isEmpty, error } = useMetasSnapshot();
  const lojas = useMemo(() => snapshots.map(snapshotToLoja), [snapshots]);

  const sorted = useMemo(() => {
    const meta = METRIC_META[sortBy];
    return [...lojas].sort((a, b) => {
      const av = a.values[sortBy] ?? (meta.polarity === "higher" ? -Infinity : Infinity);
      const bv = b.values[sortBy] ?? (meta.polarity === "higher" ? -Infinity : Infinity);
      return meta.polarity === "higher" ? bv - av : av - bv;
    });
  }, [lojas, sortBy]);

  const exportCSV = () => {
    const header = ["Posicao", "Loja", "Nome", "Bandeira", ...RANKING_METRICS.map((m) => METRIC_META[m].label), "RedFlag"];
    const lines = sorted.map((l, idx) =>
      [
        idx + 1,
        l.code,
        `"${l.nome.replace(/"/g, '""')}"`,
        l.bandeira,
        ...RANKING_METRICS.map((m) => l.values[m] ?? ""),
        l.redFlag ? "true" : "false",
      ].join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ranking-lojas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="vision-glass">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-500" />
              Ranking de Lojas — Visão Matricial
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Todas as lojas × todas as métricas · células coloridas por status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Ordenar por
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as RankingMetric)}>
              <SelectTrigger className="vision-glass h-8 w-[200px] border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANKING_METRICS.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {METRIC_META[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={isLoading || isEmpty}
              className="vision-glass h-8 gap-1.5 border-border text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-500/5 p-6 text-center text-sm text-red-600 dark:text-red-300 ring-1 ring-red-500/20">
            Erro ao carregar metas: {error}
          </div>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Loja</TableHead>
                  {RANKING_METRICS.map((m) => (
                    <TableHead
                      key={m}
                      className={cn(
                        "text-center text-[10px] uppercase tracking-wider",
                        m === sortBy && "text-primary",
                      )}
                    >
                      {METRIC_META[m].label}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Red Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((loja, idx) => {
                  const b = bandeiraStyles(loja.bandeira);
                  const isPodium = idx < 3;
                  return (
                    <motion.tr
                      key={loja.code}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.02 }}
                      className={cn(
                        "border-white/5 hover:bg-foreground/5",
                        loja.redFlag && "bg-red-500/5",
                      )}
                    >
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                            isPodium
                              ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-[0_0_12px_rgba(245,158,11,0.45)]"
                              : "bg-foreground/10 text-foreground/90",
                          )}
                        >
                          {idx + 1}
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
                            <p className="text-sm font-medium text-foreground">{getLojaDisplay(loja.code).nome}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {loja.code}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      {RANKING_METRICS.map((m) => {
                        const v = loja.values[m];
                        const applies = lojaHasRankingMetric(loja.code, m);
                        if (!applies) {
                          return (
                            <TableCell key={m} className="text-center">
                              <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-md px-2 py-1 text-xs text-muted-foreground">
                                —
                              </span>
                            </TableCell>
                          );
                        }
                        const status = statusFor(m, v);
                        return (
                          <TableCell key={m} className="text-center">
                            <span
                              className={cn(
                                "inline-flex min-w-[3.5rem] items-center justify-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums ring-1",
                                STATUS_CELL[status],
                                m === sortBy && "ring-2",
                              )}
                            >
                              {formatVal(m, v)}
                              {v !== null && (
                                <span className="ml-0.5 text-[9px] opacity-70">
                                  {METRIC_META[m].suffix}
                                </span>
                              )}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        {loja.redFlag ? (
                          <motion.span
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ duration: 1.6, repeat: Infinity }}
                            className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-300 ring-1 ring-red-500/40"
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
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-foreground/5 p-10 text-center ring-1 ring-border">
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
