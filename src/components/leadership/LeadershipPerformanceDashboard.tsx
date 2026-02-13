import { useState, useMemo } from "react";
import {
  Users,
  Award,
  TrendingUp,
  FileText,
  Crown,
  Medal,
  Trophy,
  Loader2,
  BarChart3,
  UtensilsCrossed,
  Wine,
  Flame,
  Fish,
  ConciergeBell,
  ClipboardList,
  UserCircle,
  ChefHat,
  RefreshCcw,
  type LucideIcon,
} from "lucide-react";
import { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { DateRangeFilter as DateRangeFilterComponent } from "@/components/action-plan/DateRangeFilter";
import { generateLeadershipPDF, generateConsolidatedPDF } from "@/lib/leadershipPdfGenerator";
import {
  useLeadershipPerformance,
  useCalculateLeadershipPerformance,
} from "@/hooks/useLeadershipPerformance";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import {
  categorizeItemToSector,
  getSectorsForArea,
  type AreaType,
  type AuditSector,
} from "@/lib/sectorPositionMapping";
import {
  POSITION_LABELS as AUDIT_POSITION_LABELS,
  getTierForScore,
} from "@/lib/audit/auditTypes";
import type { LeadershipPositionCode, PositionPerformanceResult } from "@/lib/audit/auditTypes";

// Icon mapping for each position
const POSITION_ICONS: Record<string, LucideIcon> = {
  gerente_front: UserCircle,
  gerente_back: ChefHat,
  chefe_salao: ConciergeBell,
  chefe_apv: ClipboardList,
  chefe_bar: Wine,
  chefe_cozinha: UtensilsCrossed,
  chefe_parrilla: Flame,
  chefe_sushi: Fish,
};

interface LeadershipPerformanceDashboardProps {
  selectedUnidadeId: string | null;
  isAdmin?: boolean;
}

function getTierConfig(tier: string | null) {
  switch (tier) {
    case "ouro":
      return { label: "Ouro", icon: Crown, color: "text-primary", bg: "bg-primary/10" };
    case "prata":
      return { label: "Prata", icon: Medal, color: "text-muted-foreground", bg: "bg-muted" };
    case "bronze":
      return { label: "Bronze", icon: Trophy, color: "text-foreground", bg: "bg-muted/50" };
    case "red_flag":
      return { label: "Crítico", icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10" };
    default:
      return { label: "N/A", icon: TrendingUp, color: "text-muted-foreground", bg: "bg-muted/50" };
  }
}

function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 95) return "text-primary";
  if (score >= 85) return "text-muted-foreground";
  return "text-destructive";
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return "bg-muted";
  if (score >= 95) return "bg-primary";
  if (score >= 85) return "bg-muted-foreground";
  return "bg-destructive";
}

export function LeadershipPerformanceDashboard({
  selectedUnidadeId,
  isAdmin = false,
}: LeadershipPerformanceDashboardProps) {
  const { options: lojas } = useConfigLojas();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  // Derive monthYear from dateRange
  const monthYear = useMemo(() => {
    if (dateRange?.from) {
      const d = dateRange.from;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, [dateRange]);

  // Use the official Regra Mãe calculation engine
  const {
    positionResults,
    frontPositions,
    backPositions,
    generalScore,
    generalTier,
    isLoading: isLoadingPerformance,
  } = useLeadershipPerformance({
    lojaId: selectedUnidadeId,
    monthYear,
    dateRange: dateRange ? { from: dateRange.from, to: dateRange.to } : undefined,
  });

  const { calculate, isCalculating } = useCalculateLeadershipPerformance();

  // Load failures for PDF export & failure counts
  const { failures, audits, isLoadingAudits, isLoadingFailures } = useSupervisionAudits(
    selectedUnidadeId,
    undefined,
    dateRange ? { from: dateRange.from, to: dateRange.to } : undefined
  );

  const getLojaName = (lojaId: string) => {
    return lojas.find((l) => l.id === lojaId)?.nome || "Desconhecida";
  };

  // Filter audits/failures by selected unit
  const filteredAudits = useMemo(() => {
    if (!selectedUnidadeId) return audits;
    return audits.filter((a) => a.loja_id === selectedUnidadeId);
  }, [audits, selectedUnidadeId]);

  const filteredFailures = useMemo(() => {
    const relevantIds = new Set(filteredAudits.map((a) => a.id));
    let result = failures.filter((f) => relevantIds.has(f.audit_id));
    if (selectedUnidadeId) {
      result = result.filter((f) => f.loja_id === selectedUnidadeId);
    }
    return result;
  }, [failures, filteredAudits, selectedUnidadeId]);

  // Compute front/back area scores from the official engine results
  const areaScores = useMemo(() => {
    const getAreaScore = (positions: PositionPerformanceResult[]) => {
      const withScores = positions.filter((p) => p.finalScore !== null);
      if (withScores.length === 0) return null;
      return withScores.reduce((sum, p) => sum + (p.finalScore || 0), 0) / withScores.length;
    };

    const frontScore = getAreaScore(frontPositions);
    const backScore = getAreaScore(backPositions);

    // Count failures per area
    let frontFailures = 0;
    let backFailures = 0;
    const frontSectors = getSectorsForArea("front");
    const backSectors = getSectorsForArea("back");

    filteredFailures.forEach((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      if (frontSectors.includes(sector)) frontFailures++;
      else if (backSectors.includes(sector)) backFailures++;
    });

    return {
      front: {
        score: frontScore,
        failures: frontFailures,
        tier: frontScore !== null ? getTierForScore(frontScore).tier : null,
        auditCount: filteredAudits.length,
      },
      back: {
        score: backScore,
        failures: backFailures,
        tier: backScore !== null ? getTierForScore(backScore).tier : null,
        auditCount: filteredAudits.length,
      },
      global: {
        score: generalScore,
        tier: generalTier?.tier ?? null,
        auditCount: filteredAudits.length,
      },
    };
  }, [frontPositions, backPositions, generalScore, generalTier, filteredFailures, filteredAudits]);

  // Map position results to a sorted ranking with failure counts
  const leadershipRanking = useMemo(() => {
    return positionResults
      .map((pos) => {
        // Count failures for this position's sectors
        const positionSectors: AuditSector[] = [];
        // Use breakdown to infer which sectors are covered
        const sectorMap: Record<string, AuditSector[]> = {
          chefe_salao: ["salao"],
          chefe_apv: ["delivery", "asg", "manutencao", "brinquedoteca", "recepcao", "lavagem", "documentos"],
          chefe_parrilla: ["parrilla"],
          chefe_bar: ["bar"],
          chefe_cozinha: ["cozinha", "cozinha_quente", "saladas_sobremesas"],
          gerente_front: ["salao", "area_comum", "documentos", "lavagem", "delivery", "asg", "manutencao", "brinquedoteca", "recepcao"],
          gerente_back: ["estoque", "cozinha", "sushi", "parrilla", "bar", "dml"],
        };
        const sectors = sectorMap[pos.position] || [];

        let failureCount = 0;
        filteredFailures.forEach((f) => {
          const sector = categorizeItemToSector(f.item_name, f.category);
          if (sectors.includes(sector)) failureCount++;
        });

        const areaType: AreaType =
          pos.position === "gerente_front" || pos.position === "chefe_salao" || pos.position === "chefe_apv"
            ? "front"
            : "back";

        return {
          ...pos,
          failureCount,
          areaType,
          sectors,
        };
      })
      .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
  }, [positionResults, filteredFailures]);

  const handleExportIndividualPDF = async (leader: typeof leadershipRanking[0]) => {
    const leaderFailures = filteredFailures.filter((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      return leader.sectors.includes(sector);
    });

    await generateLeadershipPDF({
      leaderName: leader.label,
      position: leader.position as any,
      score: leader.finalScore ?? 0,
      tier: leader.tier?.tier as any ?? "red_flag",
      failures: leaderFailures,
      dateRange,
      unitName: selectedUnidadeId ? getLojaName(selectedUnidadeId) : "Todas as Unidades",
    });
  };

  const handleExportConsolidatedPDF = async (areaType: AreaType) => {
    const areaSectors = getSectorsForArea(areaType);
    const areaFailures = filteredFailures.filter((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      return areaSectors.includes(sector);
    });

    const areaLeaders = leadershipRanking
      .filter((l) => l.areaType === areaType)
      .map((l) => ({
        position: l.position as any,
        name: l.label,
        score: l.finalScore ?? 0,
        failureCount: l.failureCount,
        totalItems: l.totalAudits,
        tier: l.tier?.tier as any ?? "red_flag",
        areaType: l.areaType,
        sectors: l.sectors as any[],
      }));

    await generateConsolidatedPDF({
      areaType,
      areaScore: areaType === "front" ? (areaScores.front.score ?? 0) : (areaScores.back.score ?? 0),
      leaders: areaLeaders,
      failures: areaFailures,
      dateRange,
      unitName: selectedUnidadeId ? getLojaName(selectedUnidadeId) : "Todas as Unidades",
    });
  };

  const isLoading = isLoadingPerformance || isLoadingAudits || isLoadingFailures;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">
              Diagnóstico de Performance
            </h2>
            <p className="text-muted-foreground">
              Análise hierárquica com média ponderada (Regra Mãe)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DateRangeFilterComponent
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() =>
                calculate({
                  action: "backfill",
                  loja_id: selectedUnidadeId || undefined,
                  month_year: monthYear,
                  trigger_type: "manual_backfill",
                })
              }
              disabled={isCalculating}
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Recalcular</span>
            </Button>
          )}
        </div>
      </div>

      {/* Executive Level - Area Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* FRONT Card */}
        <Card className="rounded-2xl border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                    Área Front
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Gerentes & Salão</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExportConsolidatedPDF("front")}
                className="h-8 px-2"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div>
                <p className={`text-3xl font-bold ${getScoreColor(areaScores.front.score)}`}>
                  {areaScores.front.score !== null ? `${Math.round(areaScores.front.score)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {areaScores.front.failures} falhas · {areaScores.front.auditCount} auditoria(s)
                </p>
              </div>
              {(() => {
                const config = getTierConfig(areaScores.front.tier);
                const Icon = config.icon;
                return (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${config.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                  </div>
                );
              })()}
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getScoreBgColor(areaScores.front.score)}`}
                style={{ width: `${areaScores.front.score ?? 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* BACK Card */}
        <Card className="rounded-2xl border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <ChefHat className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                    Área Back
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Chefes & Cozinha</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExportConsolidatedPDF("back")}
                className="h-8 px-2"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end justify-between">
              <div>
                <p className={`text-3xl font-bold ${getScoreColor(areaScores.back.score)}`}>
                  {areaScores.back.score !== null ? `${Math.round(areaScores.back.score)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {areaScores.back.failures} falhas · {areaScores.back.auditCount} auditoria(s)
                </p>
              </div>
              {(() => {
                const config = getTierConfig(areaScores.back.tier);
                const Icon = config.icon;
                return (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${config.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                  </div>
                );
              })()}
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getScoreBgColor(areaScores.back.score)}`}
                style={{ width: `${areaScores.back.score ?? 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leadership Ranking */}
      <Card className="rounded-2xl border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase text-muted-foreground">
            <Award className="h-4 w-4" />
            Ranking de Liderança (Regra Mãe)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {leadershipRanking.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma auditoria encontrada no período</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leadershipRanking.map((leader, index) => {
                const tierConfig = getTierConfig(leader.tier?.tier ?? null);
                const TierIcon = tierConfig.icon;
                const PositionIcon = POSITION_ICONS[leader.position] || Users;
                const isTopPerformer = index === 0;

                return (
                  <div
                    key={leader.position}
                    className={`flex items-center gap-4 p-3 rounded-xl transition-colors hover:bg-muted/50 ${
                      isTopPerformer ? "bg-primary/5" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-6 text-center">
                      <span
                        className={`text-sm font-medium ${
                          isTopPerformer ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </span>
                    </div>

                    {/* Icon */}
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        leader.areaType === "front" ? "bg-primary/10" : "bg-muted"
                      }`}
                    >
                      <PositionIcon
                        className={`h-4 w-4 ${
                          leader.areaType === "front" ? "text-primary" : "text-foreground"
                        }`}
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{leader.label}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground uppercase">
                          {leader.areaType}
                        </span>
                        {leader.failureCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {leader.failureCount} falha(s)
                          </span>
                        )}
                        {leader.breakdown.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {leader.breakdown.map((b) => `${b.label} ×${b.weight}`).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getScoreColor(leader.finalScore)}`}>
                        {leader.finalScore !== null ? `${leader.finalScore.toFixed(1)}%` : "—"}
                      </p>
                    </div>

                    {/* Tier Badge */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${tierConfig.bg}`}>
                      <TierIcon className={`h-3 w-3 ${tierConfig.color}`} />
                    </div>

                    {/* Action */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExportIndividualPDF(leader)}
                      className="h-8 w-8 shrink-0"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {generalScore !== null ? `${generalScore.toFixed(1)}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground uppercase">Média Global</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Users className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredAudits.length}</p>
                <p className="text-xs text-muted-foreground uppercase">Auditorias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                <TrendingUp className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredFailures.length}</p>
                <p className="text-xs text-muted-foreground uppercase">Falhas Totais</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Crown className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {positionResults.filter((p) => p.tier?.tier === "ouro").length}
                </p>
                <p className="text-xs text-muted-foreground uppercase">Líderes Ouro</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
