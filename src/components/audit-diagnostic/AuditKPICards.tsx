import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardCheck,
  AlertTriangle,
  Flame,
} from "lucide-react";

interface AuditKPICardsProps {
  avgScore: number | null;
  scoreVariation: number | null;
  totalAudits: number;
  totalFailures: number;
  criticalSector: { name: string; lostPoints: number } | null;
  recurringCount: number;
}

function getScoreColorClass(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 90) return "text-emerald-600";
  if (score >= 80) return "text-amber-600";
  return "text-destructive";
}

function getScoreBgClass(score: number | null): string {
  if (score === null) return "from-muted/30 to-muted/10";
  if (score >= 90) return "from-emerald-500/10 to-emerald-500/5";
  if (score >= 80) return "from-amber-500/10 to-amber-500/5";
  return "from-destructive/10 to-destructive/5";
}

export function AuditKPICards({
  avgScore,
  scoreVariation,
  totalAudits,
  totalFailures,
  criticalSector,
  recurringCount,
}: AuditKPICardsProps) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {/* Nota Média */}
      <Card className={`rounded-2xl shadow-card bg-gradient-to-br ${getScoreBgClass(avgScore)}`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Nota Média</p>
            {scoreVariation !== null && (
              <div
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  scoreVariation >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {scoreVariation >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(scoreVariation).toFixed(1)}%
              </div>
            )}
          </div>
          <p className={`text-3xl font-bold ${getScoreColorClass(avgScore)}`}>
            {avgScore !== null ? `${avgScore.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">no período</p>
        </CardContent>
      </Card>

      {/* Auditorias Realizadas */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Auditorias</p>
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </div>
          <p className="text-3xl font-bold">{totalAudits}</p>
          <p className="text-xs text-muted-foreground mt-1">realizadas</p>
        </CardContent>
      </Card>

      {/* Área Mais Crítica */}
      <Card className="rounded-2xl shadow-card border-l-4 border-l-amber-500">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Área Crítica</p>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          {criticalSector ? (
            <>
              <p className="text-lg font-bold truncate">{criticalSector.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {criticalSector.lostPoints} falha{criticalSector.lostPoints > 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <p className="text-lg font-bold text-emerald-600">Nenhuma</p>
          )}
        </CardContent>
      </Card>

      {/* Recorrências */}
      <Card className="rounded-2xl shadow-card border-l-4 border-l-destructive">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Recorrentes</p>
            <Flame className="h-4 w-4 text-destructive" />
          </div>
          <p className={`text-3xl font-bold ${recurringCount > 0 ? "text-destructive" : "text-emerald-600"}`}>
            {recurringCount}
          </p>
          <p className="text-xs text-muted-foreground mt-1">itens repetidos</p>
        </CardContent>
      </Card>
    </div>
  );
}
