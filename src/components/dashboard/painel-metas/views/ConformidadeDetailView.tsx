import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  FileText,
  ChevronRight,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MetricKpiCard } from "../shared/MetricKpiCard";
import { PainelFilters, type BrandFilter } from "../shared/PainelFilters";
import { getLojaDisplay } from "@/lib/lojaUtils";
import { useConformidadeData, classifySector, type SectorGroup } from "@/hooks/useConformidadeData";
import { useLojaCodigoMap } from "../shared/useLojaCodigoMap";
import { calcConformidadeStatus } from "@/lib/metasUtils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  Cell,
} from "recharts";

interface Props {
  restrictToLojaCodigo?: string | null;
}

const GROUP_LABEL: Record<SectorGroup, string> = {
  back: "Back of House",
  front: "Front of House",
  outros: "Outros",
};

const STATUS_FILL = {
  excelente: "hsl(var(--primary))",
  bom: "rgba(245,158,11,0.85)",
  regular: "rgba(249,115,22,0.85)",
  redflag: "rgba(239,68,68,0.9)",
  neutro: "rgba(148,163,184,0.7)",
} as const;

function fmt(v: number | null) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function ConformidadeDetailView({ restrictToLojaCodigo }: Props) {
  const [brand, setBrand] = useState<BrandFilter>("all");
  const [loja, setLoja] = useState<string | "all">("all");
  const [grupo, setGrupo] = useState<"all" | SectorGroup>("all");

  const effectiveLoja =
    restrictToLojaCodigo ?? (loja !== "all" ? loja : null);

  const { aggregated, isLoading, isEmpty, error } = useConformidadeData({
    lojaCodigo: effectiveLoja,
    monthsBack: 6,
  });
  const { data: lojaMap } = useLojaCodigoMap();

  // Filtra agregados por brand quando não há loja específica
  const lojasFiltradas = useMemo(() => {
    if (!lojaMap) return aggregated.lojas;
    return aggregated.lojas
      .map((l) => ({ ...l, code: lojaMap.idToCodigo[l.loja_id] ?? null }))
      .filter((l) => {
        if (!l.code) return false;
        if (restrictToLojaCodigo) return l.code === restrictToLojaCodigo;
        if (brand !== "all" && !l.code.startsWith(`${brand}_`)) return false;
        return true;
      });
  }, [aggregated.lojas, lojaMap, brand, restrictToLojaCodigo]);

  const networkAvg = useMemo(() => {
    const arr = lojasFiltradas
      .map((l) => (grupo === "back" ? l.back : grupo === "front" ? l.front : l.total))
      .filter((v): v is number => v !== null);
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }, [lojasFiltradas, grupo]);

  const redFlagCount = lojasFiltradas.filter((l) => {
    const v = grupo === "back" ? l.back : grupo === "front" ? l.front : l.total;
    return calcConformidadeStatus(v) === "redflag";
  }).length;

  const chartData = useMemo(() => {
    return lojasFiltradas
      .map((l) => {
        const value = grupo === "back" ? l.back : grupo === "front" ? l.front : l.total;
        const d = getLojaDisplay(l.code!);
        return {
          code: l.code!,
          nome: `${d.sigla}·${l.code!.split("_")[1]}`,
          back: l.back,
          front: l.front,
          value,
          status: calcConformidadeStatus(value),
        };
      })
      .filter((r) => r.value !== null)
      .sort((a, b) => (b.value! - a.value!));
  }, [lojasFiltradas, grupo]);

  const setoresFiltrados = useMemo(() => {
    return aggregated.setores.filter((s) => grupo === "all" || s.grupo === grupo);
  }, [aggregated.setores, grupo]);

  const auditsFilteredByLoja = useMemo(() => {
    if (!lojaMap) return aggregated.audits;
    return aggregated.audits.filter((a) => {
      const code = lojaMap.idToCodigo[a.loja_id];
      if (!code) return false;
      if (restrictToLojaCodigo) return code === restrictToLojaCodigo;
      if (brand !== "all" && !code.startsWith(`${brand}_`)) return false;
      if (loja !== "all" && code !== loja) return false;
      return true;
    });
  }, [aggregated.audits, lojaMap, brand, loja, restrictToLojaCodigo]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
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

  if (isEmpty) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 p-12 text-center ring-1 ring-amber-500/20">
        <Clock className="h-10 w-10 text-amber-400" />
        <p className="font-[Sora] text-base font-semibold text-white">
          Sem auditorias registradas
        </p>
        <p className="text-xs text-white/60">
          Os scores de conformidade aparecerão aqui quando houver auditorias publicadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[Sora] text-xl font-bold text-white">
            Conformidade · Auditorias
          </h2>
          <p className="text-xs text-white/60">
            Score consolidado por unidade · Back/Front · meta ≥ 90 · red flag &lt; 75
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

      {/* Toggle Back/Front/Total */}
      <div className="inline-flex rounded-full bg-white/5 p-1 ring-1 ring-white/10">
        {(["all", "back", "front"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGrupo(g)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
              grupo === g
                ? "bg-primary text-primary-foreground shadow"
                : "text-white/60 hover:text-white",
            )}
          >
            {g === "all" ? "Total" : g === "back" ? "Back" : "Front"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricKpiCard
          label={`Média ${grupo === "all" ? "rede" : GROUP_LABEL[grupo]}`}
          value={fmt(networkAvg)}
          suffix="%"
          status={calcConformidadeStatus(networkAvg)}
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
        <MetricKpiCard
          label="Lojas analisadas"
          value={String(lojasFiltradas.length)}
          status="neutro"
          icon={<Layers className="h-4 w-4" />}
        />
        <MetricKpiCard
          label="Lojas em Red Flag"
          value={String(redFlagCount)}
          status={redFlagCount > 0 ? "redflag" : "excelente"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comparativo entre lojas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Score do mês corrente · cor por status
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyMsg label="Sem dados nesta seleção" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="nome" tick={{ fill: "#ffffff80", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#ffffff80", fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,30,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any) => [`${fmt(v)}%`, "Score"]}
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

      {/* Evolução 6 meses */}
      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução · 6 meses</CardTitle>
          <p className="text-xs text-muted-foreground">
            Média mensal por grupo (Back / Front)
          </p>
        </CardHeader>
        <CardContent>
          {aggregated.serie.length === 0 ? (
            <EmptyMsg label="Sem histórico" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={aggregated.serie}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="mes" tick={{ fill: "#ffffff80", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#ffffff80", fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,30,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: any, name: string) => [`${fmt(Number(v))}%`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: "white" }} />
                  <Line type="monotone" dataKey="back" name="Back" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="front" name="Front" stroke="rgba(96,165,250,0.9)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="total" name="Total" stroke="rgba(245,158,11,0.85)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setores */}
      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Score por setor (mês corrente)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Filtro: {grupo === "all" ? "todos" : GROUP_LABEL[grupo]}
          </p>
        </CardHeader>
        <CardContent>
          {setoresFiltrados.length === 0 ? (
            <EmptyMsg label="Sem setores avaliados" />
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
              {setoresFiltrados.map((s) => {
                const status = calcConformidadeStatus(s.score);
                return (
                  <li
                    key={s.code}
                    className={cn(
                      "flex items-center gap-3 rounded-xl p-2.5 ring-1",
                      status === "redflag"
                        ? "bg-red-500/5 ring-red-500/30"
                        : "bg-white/[0.03] ring-white/10",
                    )}
                  >
                    <span className="w-20 truncate text-[10px] font-bold uppercase tracking-wider text-white/50">
                      {s.grupo}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-white">{s.code}</span>
                    <span className="text-[10px] text-white/40">n={s.n}</span>
                    <span
                      className="font-[Sora] text-sm font-bold tabular-nums"
                      style={{ color: STATUS_FILL[status] }}
                    >
                      {fmt(s.score)}
                      <span className="ml-0.5 text-[10px] opacity-70">%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Auditorias recentes */}
      <Card className="vision-glass">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Auditorias recentes
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Clique no PDF para abrir o relatório completo
          </p>
        </CardHeader>
        <CardContent>
          {auditsFilteredByLoja.length === 0 ? (
            <EmptyMsg label="Sem auditorias no período" />
          ) : (
            <ul className="space-y-1.5">
              {auditsFilteredByLoja.map((a, idx) => {
                const code = lojaMap?.idToCodigo[a.loja_id];
                const d = code ? getLojaDisplay(code) : null;
                const status = calcConformidadeStatus(a.global_score);
                return (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <a
                      href={a.pdf_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (!a.pdf_url) e.preventDefault();
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl p-2.5 ring-1 transition-all",
                        a.pdf_url
                          ? "bg-white/[0.03] ring-white/10 hover:bg-white/[0.08] hover:ring-primary/30"
                          : "bg-white/[0.02] ring-white/5 cursor-not-allowed opacity-60",
                      )}
                    >
                      {d && (
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold ring-1 ring-white/15"
                          style={{ backgroundColor: `${d.cor}30`, color: d.cor }}
                        >
                          {d.sigla}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{d?.nome ?? "—"}</p>
                        <p className="text-[11px] text-white/50">{a.audit_date}</p>
                      </div>
                      <span
                        className="font-[Sora] text-sm font-bold tabular-nums"
                        style={{ color: STATUS_FILL[status] }}
                      >
                        {fmt(a.global_score)}
                        <span className="ml-0.5 text-[10px] opacity-70">%</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/40" />
                    </a>
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
    <div className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.02] p-8 text-xs text-white/50 ring-1 ring-white/5">
      <Clock className="h-4 w-4" /> {label}
    </div>
  );
}
