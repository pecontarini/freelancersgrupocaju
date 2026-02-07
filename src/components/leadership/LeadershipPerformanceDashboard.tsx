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
  type LucideIcon,
} from "lucide-react";
import { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { DateRangeFilter as DateRangeFilterComponent } from "@/components/action-plan/DateRangeFilter";
import { generateLeadershipPDF, generateConsolidatedPDF } from "@/lib/leadershipPdfGenerator";
import {
  SECTOR_POSITION_MAP,
  POSITION_LABELS,
  categorizeItemToSector,
  getSectorsForArea,
  type LeadershipPosition,
  type AreaType,
  type AuditSector,
} from "@/lib/sectorPositionMapping";

// Clean icon mapping for each position
const POSITION_ICONS: Record<LeadershipPosition, LucideIcon> = {
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

interface LeadershipScore {
  position: LeadershipPosition;
  name: string;
  score: number;
  failureCount: number;
  totalItems: number;
  tier: "ouro" | "prata" | "bronze" | "red_flag";
  areaType: AreaType;
  sectors: AuditSector[];
}

function getTierFromScore(score: number): "ouro" | "prata" | "bronze" | "red_flag" {
  if (score >= 95) return "ouro";
  if (score >= 85) return "prata";
  if (score >= 75) return "bronze";
  return "red_flag";
}

function getTierConfig(tier: "ouro" | "prata" | "bronze" | "red_flag") {
  switch (tier) {
    case "ouro":
      return { label: "Ouro", icon: Crown, color: "text-primary", bg: "bg-primary/10" };
    case "prata":
      return { label: "Prata", icon: Medal, color: "text-muted-foreground", bg: "bg-muted" };
    case "bronze":
      return { label: "Bronze", icon: Trophy, color: "text-foreground", bg: "bg-muted/50" };
    case "red_flag":
      return { label: "Crítico", icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10" };
  }
}

function getScoreColor(score: number): string {
  if (score >= 95) return "text-primary";
  if (score >= 85) return "text-muted-foreground";
  return "text-destructive";
}

function getScoreBgColor(score: number): string {
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

  const { audits, failures, isLoadingAudits, isLoadingFailures } = useSupervisionAudits(
    selectedUnidadeId,
    undefined,
    dateRange ? { from: dateRange.from, to: dateRange.to } : undefined
  );

  const getLojaName = (lojaId: string) => {
    return lojas.find((l) => l.id === lojaId)?.nome || "Desconhecida";
  };

  // Filter audits by selected unit if any
  const filteredAudits = useMemo(() => {
    if (!selectedUnidadeId) return audits;
    return audits.filter(a => a.loja_id === selectedUnidadeId);
  }, [audits, selectedUnidadeId]);

  // Filter failures by selected unit and relevant audits
  const relevantAuditIds = useMemo(() => {
    return new Set(filteredAudits.map(a => a.id));
  }, [filteredAudits]);

  const filteredFailures = useMemo(() => {
    let result = failures.filter(f => relevantAuditIds.has(f.audit_id));
    if (selectedUnidadeId) {
      result = result.filter(f => f.loja_id === selectedUnidadeId);
    }
    return result;
  }, [failures, relevantAuditIds, selectedUnidadeId]);

  // Calculate area scores (FRONT vs BACK) using REAL database data
  const areaScores = useMemo(() => {
    const frontSectors = getSectorsForArea("front");
    const backSectors = getSectorsForArea("back");

    let frontFailures = 0;
    let backFailures = 0;

    // Count real failures by sector from the database
    filteredFailures.forEach((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      if (frontSectors.includes(sector)) {
        frontFailures++;
      } else if (backSectors.includes(sector)) {
        backFailures++;
      }
    });

    // Calculate average global score from REAL audit data
    const avgGlobalScore = filteredAudits.length > 0 
      ? filteredAudits.reduce((sum, a) => sum + a.global_score, 0) / filteredAudits.length 
      : 0;

    const totalFailures = frontFailures + backFailures;
    
    // Calculate proportional scores based on failure distribution
    // If no failures, both areas get the global score
    let frontScore = avgGlobalScore;
    let backScore = avgGlobalScore;

    if (totalFailures > 0) {
      // Distribute penalty proportionally to failure count
      const frontPenaltyRatio = frontFailures / totalFailures;
      const backPenaltyRatio = backFailures / totalFailures;
      const globalPenalty = 100 - avgGlobalScore;
      
      // Apply weighted penalties - area with more failures gets more penalty
      frontScore = frontFailures === 0 ? 100 : Math.max(0, 100 - (globalPenalty * frontPenaltyRatio * 2));
      backScore = backFailures === 0 ? 100 : Math.max(0, 100 - (globalPenalty * backPenaltyRatio * 2));
    }

    return {
      front: {
        score: Math.round(frontScore),
        failures: frontFailures,
        tier: getTierFromScore(frontScore),
        auditCount: filteredAudits.length,
      },
      back: {
        score: Math.round(backScore),
        failures: backFailures,
        tier: getTierFromScore(backScore),
        auditCount: filteredAudits.length,
      },
      global: {
        score: Math.round(avgGlobalScore),
        tier: getTierFromScore(avgGlobalScore),
        auditCount: filteredAudits.length,
      }
    };
  }, [filteredAudits, filteredFailures]);

  // Calculate individual leadership scores using REAL database data
  const leadershipScores = useMemo(() => {
    const scores: LeadershipScore[] = [];
    const positions: LeadershipPosition[] = [
      "gerente_front",
      "gerente_back", 
      "chefe_salao",
      "chefe_apv",
      "chefe_bar",
      "chefe_cozinha",
      "chefe_parrilla",
      "chefe_sushi",
    ];

    // Get global average score from real audits
    const avgGlobalScore = filteredAudits.length > 0 
      ? filteredAudits.reduce((sum, a) => sum + a.global_score, 0) / filteredAudits.length 
      : 0;

    // Count total failures for weight calculation
    const totalSystemFailures = filteredFailures.length;

    positions.forEach((position) => {
      // Find sectors for this position based on responsibility mapping
      const positionSectors: AuditSector[] = [];
      Object.entries(SECTOR_POSITION_MAP).forEach(([sector, config]) => {
        if (config.primaryChief === position || 
            (config.primaryChief === null && config.responsibleManager === position)) {
          positionSectors.push(sector as AuditSector);
        }
      });

      if (positionSectors.length === 0) return;

      // Count REAL failures from database in these sectors
      let failureCount = 0;
      filteredFailures.forEach((f) => {
        const sector = categorizeItemToSector(f.item_name, f.category);
        if (positionSectors.includes(sector)) {
          failureCount++;
        }
      });

      const areaType = position.includes("front") || position === "chefe_salao" || position === "chefe_apv" 
        ? "front" as AreaType 
        : "back" as AreaType;

      // Calculate score based on real failure proportion
      // Leaders with no failures get 100%, others get penalized proportionally
      let score = 100;
      if (totalSystemFailures > 0 && failureCount > 0) {
        // Calculate penalty based on failure weight
        const failureRatio = failureCount / totalSystemFailures;
        const globalPenalty = 100 - avgGlobalScore;
        // Apply weighted penalty - leaders with more failures get more penalty
        score = Math.max(0, 100 - (globalPenalty * failureRatio * 8));
      } else if (filteredAudits.length > 0 && failureCount === 0) {
        // No failures for this leader = perfect score
        score = 100;
      } else if (filteredAudits.length === 0) {
        // No audits in period = no data
        score = 0;
      }

      scores.push({
        position,
        name: POSITION_LABELS[position],
        score: Math.round(score),
        failureCount,
        totalItems: filteredAudits.length * positionSectors.length,
        tier: getTierFromScore(score),
        areaType,
        sectors: positionSectors,
      });
    });

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }, [filteredAudits, filteredFailures]);

  const handleExportIndividualPDF = async (leader: LeadershipScore) => {
    const leaderFailures = filteredFailures.filter((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      return leader.sectors.includes(sector);
    });

    await generateLeadershipPDF({
      leaderName: leader.name,
      position: leader.position,
      score: leader.score,
      tier: leader.tier,
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

    const areaLeaders = leadershipScores.filter((l) => l.areaType === areaType);

    await generateConsolidatedPDF({
      areaType,
      areaScore: areaType === "front" ? areaScores.front.score : areaScores.back.score,
      leaders: areaLeaders,
      failures: areaFailures,
      dateRange,
      unitName: selectedUnidadeId ? getLojaName(selectedUnidadeId) : "Todas as Unidades",
    });
  };

  if (isLoadingAudits || isLoadingFailures) {
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
              Análise hierárquica de desempenho por liderança
            </p>
          </div>
        </div>

        <DateRangeFilterComponent
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
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
                  {areaScores.front.score}%
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
                style={{ width: `${areaScores.front.score}%` }}
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
                  {areaScores.back.score}%
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
                style={{ width: `${areaScores.back.score}%` }}
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
            Ranking de Liderança
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {leadershipScores.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma auditoria encontrada no período</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leadershipScores.map((leader, index) => {
                const tierConfig = getTierConfig(leader.tier);
                const TierIcon = tierConfig.icon;
                const PositionIcon = POSITION_ICONS[leader.position];
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
                      <span className={`text-sm font-medium ${
                        isTopPerformer ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {index + 1}
                      </span>
                    </div>

                    {/* Icon */}
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      leader.areaType === "front" ? "bg-primary/10" : "bg-muted"
                    }`}>
                      <PositionIcon className={`h-4 w-4 ${
                        leader.areaType === "front" ? "text-primary" : "text-foreground"
                      }`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{leader.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground uppercase">
                          {leader.areaType}
                        </span>
                        {leader.failureCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {leader.failureCount} falha(s)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getScoreColor(leader.score)}`}>
                        {leader.score}%
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
                <p className="text-2xl font-bold">{areaScores.global.score}%</p>
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
                  {leadershipScores.filter(l => l.tier === "ouro").length}
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
