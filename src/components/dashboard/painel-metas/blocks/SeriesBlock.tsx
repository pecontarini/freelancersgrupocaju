import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { SheetBlock } from "@/hooks/useSheetBlocks";

interface SeriesItem { loja_codigo: string; points: { x: string; y: number | null }[] }

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function SeriesBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as { label?: string; series?: SeriesItem[] };
  const series = payload.series ?? [];
  if (!series.length) return null;

  // Pivota: { x, [loja_codigo]: y, ... }
  const xs = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.x))));
  const data = xs.map((x) => {
    const row: Record<string, string | number | null> = { x };
    for (const s of series) {
      const p = s.points.find((pp) => pp.x === x);
      row[s.loja_codigo] = p?.y ?? null;
    }
    return row;
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-sky-500" />
          <CardTitle className="text-sm uppercase tracking-wide">{payload.label ?? "Série temporal"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="x" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, i) => (
                <Line
                  key={s.loja_codigo}
                  type="monotone"
                  dataKey={s.loja_codigo}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
