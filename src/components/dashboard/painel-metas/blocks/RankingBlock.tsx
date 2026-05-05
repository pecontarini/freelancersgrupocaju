import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ArrowRight } from "lucide-react";
import type { SheetBlock } from "@/hooks/useSheetBlocks";

interface RankingItem { loja_codigo: string; valor: number; posicao: number }

export function RankingBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as { label?: string; items?: RankingItem[] };
  const items = payload.items ?? [];
  const label = payload.label ?? "Ranking";

  if (!items.length) return null;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm uppercase tracking-wide">{label}</CardTitle>
          <Badge variant="outline" className="text-[10px] ml-auto">
            {items.length} lojas
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.map((it) => (
          <div
            key={it.loja_codigo}
            className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2"
          >
            <div
              className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${
                it.posicao === 1
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : it.posicao === 2
                  ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  : it.posicao === 3
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {it.posicao}
            </div>
            <span className="text-sm font-medium flex-1">{it.loja_codigo}</span>
            <span className="text-sm font-mono tabular-nums">
              {typeof it.valor === "number" ? it.valor.toFixed(2) : "-"}
              <span className="text-muted-foreground text-xs ml-0.5">%</span>
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
