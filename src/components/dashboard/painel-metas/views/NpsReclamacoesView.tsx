import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, AlertTriangle, Clock, TrendingUp, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useReclamacoes, type FonteReclamacao } from "@/hooks/useReclamacoes";
import { useLojaCodigoMap } from "../shared/useLojaCodigoMap";
import { getLojaDisplay } from "@/lib/lojaUtils";
import { PainelFilters, type BrandFilter } from "../shared/PainelFilters";
import { MetricKpiCard } from "../shared/MetricKpiCard";
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
import { format } from "date-fns";

interface Props {
  restrictToLojaCodigo?: string | null;
}

const FONTE_LABEL: Record<FonteReclamacao, string> = {
  google: "Google",
  ifood: "iFood",
  tripadvisor: "TripAdvisor",
  getin: "GetIn",
  manual: "Manual",
  sheets: "Sheets",
};

export function NpsReclamacoesView({ restrictToLojaCodigo }: Props) {
  const { reclamacoes, isLoading } = useReclamacoes();
  const { data: lojaMap } = useLojaCodigoMap();
  const [brand, setBrand] = useState<BrandFilter>("all");
  const [loja, setLoja] = useState<string | "all">("all");
  const [tema, setTema] = useState<string | null>(null);

  const idToCodigo = lojaMap?.idToCodigo ?? {};
  const currentMonth = format(new Date(), "yyyy-MM");

  const filtered = useMemo(() => {
    return reclamacoes.filter((r) => {
      const code = idToCodigo[r.loja_id];
      if (!code) return false;
      if (restrictToLojaCodigo && code !== restrictToLojaCodigo) return false;
      if (!restrictToLojaCodigo && brand !== "all" && !code.startsWith(`${brand}_`))
        return false;
      if (!restrictToLojaCodigo && loja !== "all" && code !== loja) return false;
      if (tema && !(r.temas ?? []).includes(tema)) return false;
      return true;
    });
  }, [reclamacoes, idToCodigo, restrictToLojaCodigo, brand, loja, tema]);

  const monthly = useMemo(
    () => filtered.filter((r) => r.referencia_mes === currentMonth),
    [filtered, currentMonth],
  );

  const total = monthly.length;
  const graves = monthly.filter((r) => r.is_grave).length;
  const porFonte = useMemo(() => {
    const acc: Record<string, number> = {};
    monthly.forEach((r) => {
      acc[r.fonte] = (acc[r.fonte] ?? 0) + 1;
    });
    return acc;
  }, [monthly]);

  const paretoTemas = useMemo(() => {
    const acc: Record<string, number> = {};
    monthly.forEach((r) => {
      (r.temas ?? []).forEach((t) => {
        acc[t] = (acc[t] ?? 0) + 1;
      });
    });
    return Object.entries(acc)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [monthly]);

  const heatmapLojaTema = useMemo(() => {
    const top = paretoTemas.slice(0, 6).map((p) => p.name);
    const lojas = Array.from(new Set(monthly.map((r) => idToCodigo[r.loja_id]))).filter(Boolean);
    const matrix: Record<string, Record<string, number>> = {};
    lojas.forEach((l) => {
      matrix[l] = {};
      top.forEach((t) => (matrix[l][t] = 0));
    });
    monthly.forEach((r) => {
      const code = idToCodigo[r.loja_id];
      if (!code) return;
      (r.temas ?? []).forEach((t) => {
        if (top.includes(t)) matrix[code][t] = (matrix[code][t] ?? 0) + 1;
      });
    });
    const max = Math.max(1, ...lojas.flatMap((l) => top.map((t) => matrix[l][t] ?? 0)));
    return { lojas, temas: top, matrix, max };
  }, [monthly, paretoTemas, idToCodigo]);

  const evolution = useMemo(() => {
    const byMes: Record<string, { mes: string; total: number; graves: number }> = {};
    filtered.forEach((r) => {
      const mes = r.referencia_mes;
      if (!byMes[mes]) byMes[mes] = { mes, total: 0, graves: 0 };
      byMes[mes].total += 1;
      if (r.is_grave) byMes[mes].graves += 1;
    });
    return Object.values(byMes)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6);
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">NPS · Reclamações</h2>
          <p className="text-xs text-muted-foreground">
            Análise temática · Pareto · Heatmap loja × tema
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricKpiCard
          label="Total no mês"
          value={String(total)}
          icon={<MessageSquare className="h-4 w-4" />}
          status={total === 0 ? "excelente" : total < 5 ? "bom" : total < 15 ? "regular" : "redflag"}
        />
        <MetricKpiCard
          label="Graves"
          value={String(graves)}
          icon={<AlertTriangle className="h-4 w-4" />}
          status={graves === 0 ? "excelente" : graves < 3 ? "bom" : "redflag"}
        />
        <MetricKpiCard
          label="% Graves"
          value={total ? `${Math.round((graves / total) * 100)}` : "0"}
          suffix="%"
          status={graves === 0 ? "excelente" : graves / Math.max(total, 1) < 0.2 ? "bom" : "redflag"}
        />
        <MetricKpiCard
          label="Fontes ativas"
          value={String(Object.keys(porFonte).length)}
          icon={<Filter className="h-4 w-4" />}
          status="neutro"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="vision-glass lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Pareto de temas
              </span>
              {tema && (
                <button
                  type="button"
                  onClick={() => setTema(null)}
                  className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary ring-1 ring-primary/30"
                >
                  Limpar filtro · {tema}
                </button>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Clique em uma barra para filtrar a lista
            </p>
          </CardHeader>
          <CardContent>
            {paretoTemas.length === 0 ? (
              <EmptyMsg label="Sem temas categorizados neste mês" />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paretoTemas} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill: "#ffffff80", fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      tick={{ fill: "#ffffffaa", fontSize: 11 }}
                      width={130}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(20,20,30,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="count"
                      cursor="pointer"
                      onClick={(d: any) => setTema(d.name)}
                      radius={[0, 6, 6, 0]}
                    >
                      {paretoTemas.map((p) => (
                        <Cell
                          key={p.name}
                          fill={p.name === tema ? "hsl(var(--primary))" : "rgba(245,158,11,0.7)"}
                        />
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
            <CardTitle className="text-base">Por fonte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(porFonte).length === 0 ? (
              <EmptyMsg label="Sem dados" />
            ) : (
              Object.entries(porFonte)
                .sort((a, b) => b[1] - a[1])
                .map(([f, n]) => {
                  const pct = total ? (n / total) * 100 : 0;
                  return (
                    <div key={f} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground/90">{FONTE_LABEL[f as FonteReclamacao] ?? f}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {n} <span className="text-muted-foreground/70">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-foreground/5">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>

      {heatmapLojaTema.lojas.length > 0 && (
        <Card className="vision-glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Heatmap · Loja × Tema</CardTitle>
            <p className="text-xs text-muted-foreground">
              Intensidade = nº reclamações no mês
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[640px] gap-1.5"
                style={{
                  gridTemplateColumns: `200px repeat(${heatmapLojaTema.temas.length}, minmax(80px, 1fr))`,
                }}
              >
                <div />
                {heatmapLojaTema.temas.map((t) => (
                  <div
                    key={t}
                    className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {t}
                  </div>
                ))}
                {heatmapLojaTema.lojas.map((l) => {
                  const d = getLojaDisplay(l);
                  return (
                    <div key={l} className="contents">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-border"
                          style={{ backgroundColor: `${d.cor}30`, color: d.cor }}
                        >
                          {d.sigla}
                        </span>
                        <span className="truncate font-medium text-foreground/90">{d.nome}</span>
                      </div>
                      {heatmapLojaTema.temas.map((t) => {
                        const v = heatmapLojaTema.matrix[l]?.[t] ?? 0;
                        const intensity = v / heatmapLojaTema.max;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTema(t)}
                            className={cn(
                              "rounded-lg px-2 py-2 text-center text-xs font-semibold tabular-nums ring-1 ring-border/60 transition-all hover:ring-primary",
                            )}
                            style={{
                              background: `rgba(239,68,68,${0.05 + intensity * 0.55})`,
                              color: intensity > 0.4 ? "white" : "rgba(255,255,255,0.7)",
                            }}
                          >
                            {v || "—"}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução · 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          {evolution.length === 0 ? (
            <EmptyMsg label="Sem histórico" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mes" tick={{ fill: "#ffffff80", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#ffffff80", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,30,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" fill="rgba(245,158,11,0.7)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="graves" fill="rgba(239,68,68,0.85)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Reclamações ({monthly.length})</span>
            {tema && <Badge variant="outline" className="ring-primary/30">Tema: {tema}</Badge>}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Mês corrente · ordenadas por gravidade e data
          </p>
        </CardHeader>
        <CardContent>
          {monthly.length === 0 ? (
            <EmptyMsg label="Nenhuma reclamação neste mês 🎉" />
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
              {[...monthly]
                .sort((a, b) => {
                  if (a.is_grave !== b.is_grave) return a.is_grave ? -1 : 1;
                  return b.data_reclamacao.localeCompare(a.data_reclamacao);
                })
                .map((r) => {
                  const code = idToCodigo[r.loja_id];
                  const d = code ? getLojaDisplay(code) : null;
                  return (
                    <motion.li
                      key={r.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "rounded-xl p-3 ring-1 transition-all",
                        r.is_grave
                          ? "bg-red-500/5 ring-red-500/30"
                          : "bg-foreground/[0.04] ring-border",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {d && (
                          <span
                            className="inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-bold ring-1 ring-border"
                            style={{ backgroundColor: `${d.cor}30`, color: d.cor }}
                          >
                            {d.sigla}
                          </span>
                        )}
                        <span className="font-semibold text-foreground">
                          {d?.nome ?? "—"}
                        </span>
                        <span className="text-muted-foreground/70">·</span>
                        <span className="text-muted-foreground">{FONTE_LABEL[r.fonte] ?? r.fonte}</span>
                        <span className="text-muted-foreground/70">·</span>
                        <span className="text-muted-foreground">{r.tipo_operacao}</span>
                        <span className="text-muted-foreground/70">·</span>
                        <span className="text-muted-foreground">{r.data_reclamacao}</span>
                        {r.is_grave && (
                          <Badge
                            variant="outline"
                            className="bg-red-500/15 text-[10px] text-red-600 dark:text-red-300 ring-red-500/40"
                          >
                            <AlertTriangle className="mr-1 h-3 w-3" /> Grave
                          </Badge>
                        )}
                        <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          {r.nota_reclamacao}★
                        </span>
                      </div>
                      {r.resumo_ia && (
                        <p className="mt-2 text-xs text-foreground/90">{r.resumo_ia}</p>
                      )}
                      {r.temas?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.temas.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTema(t)}
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] ring-1 transition-colors",
                                t === tema
                                  ? "bg-primary/20 text-primary ring-primary/40"
                                  : "bg-foreground/5 text-muted-foreground ring-border hover:bg-foreground/10",
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
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

function EmptyMsg({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-foreground/[0.03] p-8 text-xs text-muted-foreground ring-1 ring-border/60">
      <Clock className="h-4 w-4" />
      {label}
    </div>
  );
}
