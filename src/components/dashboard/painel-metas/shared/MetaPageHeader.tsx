import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMonthPt, shiftMonth } from "./dateUtils";
import type { MetaKey } from "./types";
import { META_DEFINITIONS } from "./metas";
import { cn } from "@/lib/utils";

interface MetaPageHeaderProps {
  metaKey: MetaKey;
  mes: string;
  onMesChange: (mes: string) => void;
  /** Slot para botões extras (ex.: análise IA). */
  actions?: React.ReactNode;
  className?: string;
}

export function MetaPageHeader({
  metaKey,
  mes,
  onMesChange,
  actions,
  className,
}: MetaPageHeaderProps) {
  const def = META_DEFINITIONS[metaKey];

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-bold uppercase tracking-wide text-foreground sm:text-xl">
          {def.label}
        </h2>
        <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
          {def.description}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Card className="glass-card">
          <CardContent className="flex items-center gap-1 p-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMesChange(shiftMonth(mes, -1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[140px] text-center">
              <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Período
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {formatMonthPt(mes)}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onMesChange(shiftMonth(mes, 1))}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
        {actions}
      </div>
    </div>
  );
}
