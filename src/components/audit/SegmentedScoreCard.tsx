import { useMemo } from "react";
import { Users, ChefHat, Activity, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useAuditScores, SegmentedScores } from "@/hooks/useAuditScores";
import { POSITION_LABELS, LeadershipPosition } from "@/lib/sectorPositionMapping";

interface SegmentedScoreCardProps {
  lojaId: string;
  lojaName?: string;
  monthYear?: string;
  compact?: boolean;
}

// Score thresholds for color coding
function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 95) return "text-emerald-600";
  if (score >= 80) return "text-amber-600";
  return "text-destructive";
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 95) return "bg-emerald-500/10";
  if (score >= 80) return "bg-amber-500/10";
  return "bg-destructive/10";
}

function getProgressColor(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 95) return "[&>div]:bg-emerald-500";
  if (score >= 80) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-destructive";
}

function getTierLabel(score: number | null): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (score === null) return { label: "Sem dados", variant: "outline" };
  if (score >= 95) return { label: "Ouro", variant: "default" };
  if (score >= 80) return { label: "Prata", variant: "secondary" };
  if (score >= 70) return { label: "Bronze", variant: "outline" };
  return { label: "Red Flag", variant: "destructive" };
}

export function SegmentedScoreCard({ lojaId, lojaName, monthYear, compact = false }: SegmentedScoreCardProps) {
  const { latestAudit, scores, frontResponsible, backResponsible, isLoading } = useAuditScores(lojaId, monthYear);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-card animate-pulse">
        <CardContent className="pt-6">
          <div className="h-32 bg-muted rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!latestAudit) {
    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma auditoria encontrada
              {lojaName && <span className="block font-medium mt-1">{lojaName}</span>}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const generalTier = getTierLabel(scores.general);
  const frontTier = getTierLabel(scores.front);
  const backTier = getTierLabel(scores.back);

  if (compact) {
    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {lojaName && (
                <p className="text-sm font-medium text-muted-foreground mb-1">{lojaName}</p>
              )}
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${getScoreColor(scores.general)}`}>
                  {scores.general?.toFixed(1)}%
                </span>
                <Badge variant={generalTier.variant} className="text-xs">
                  {generalTier.label}
                </Badge>
              </div>
            </div>
            <div className="flex gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex flex-col items-center p-2 rounded-lg ${getScoreBgColor(scores.front)}`}>
                      <Users className="h-4 w-4 text-primary mb-1" />
                      <span className={`text-lg font-bold ${getScoreColor(scores.front)}`}>
                        {scores.front?.toFixed(0)}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Nota FRONT ({scores.frontItems.failed} falhas)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`flex flex-col items-center p-2 rounded-lg ${getScoreBgColor(scores.back)}`}>
                      <ChefHat className="h-4 w-4 text-primary mb-1" />
                      <span className={`text-lg font-bold ${getScoreColor(scores.back)}`}>
                        {scores.back?.toFixed(0)}%
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Nota BACK ({scores.backItems.failed} falhas)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Notas Segmentadas</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {format(new Date(latestAudit.audit_date), "dd/MM/yyyy", { locale: ptBR })}
          </Badge>
        </div>
        {lojaName && (
          <p className="text-sm text-muted-foreground">{lojaName}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* General Score - Prominent */}
        <div className={`p-4 rounded-xl ${getScoreBgColor(scores.general)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium uppercase text-muted-foreground">
              Nota Geral da Unidade
            </span>
            <Badge variant={generalTier.variant}>{generalTier.label}</Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${getScoreColor(scores.general)}`}>
              {scores.general?.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={scores.general || 0} 
            className={`h-2 mt-3 ${getProgressColor(scores.general)}`} 
          />
        </div>

        {/* Front and Back Scores Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* FRONT Score */}
          <div className={`p-4 rounded-xl border ${getScoreBgColor(scores.front)}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">FRONT</p>
                <p className="text-xs text-muted-foreground truncate">
                  {frontResponsible?.label}
                </p>
              </div>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-2xl font-bold ${getScoreColor(scores.front)}`}>
                {scores.front?.toFixed(1)}%
              </span>
              <Badge variant={frontTier.variant} className="text-xs">
                {frontTier.label}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>{scores.frontItems.failed} não conformidades</span>
            </div>
            
            <Progress 
              value={scores.front || 0} 
              className={`h-1.5 mt-2 ${getProgressColor(scores.front)}`} 
            />
          </div>

          {/* BACK Score */}
          <div className={`p-4 rounded-xl border ${getScoreBgColor(scores.back)}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <ChefHat className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">BACK</p>
                <p className="text-xs text-muted-foreground truncate">
                  {backResponsible?.label}
                </p>
              </div>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-2xl font-bold ${getScoreColor(scores.back)}`}>
                {scores.back?.toFixed(1)}%
              </span>
              <Badge variant={backTier.variant} className="text-xs">
                {backTier.label}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>{scores.backItems.failed} não conformidades</span>
            </div>
            
            <Progress 
              value={scores.back || 0} 
              className={`h-1.5 mt-2 ${getProgressColor(scores.back)}`} 
            />
          </div>
        </div>

        {/* Responsibility Attribution */}
        <div className="p-3 rounded-lg bg-muted/50 text-xs">
          <p className="font-medium text-muted-foreground mb-1">Atribuição de Responsabilidade:</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5">
              <Users className="h-3 w-3 text-primary" />
              <span>FRONT → {frontResponsible?.label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ChefHat className="h-3 w-3 text-primary" />
              <span>BACK → {backResponsible?.label}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
