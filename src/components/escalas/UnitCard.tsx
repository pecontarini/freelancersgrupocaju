import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Target,
  Users,
  UserCheck,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PopDiarioAgg, PopDiarioRow } from "@/hooks/usePopDiario";
import { SectorTable } from "./SectorTable";

interface UnitCardProps {
  unitId: string;
  unitName: string;
  agg: PopDiarioAgg;
  sectorRows: PopDiarioRow[];
}

function bolinhaColor(pct: number): string {
  if (pct >= 90) return "bg-green-500";
  if (pct >= 60) return "bg-yellow-500";
  return "bg-red-500";
}

function badgeColor(pct: number): string {
  if (pct >= 90) return "bg-green-100 text-green-800 border-green-300";
  if (pct >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
}

export function UnitCard({ unitId, unitName, agg, sectorRows }: UnitCardProps) {
  const [expanded, setExpanded] = useState(false);
  const pct = agg.conformidade_pct;
  const hasInconforme = agg.setores_inconforme > 0;
  const hasPop = agg.pop_minimo > 0;
  const isInactive = !hasPop && agg.escalados === 0 && sectorRows.length === 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/70 backdrop-blur-sm p-4 transition-all hover:shadow-md",
        isInactive && "opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold text-sm truncate flex-1">{unitName}</h4>
        {hasPop ? (
          <Badge variant="outline" className={cn("gap-1.5", badgeColor(pct))}>
            <span className={cn("h-2 w-2 rounded-full", bolinhaColor(pct))} />
            {pct}%
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
            Sem POP
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <KPI
          icon={<Target className="h-3 w-3" />}
          label="POP"
          value={hasPop ? agg.pop_minimo : "—"}
        />
        <KPI icon={<Users className="h-3 w-3" />} label="Escalados" value={agg.escalados} />
        <KPI
          icon={<UserCheck className="h-3 w-3" />}
          label="POP Chegou"
          value={hasPop ? agg.pop_chegou : "—"}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <KPI
          icon={<AlertTriangle className="h-3 w-3" />}
          label="Faltam"
          value={hasPop ? agg.faltantes : "—"}
          color={hasPop && agg.faltantes > 0 ? "text-red-700" : undefined}
        />
        <KPI
          icon={<UserPlus className="h-3 w-3" />}
          label="Extras"
          value={`${agg.extras_freelancer} fl`}
        />
        <KPI
          icon={<Target className="h-3 w-3" />}
          label="Saldo"
          value={hasPop ? agg.saldo_final : "—"}
          color={
            !hasPop
              ? undefined
              : agg.saldo_final < 0
              ? "text-red-700"
              : agg.saldo_final > 0
              ? "text-green-700"
              : undefined
          }
        />
      </div>

      {hasPop && <Progress value={Math.min(pct, 100)} className="h-2 mb-3" />}

      {/* Toggle drilldown */}
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-between text-xs h-8"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>
          Ver detalhe por setor{" "}
          {hasInconforme && (
            <Badge variant="outline" className="ml-1 bg-red-100 text-red-700 border-red-300 text-[10px] px-1">
              {agg.setores_inconforme} crítico{agg.setores_inconforme > 1 ? "s" : ""}
            </Badge>
          )}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {expanded && (
        <div className="mt-3">
          <SectorTable rows={sectorRows} unitName={unitName} />
        </div>
      )}
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}</div>
      <p className={cn("text-lg font-bold leading-tight", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
