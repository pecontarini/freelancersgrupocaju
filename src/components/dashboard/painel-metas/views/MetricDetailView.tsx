import { getLojaDisplay, lojaHasRankingMetric } from "@/lib/lojaUtils";
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CalendarDays,
  CircleDollarSign,
} from "lucide-react";
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
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import { currentMesRef, formatNpsDisplay } from "@/lib/metasUtils";
import {
  METRIC_META,
  bandeiraStyles,
  normalizeMetric,
  snapshotToLoja,
  statusFor,
  variation,
  type RankingMetric,
  type RankingStatus,
} from "../shared/mockLojas";
import { METAS_CARGO_CONFIG, STATUS_LABEL_PT } from "../shared/cargosConfig";
import { META_DEFINITIONS } from "../shared/metas";

const STATUS_DOT: Record<RankingStatus, string> = {
  excelente: "bg-emerald-500/80 ring-emerald-400/40",
  bom: "bg-amber-500/80 ring-amber-400/40",
  regular: "bg-orange-500/80 ring-orange-400/40",
  redflag: "bg-red-500/90 ring-red-400/50",
};

const STATUS_BAR: Record<RankingStatus, string> = {
  excelente: "bg-emerald-500/70",
  bom: "bg-amber-500/70",
  regular: "bg-orange-500/70",
  redflag: "bg-red-500/80",
};

const STATUS_BADGE: Record<RankingStatus, string> = {
  excelente: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
  bom: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
  regular: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30",
  redflag: "bg-red-500/15 text-red-600 dark:text-red-300 ring-red-500/40",
};

interface Props {
  metric: RankingMetric;
  /** Se definido, restringe ranking e cargos à loja indicada (gerente_unidade). */
  restrictToLojaCodigo?: string | null;
  /** Quando true, oculta o bloco de Variável por Cargo (operator não-admin). */
  hideCargoTabs?: boolean;
}

function formatMonthLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatValue(metric: RankingMetric, value: number | null): string {
  if (value === null) return "—";
  if (metric === "nps") return formatNpsDisplay(value);
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function MetricDetailView({ metric, restrictToLojaCodigo, hideCargoTabs }: Props) {
  const { data: rawSnapshots, isLoading, isEmpty, error } = useMetasSnapshot();
  const snapshots = useMemo(
    () =>
      restrictToLojaCodigo
        ? rawSnapshots.filter((s) => s.loja_codigo === restrictToLojaCodigo)
        : rawSnapshots,
    [rawSnapshots, restrictToLojaCodigo],
  );
  const lojas = useMemo(() => snapshots.map(snapshotToLoja), [snapshots]);
  const meta = METRIC_META[metric];
  const def = META_DEFINITIONS[metric];

  const rows = useMemo(() => {
    const eligible = lojas.filter((l) => lojaHasRankingMetric(l.code, metric));
    const naLojas = lojas.filter((l) => !lojaHasRankingMetric(l.code, metric));
    const sorted = [...eligible].sort((a, b) => {
      const av = a.values[metric] ?? (meta.polarity === "higher" ? -Infinity : Infinity);
      const bv = b.values[metric] ?? (meta.polarity === "higher" ? -Infinity : Infinity);
      return meta.polarity === "higher" ? bv - av : av - bv;
    });
    const eligibleRows = sorted.map((loja, idx) => {
      const value = loja.values[metric];
      const prev = loja.prev[metric];
      const status = statusFor(metric, value);
      return {
        loja,
        value,
        prev,
        variation: variation(metric, value, prev),
        status,
        norm: normalizeMetric(metric, value),
        isRed: status === "redflag" || loja.redFlag,
        position: idx + 1,
        naMetric: false,
      };
    });
    const naRows = naLojas.map((loja) => ({
      loja,
      value: null as number | null,
      prev: null as number | null,
      variation: 0,
      status: "regular" as RankingStatus,
      norm: 0,
      isRed: false,
      position: 0,
      naMetric: true,
    }));
    return [...eligibleRows, ...naRows];
  }, [lojas, metric, meta.polarity]);

  const counts = useMemo(() => {
    const c: Record<RankingStatus, number> = { excelente: 0, bom: 0, regular: 0, redflag: 0 };
    rows.forEach((r) => {
      if (r.naMetric) return;
      c[r.status]++;
    });
    return c;
  }, [rows]);

  const cargos = METAS_CARGO_CONFIG[metric];
  const mesRef = currentMesRef();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center text-sm text-red-600 dark:text-red-300 ring-1 ring-red-500/30">
        Erro ao carregar métricas: {error}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 p-12 text-center ring-1 ring-amber-500/20">
        <Clock className="h-10 w-10 text-amber-400" />
        <p className="text-base font-semibold text-foreground">
          Aguardando sincronização
        </p>
        <p className="text-xs text-muted-foreground">
          Nenhum snapshot de metas para este mês ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header da métrica ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(255,255,255,0.02))",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{def.label}</h2>
            <p className="mt-1 font-[DM_Sans] text-sm text-muted-foreground">{def.description}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground/70">
              {meta.label}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-xs text-foreground/90 ring-1 ring-border">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatMonthLabel(mesRef)}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          {(["excelente", "bom", "regular", "redflag"] as RankingStatus[]).map((s) => (
            <span
              key={s}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1",
                STATUS_BADGE[s],
              )}
            >
              <span className={cn("h-2 w-2 rounded-full ring-2", STATUS_DOT[s])} />
              {counts[s]} {STATUS_LABEL_PT[s]}
            </span>
          ))}
        </div>
      </motion.div>

      {/* ── Ranking de Lojas ────────────────────────────────── */}
      <Card className="vision-glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ranking de Lojas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ordenado do melhor para o pior · barra proporcional ao desempenho
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden rounded-b-xl">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="min-w-[140px]">Desempenho</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Δ vs anterior</TableHead>
                  <TableHead className="text-center">Red Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => {
                  const b = bandeiraStyles(r.loja.bandeira);
                  const trendUp = r.variation > 0.01;
                  const trendDown = r.variation < -0.01;
                  return (
                    <motion.tr
                      key={r.loja.code}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.02 }}
                      className={cn(
                        "border-border/60 transition-colors hover:bg-foreground/5",
                        r.isRed && "animate-pulse bg-red-500/5",
                      )}
                    >
                      <TableCell className="text-center text-xs font-bold tabular-nums text-foreground/90">
                        {r.naMetric ? "—" : r.position}
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
                            <p className="text-sm font-medium text-foreground">
                              {getLojaDisplay(r.loja.code).nome}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {r.loja.code}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      {r.naMetric ? (
                        <>
                          <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                          <TableCell>
                            <span className="text-[11px] italic text-muted-foreground">Não se aplica</span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">—</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">—</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">—</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right tabular-nums text-sm font-semibold">
                            {formatValue(metric, r.value)}
                            <span className="ml-0.5 text-[10px] text-muted-foreground">
                              {meta.suffix}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                            {meta.meta}
                            {meta.suffix}
                          </TableCell>
                          <TableCell>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/5">
                              <div
                                className={cn("h-full transition-all", STATUS_BAR[r.status])}
                                style={{ width: `${Math.max(2, r.norm)}%` }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ring-1",
                                STATUS_BADGE[r.status],
                              )}
                            >
                              <span className={cn("h-2 w-2 rounded-full ring-2", STATUS_DOT[r.status])} />
                              {STATUS_LABEL_PT[r.status]}
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
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-300 ring-1 ring-red-500/40">
                                <AlertTriangle className="h-3 w-3" />
                                Red Flag
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </>
                      )}
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Abas por Cargo ──────────────────────────────────── */}
      {!hideCargoTabs && cargos && cargos.length > 0 && (
        <Card className="vision-glass">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CircleDollarSign className="h-4 w-4 text-amber-400" />
              Variável por Cargo
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cargos responsáveis por essa métrica e valores em R$ por desempenho
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={cargos[0].cargoKey}>
              <TabsList className="vision-glass mb-4 h-auto flex-wrap gap-1 bg-transparent p-1">
                {cargos.map((c) => (
                  <TabsTrigger
                    key={c.cargoKey}
                    value={c.cargoKey}
                    className="gap-2 text-[11px] font-semibold uppercase tracking-wide data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
                  >
                    {c.cargoLabel}
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-300">
                      R$ {c.pesoReais.toLocaleString("pt-BR")}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {cargos.map((c) => (
                <TabsContent key={c.cargoKey} value={c.cargoKey} className="mt-0 space-y-4">
                  {/* Faixas de pontuação */}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {(["excelente", "bom", "regular", "redflag"] as RankingStatus[]).map(
                      (s) => (
                        <div
                          key={s}
                          className={cn(
                            "rounded-xl px-3 py-3 ring-1",
                            STATUS_BADGE[s],
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
                            <span className={cn("h-2 w-2 rounded-full ring-2", STATUS_DOT[s])} />
                            {STATUS_LABEL_PT[s]}
                          </div>
                          <div className="mt-1 text-lg font-bold tabular-nums">
                            R$ {c.faixas[s].toLocaleString("pt-BR")}
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  {/* Status por loja */}
                  <div className="overflow-hidden rounded-xl ring-1 ring-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead>Loja</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">
                            Variável recebida
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r) => {
                          const b = bandeiraStyles(r.loja.bandeira);
                          const valor = c.faixas[r.status];
                          return (
                            <TableRow
                              key={r.loja.code}
                              className={cn(
                                "border-border/60 hover:bg-foreground/5",
                                r.isRed && "bg-red-500/5",
                              )}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[10px] font-bold ring-1",
                                      b.bg,
                                      b.text,
                                      b.ring,
                                    )}
                                  >
                                    {b.label}
                                  </span>
                                  <span className="text-sm">{getLojaDisplay(r.loja.code).nome}</span>
                                </div>
                              </TableCell>
                              {r.naMetric ? (
                                <>
                                  <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                                  <TableCell className="text-center text-xs italic text-muted-foreground">
                                    Não se aplica
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-muted-foreground">R$ —</TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="text-right tabular-nums text-sm font-semibold">
                                    {formatValue(metric, r.value)}
                                    <span className="ml-0.5 text-[10px] text-muted-foreground">
                                      {meta.suffix}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] ring-1",
                                        STATUS_BADGE[r.status],
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "h-2 w-2 rounded-full ring-2",
                                          STATUS_DOT[r.status],
                                        )}
                                      />
                                      {STATUS_LABEL_PT[r.status]}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    <span
                                      className={cn(
                                        "text-sm font-bold",
                                        valor === c.pesoReais && "text-emerald-700 dark:text-emerald-300",
                                        valor === 0 && "text-red-600 dark:text-red-300",
                                        valor > 0 && valor < c.pesoReais && "text-amber-700 dark:text-amber-300",
                                      )}
                                    >
                                      R$ {valor.toLocaleString("pt-BR")}
                                    </span>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
