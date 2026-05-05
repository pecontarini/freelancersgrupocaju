import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid3x3 } from "lucide-react";
import type { SheetBlock } from "@/hooks/useSheetBlocks";

interface MatrixRow { categoria: string; valores: Record<string, number | null> }

function colorScale(v: number | null, scale: { min: number; mid: number; max: number }, polarity: "higher" | "lower"): string {
  if (v === null || v === undefined) return "bg-muted/30 text-muted-foreground";
  const { min, mid, max } = scale;
  const isGoodHigh = polarity === "higher";
  // Normalize towards "good" axis
  const ratio = (v - min) / Math.max(0.0001, max - min);
  const goodness = isGoodHigh ? ratio : 1 - ratio;
  if (goodness >= 0.75) return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200";
  if (goodness >= 0.5) return "bg-lime-100 text-lime-900 dark:bg-lime-950/60 dark:text-lime-200";
  if (goodness >= 0.25) return "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200";
  return "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200";
  void mid;
}

export function MatrixBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as {
    label?: string;
    lojas?: string[];
    categorias?: MatrixRow[];
    suffix?: string;
    polarity?: "higher" | "lower";
    scale?: { min: number; mid: number; max: number };
  };
  const lojas = payload.lojas ?? [];
  const categorias = payload.categorias ?? [];
  const suffix = payload.suffix ?? "%";
  const polarity = payload.polarity ?? "higher";
  const scale = payload.scale ?? { min: 0, mid: 50, max: 100 };
  if (!lojas.length || !categorias.length) return null;

  return (
    <Card className="rounded-2xl md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4 text-violet-500" />
          <CardTitle className="text-sm uppercase tracking-wide">{payload.label ?? "Matriz"}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium text-muted-foreground sticky left-0 bg-card">Categoria</th>
                {lojas.map((l) => (
                  <th key={l} className="px-2 py-2 font-mono text-[10px]">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categorias.map((row) => (
                <tr key={row.categoria} className="border-b border-border/40">
                  <td className="p-2 font-medium sticky left-0 bg-card max-w-[180px] truncate" title={row.categoria}>{row.categoria}</td>
                  {lojas.map((l) => {
                    const v = row.valores[l] ?? null;
                    return (
                      <td key={l} className={`px-1 py-1 text-center font-mono tabular-nums ${colorScale(v, scale, polarity)}`}>
                        {v === null ? "-" : `${v.toFixed(1)}${suffix === "%" ? "%" : ""}`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
