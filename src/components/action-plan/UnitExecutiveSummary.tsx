import { AlertTriangle, CheckCircle, Activity, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { useConfigLojas } from "@/hooks/useConfigOptions";

interface UnitExecutiveSummaryProps {
  lojaId: string;
}

export function UnitExecutiveSummary({ lojaId }: UnitExecutiveSummaryProps) {
  const { audits, pendingFailures, failures, isRecurring } = useSupervisionAudits(lojaId);
  const { options: lojas } = useConfigLojas();

  const loja = lojas.find((l) => l.id === lojaId);
  const latestAudit = audits[0];
  const supervisionScore = latestAudit?.global_score ?? null;

  // Count critical (recurring) pending items
  const criticalPendingCount = pendingFailures.filter(isRecurring).length;
  const totalPendingCount = pendingFailures.length;

  // Red flag is active if supervision score is below 80%
  const isRedFlagActive = supervisionScore !== null && supervisionScore < 80;

  // Score color logic
  const getScoreColor = (score: number) => {
    if (score >= 95) return "text-emerald-600";
    if (score >= 80) return "text-amber-600";
    return "text-destructive";
  };

  return (
    <Card className="bg-gradient-to-r from-muted/50 to-background border-primary/20">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm uppercase tracking-wide">
              Resumo Executivo
            </h3>
          </div>
          {loja && (
            <Badge variant="outline" className="font-medium">
              {loja.nome}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Supervision Score */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-background border">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">
                Última Supervisão
              </p>
              {supervisionScore !== null ? (
                <p className={`text-xl font-bold ${getScoreColor(supervisionScore)}`}>
                  {supervisionScore.toFixed(1)}%
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </div>
          </div>

          {/* Critical Pending Items */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-background border">
            <div className={`p-2 rounded-lg ${criticalPendingCount > 0 ? "bg-destructive/10" : "bg-muted"}`}>
              <AlertTriangle className={`h-5 w-5 ${criticalPendingCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">
                Itens Críticos
              </p>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${criticalPendingCount > 0 ? "text-destructive" : "text-foreground"}`}>
                  {criticalPendingCount}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {totalPendingCount} pendentes
                </span>
              </div>
            </div>
          </div>

          {/* Red Flag Status */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-background border">
            <div className={`p-2 rounded-lg ${isRedFlagActive ? "bg-destructive/10" : "bg-emerald-500/10"}`}>
              <TrendingDown className={`h-5 w-5 ${isRedFlagActive ? "text-destructive" : "text-emerald-600"}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">
                Status Red Flag
              </p>
              {isRedFlagActive ? (
                <Badge variant="destructive" className="mt-1">
                  ATIVO
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1 border-emerald-500 text-emerald-600">
                  INATIVO
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
