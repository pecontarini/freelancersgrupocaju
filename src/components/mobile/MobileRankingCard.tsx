import { Medal, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface RankingStore {
  id: string;
  nome: string;
  nps: number;
  supervisao: number;
  avg: number;
  hasWeeklyData?: boolean;
}

interface MobileRankingCardProps {
  store: RankingStore;
  index: number;
  isSelected: boolean;
}

export function MobileRankingCard({ store, index, isSelected }: MobileRankingCardProps) {
  const getMedalColor = (position: number) => {
    if (position === 0) return "text-amber-500";
    if (position === 1) return "text-slate-400";
    if (position === 2) return "text-amber-700";
    return "text-muted-foreground";
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-sm transition-all",
        isSelected ? "border-primary bg-primary/5" : "bg-card",
        index < 3 && "ring-1 ring-inset",
        index === 0 && "ring-amber-500/30",
        index === 1 && "ring-slate-400/30",
        index === 2 && "ring-amber-700/30"
      )}
    >
      {/* Header with position and name */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          {index < 3 ? (
            <Medal className={cn("h-5 w-5", getMedalColor(index))} />
          ) : (
            <span className="text-sm font-bold text-muted-foreground">
              {index + 1}º
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{store.nome}</p>
          {store.hasWeeklyData && (
            <Badge variant="outline" className="text-xs mt-1 gap-1">
              <TrendingUp className="h-3 w-3" />
              Dados Semanais
            </Badge>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-primary">{store.avg.toFixed(0)}%</p>
          <p className="text-xs text-muted-foreground">Média</p>
        </div>
      </div>
      
      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase">NPS Efic.</p>
          <p className="text-sm font-bold mt-1">
            {formatCurrency(store.nps)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <p className="text-xs text-muted-foreground uppercase">Supervisão</p>
          <p className="text-sm font-bold mt-1">{store.supervisao.toFixed(0)}%</p>
        </div>
      </div>
    </div>
  );
}
