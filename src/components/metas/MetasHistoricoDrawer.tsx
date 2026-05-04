import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatNpsDisplay } from "@/lib/metasUtils";

export type HistoricoMetric =
  | "nps"
  | "cmv_salmao"
  | "cmv_carnes"
  | "kds"
  | "conformidade";

const METRIC_LABEL: Record<HistoricoMetric, string> = {
  nps: "NPS Salão (R$/recl.)",
  cmv_salmao: "CMV Salmão (kg/R$1k)",
  cmv_carnes: "CMV Carnes (desvio %)",
  kds: "KDS Target Preta (%)",
  conformidade: "Conformidade (%)",
};

const formatValue = (metric: HistoricoMetric, v: number | null) => {
  if (v === null) return "—";
  if (metric === "nps") return formatNpsDisplay(v);
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
};

interface MetasHistoricoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: HistoricoMetric;
  meta: number;
  /** Filtra por uma loja (opcional). Quando ausente, agrega média de todas. */
  lojaCodigo?: string | null;
  /** Quantidade de períodos a buscar (default 6). */
  limit?: number;
}

interface Point {
  label: string;
  mes_ref: string;
  value: number | null;
}

export function MetasHistoricoDrawer({
  open,
  onOpenChange,
  metric,
  meta,
  lojaCodigo,
  limit = 6,
}: MetasHistoricoDrawerProps) {
  const [series, setSeries] = useState<Point[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        let query = supabase
          .from("metas_snapshot")
          .select(`mes_ref, ${metric}, loja_codigo`)
          .order("mes_ref", { ascending: false });

        if (lojaCodigo) query = query.eq("loja_codigo", lojaCodigo);

        const { data, error: err } = await query;
        if (err) throw err;

        // Agrupa por mes_ref e calcula média
        const byMes = new Map<string, number[]>();
        (data ?? []).forEach((r: any) => {
          const v = r[metric];
          if (typeof v !== "number") return;
          if (!byMes.has(r.mes_ref)) byMes.set(r.mes_ref, []);
          byMes.get(r.mes_ref)!.push(v);
        });

        const points: Point[] = Array.from(byMes.entries())
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .slice(0, limit)
          .map(([mes_ref, vals]) => ({
            mes_ref,
            label: formatMesLabel(mes_ref),
            value: vals.reduce((s, n) => s + n, 0) / vals.length,
          }))
          .reverse();

        if (!cancelled) setSeries(points);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erro ao carregar histórico");
          setSeries([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, metric, lojaCodigo, limit]);

  const trend = useMemo(() => {
    const valid = series.filter((p) => typeof p.value === "number") as Required<Point>[];
    if (valid.length < 2) return null;
    const first = valid[0].value!;
    const last = valid[valid.length - 1].value!;
    const diff = last - first;
    return { diff, isUp: diff > 0.01, isDown: diff < -0.01 };
  }, [series]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl"
        style={{ background: "rgba(13,13,13,0.96)", backdropFilter: "blur(20px)" }}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <History className="h-4 w-4 text-amber-400" />
            Histórico · {METRIC_LABEL[metric]}
          </SheetTitle>
          <SheetDescription className="text-white/60">
            Evolução das últimas {limit} semanas{lojaCodigo ? ` · ${lojaCodigo}` : " · média da rede"}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <Skeleton className="h-72 w-full bg-white/5" />
          ) : error ? (
            <div className="rounded-xl bg-red-500/5 p-6 text-center text-sm text-red-300 ring-1 ring-red-500/20">
              {error}
            </div>
          ) : series.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-white/5 p-10 text-center ring-1 ring-white/10">
              <Clock className="h-7 w-7 text-amber-400/80" />
              <p className="text-sm font-semibold text-white">
                Aguardando sincronização semanal
              </p>
              <p className="text-xs text-white/60">
                Não há histórico disponível para esta métrica.
              </p>
            </div>
          ) : (
            <>
              {/* Trend pill */}
              {trend && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1",
                    trend.isUp && "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
                    trend.isDown && "bg-red-500/10 text-red-300 ring-red-500/30",
                    !trend.isUp && !trend.isDown && "bg-white/5 text-white/70 ring-white/15",
                  )}
                >
                  {trend.isUp ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : trend.isDown ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  Variação no período: {trend.diff > 0 ? "+" : ""}
                  {formatValue(metric, trend.diff)}
                </div>
              )}

              <div
                className="h-72 w-full rounded-2xl p-3 ring-1 ring-white/10"
                style={{
                  background:
                    "radial-gradient(80% 80% at 50% 30%, rgba(245,158,11,0.10), transparent 70%)",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 10, right: 16, bottom: 4, left: -10 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                      stroke="rgba(255,255,255,0.15)"
                    />
                    <YAxis
                      tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
                      stroke="rgba(255,255,255,0.15)"
                      tickFormatter={(v) => formatValue(metric, v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,20,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "white",
                      }}
                      formatter={(v: number) => formatValue(metric, v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }} />
                    <ReferenceLine
                      y={meta}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                      label={{
                        value: `Meta ${formatValue(metric, meta)}`,
                        position: "right",
                        fill: "#10B981",
                        fontSize: 10,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={METRIC_LABEL[metric]}
                      stroke="#F59E0B"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#F59E0B" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <ul className="divide-y divide-white/5 rounded-xl bg-white/5 ring-1 ring-white/10">
                {series.map((p) => (
                  <li
                    key={p.mes_ref}
                    className="flex items-center justify-between px-4 py-2 text-xs"
                  >
                    <span className="text-white/70">{p.label}</span>
                    <span className="font-[Sora] font-semibold tabular-nums text-white">
                      {formatValue(metric, p.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatMesLabel(mes_ref: string): string {
  // 'YYYY-MM' → 'Mai/26'
  const [y, m] = mes_ref.split("-");
  if (!y || !m) return mes_ref;
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
  return `${meses[idx]}/${y.slice(2)}`;
}
