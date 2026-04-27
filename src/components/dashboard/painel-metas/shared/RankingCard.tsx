import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RankingRow } from "./types";

interface RankingCardProps {
  title: string;
  rows: RankingRow[];
  loading?: boolean;
  /** Função que formata o valor numérico em string (ex.: "1.71kg"). */
  formatValue: (v: number | null) => string;
  /** Texto de cabeçalho extra exibido à direita do valor. */
  emptyText?: string;
}

const RANK_BADGES = [
  "bg-amber-300 text-amber-900",
  "bg-zinc-300 text-zinc-800",
  "bg-orange-700 text-orange-50",
];

const FAIXA_TEXT_TOKEN: Record<NonNullable<RankingRow["faixa"]>, string> = {
  excelente: "text-emerald-600 dark:text-emerald-400",
  bom: "text-primary",
  regular: "text-amber-600 dark:text-amber-400",
  redflag: "text-destructive",
};

export function RankingCard({
  title,
  rows,
  loading,
  formatValue,
  emptyText = "Sem dados para o período",
}: RankingCardProps) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <Trophy className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-1.5 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((row, idx) => {
              const faixaToken = row.faixa ? FAIXA_TEXT_TOKEN[row.faixa] : "text-foreground";
              const badge = RANK_BADGES[idx] ?? "bg-muted text-muted-foreground";
              return (
                <li
                  key={row.loja_id}
                  className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-primary/5"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                      badge
                    )}
                    aria-label={`Posição ${idx + 1}`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {row.nome}
                    </div>
                    {row.hint ? (
                      <div className="truncate text-[10px] text-muted-foreground">
                        {row.hint}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      faixaToken
                    )}
                  >
                    {formatValue(row.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
