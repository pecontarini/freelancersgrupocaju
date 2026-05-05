import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ArrowDown, ArrowUp } from "lucide-react";
import type { SheetBlock } from "@/hooks/useSheetBlocks";
import { getLojaDisplay } from "@/lib/lojaUtils";

interface RankingItem { loja_codigo: string; valor: number; posicao: number; hint?: string }

function formatValue(v: number, decimals = 2, suffix = "%") {
  if (suffix === "R$") return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: decimals, minimumFractionDigits: Math.min(decimals, 2) })}${suffix === "%" ? "%" : suffix ? ` ${suffix}` : ""}`;
}

export function RankingBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as {
    label?: string;
    items?: RankingItem[];
    suffix?: string;
    polarity?: "higher" | "lower";
    decimals?: number;
  };
  const items = payload.items ?? [];
  const label = payload.label ?? "Ranking";
  const polarity = payload.polarity ?? "higher";
  const suffix = payload.suffix ?? "%";
  const decimals = payload.decimals ?? 2;

  if (!items.length) return null;

  const max = Math.max(...items.map(i => Math.abs(i.valor)));

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm uppercase tracking-wide">{label}</CardTitle>
          <Badge variant="outline" className="text-[10px] ml-auto gap-1">
            {polarity === "lower" ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />}
            {polarity === "lower" ? "menor é melhor" : "maior é melhor"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.map((it) => {
          const d = getLojaDisplay(it.loja_codigo);
          const pct = max > 0 ? (Math.abs(it.valor) / max) * 100 : 0;
          return (
            <div
              key={it.loja_codigo + it.posicao}
              className="relative overflow-hidden rounded-lg border bg-card/50 px-3 py-2"
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/[0.06] transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center gap-3">
                <div
                  className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${
                    it.posicao === 1 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : it.posicao === 2 ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      : it.posicao === 3 ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {it.posicao}
                </div>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold ring-1 ring-border"
                  style={{ backgroundColor: `${d.cor}25`, color: d.cor }}
                >
                  {d.sigla}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.nome}</div>
                  {it.hint && <div className="text-[10px] text-muted-foreground truncate">{it.hint}</div>}
                </div>
                <span className="text-sm font-mono font-semibold tabular-nums">
                  {formatValue(it.valor, decimals, suffix)}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
