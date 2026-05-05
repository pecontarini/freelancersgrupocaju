import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import type { SheetBlock } from "@/hooks/useSheetBlocks";

interface DistItem { loja_codigo: string; counts: Record<string, number>; total: number; media: number | null }

export function DistributionBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as { label?: string; notas?: number[]; items?: DistItem[] };
  const notas = payload.notas ?? [1, 2, 3, 4, 5];
  const items = payload.items ?? [];
  if (!items.length) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <CardTitle className="text-sm uppercase tracking-wide">{payload.label ?? "Distribuição"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it) => {
          const max = Math.max(...notas.map((n) => it.counts[String(n)] ?? 0), 1);
          return (
            <div key={it.loja_codigo} className="rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{it.loja_codigo}</span>
                <span className="text-xs text-muted-foreground">
                  {it.total} avaliações · média {it.media?.toFixed(2) ?? "-"}
                </span>
              </div>
              <div className="space-y-1">
                {notas.map((n) => {
                  const v = it.counts[String(n)] ?? 0;
                  const pct = (v / max) * 100;
                  const tone =
                    n >= 4 ? "bg-emerald-500" : n === 3 ? "bg-amber-500" : "bg-rose-500";
                  return (
                    <div key={n} className="flex items-center gap-2 text-[11px]">
                      <span className="w-6 font-mono">{n}★</span>
                      <div className="flex-1 h-3 bg-muted rounded">
                        <div className={`h-3 rounded ${tone}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 text-right tabular-nums">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
