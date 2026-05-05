import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceArea } from "recharts";
import type { SheetBlock } from "@/hooks/useSheetBlocks";
import { getLojaDisplay } from "@/lib/lojaUtils";

interface SeriesItem { loja_codigo: string; nome?: string; points: { x: string; y: number | null }[] }
interface Thresholds {
  good?: { lte?: number; color: string; label: string };
  mid?: { gt?: number; lte?: number; color: string; label: string };
  bad?: { gt?: number; color: string; label: string };
}

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function SeriesBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as {
    label?: string;
    series?: SeriesItem[];
    thresholds?: Thresholds;
    polarity?: "higher" | "lower";
    decimals?: number;
  };
  const series = payload.series ?? [];
  const decimals = payload.decimals ?? 2;
  if (!series.length) return null;

  const xs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x))));
  const data = xs.map((x) => {
    const row: Record<string, string | number | null> = { x };
    for (const s of series) {
      const p = s.points.find((pp) => pp.x === x);
      row[s.loja_codigo] = p?.y ?? null;
    }
    return row;
  });

  const t = payload.thresholds;

  return (
    <Card className="rounded-2xl md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {payload.polarity === "lower" ? <TrendingDown className="h-4 w-4 text-sky-500" /> : <TrendingUp className="h-4 w-4 text-sky-500" />}
          <CardTitle className="text-sm uppercase tracking-wide">{payload.label ?? "Série temporal"}</CardTitle>
          {t && (
            <div className="ml-auto flex items-center gap-2 text-[10px]">
              {t.good && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: t.good.color }} />{t.good.label}</span>}
              {t.mid && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: t.mid.color }} />{t.mid.label}</span>}
              {t.bad && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded" style={{ background: t.bad.color }} />{t.bad.label}</span>}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              {t?.good?.lte !== undefined && (
                <ReferenceArea y1={0} y2={t.good.lte} fill={t.good.color} fillOpacity={0.06} />
              )}
              {t?.mid?.gt !== undefined && t?.mid?.lte !== undefined && (
                <ReferenceArea y1={t.mid.gt} y2={t.mid.lte} fill={t.mid.color} fillOpacity={0.07} />
              )}
              {t?.bad?.gt !== undefined && (
                <ReferenceArea y1={t.bad.gt} y2={9999} fill={t.bad.color} fillOpacity={0.06} />
              )}
              <Tooltip formatter={(v: any) => typeof v === "number" ? v.toFixed(decimals) : v} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, i) => {
                const d = getLojaDisplay(s.loja_codigo);
                return (
                  <Line
                    key={s.loja_codigo}
                    name={d.nome}
                    type="monotone"
                    dataKey={s.loja_codigo}
                    stroke={d.cor || COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
