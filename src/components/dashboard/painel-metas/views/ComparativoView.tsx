import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Radar as RadarIcon, X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  LOJAS_MOCK,
  METRIC_META,
  RANKING_METRICS,
  bandeiraStyles,
  normalizeMetric,
  type LojaCode,
  type RankingMetric,
} from "../shared/mockLojas";

const RADAR_COLORS = ["#F59E0B", "#38BDF8", "#10B981", "#A78BFA"];
const MIN_SELECTED = 2;
const MAX_SELECTED = 4;

export function ComparativoView() {
  const [selected, setSelected] = useState<LojaCode[]>(["CP_SG", "NZ_SG", "CJ_SG"]);

  const radarData = useMemo(() => {
    return RANKING_METRICS.map((m) => {
      const row: Record<string, number | string> = { metrica: METRIC_META[m].label };
      selected.forEach((code) => {
        const loja = LOJAS_MOCK.find((l) => l.code === code);
        if (!loja) return;
        row[code] = normalizeMetric(m, loja.values[m]);
      });
      return row;
    });
  }, [selected]);

  const tableRows = useMemo(() => {
    if (selected.length < 2) return [];
    return RANKING_METRICS.map((m) => {
      const norms = selected.map((code) => {
        const loja = LOJAS_MOCK.find((l) => l.code === code);
        return loja ? normalizeMetric(m, loja.values[m]) : 0;
      });
      const max = Math.max(...norms);
      const min = Math.min(...norms);
      return { metric: m, norms, delta: max - min };
    });
  }, [selected]);

  const toggle = (code: LojaCode) => {
    setSelected((prev) => {
      if (prev.includes(code)) {
        if (prev.length <= MIN_SELECTED) return prev;
        return prev.filter((c) => c !== code);
      }
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, code];
    });
  };

  return (
    <Card className="vision-glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="h-4 w-4 text-violet-400" />
          Comparativo de Lojas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Selecione de {MIN_SELECTED} a {MAX_SELECTED} lojas para comparar métricas
          normalizadas (0–100).
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((code, idx) => {
            const loja = LOJAS_MOCK.find((l) => l.code === code);
            if (!loja) return null;
            const b = bandeiraStyles(loja.bandeira);
            return (
              <motion.span
                key={code}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs ring-1 ring-white/15"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: RADAR_COLORS[idx] }}
                />
                <span className={cn("font-bold", b.text)}>{b.label}</span>
                <span className="text-foreground/80">{code}</span>
                <button
                  type="button"
                  onClick={() => toggle(code)}
                  disabled={selected.length <= MIN_SELECTED}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Remover loja"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            );
          })}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={selected.length >= MAX_SELECTED}
                className="vision-glass h-7 gap-1 border-white/15 px-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar loja
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="grid grid-cols-2 gap-1">
                {LOJAS_MOCK.map((loja) => {
                  const isSel = selected.includes(loja.code);
                  const b = bandeiraStyles(loja.bandeira);
                  const disabled = !isSel && selected.length >= MAX_SELECTED;
                  return (
                    <button
                      key={loja.code}
                      type="button"
                      onClick={() => toggle(loja.code)}
                      disabled={disabled}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                        "hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40",
                        isSel && "bg-primary/15 ring-1 ring-primary/30",
                      )}
                    >
                      <span className={cn("font-bold", b.text)}>{b.label}</span>
                      <span className="truncate">{loja.code}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 px-1 text-[10px] text-muted-foreground">
                {selected.length}/{MAX_SELECTED} lojas selecionadas
              </p>
            </PopoverContent>
          </Popover>
        </div>

        {/* Radar */}
        <div
          className="rounded-2xl p-3 ring-1 ring-white/10"
          style={{
            background:
              "radial-gradient(80% 80% at 50% 30%, rgba(167,139,250,0.10), transparent 70%)",
          }}
        >
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="78%">
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis
                  dataKey="metrica"
                  tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                  stroke="rgba(255,255,255,0.1)"
                />
                {selected.map((code, idx) => (
                  <Radar
                    key={code}
                    name={code}
                    dataKey={code}
                    stroke={RADAR_COLORS[idx]}
                    fill={RADAR_COLORS[idx]}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip
                  contentStyle={{
                    background: "rgba(20,20,22,0.92)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "white",
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
                  iconType="circle"
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabela de delta */}
        <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead>Métrica</TableHead>
                {selected.map((code, idx) => (
                  <TableHead key={code} className="text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: RADAR_COLORS[idx] }}
                      />
                      {code}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-right">Δ Max-Min</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((r) => {
                const max = Math.max(...r.norms);
                const min = Math.min(...r.norms);
                return (
                  <TableRow key={r.metric} className="border-white/5 hover:bg-white/5">
                    <TableCell className="text-sm">
                      {METRIC_META[r.metric].label}
                    </TableCell>
                    {r.norms.map((n, i) => {
                      const isMax = n === max && max !== min;
                      const isMin = n === min && max !== min;
                      return (
                        <TableCell key={i} className="text-center tabular-nums">
                          <span
                            className={cn(
                              "inline-flex min-w-[3rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold",
                              isMax && "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
                              isMin && "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
                              !isMax && !isMin && "text-foreground/80",
                            )}
                          >
                            {n}
                          </span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right tabular-nums text-sm font-semibold">
                      {r.delta}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Valores normalizados 0–100 considerando meta e red flag de cada métrica.
          Dados de demonstração.
        </p>
      </CardContent>
    </Card>
  );
}
