import { useState, useMemo } from "react";
import {
  Users,
  Award,
  TrendingUp,
  FileText,
  Crown,
  Medal,
  Trophy,
  ChevronRight,
  Loader2,
  BarChart3,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  POSITION_COLORS,
  categorizeItemToSector,
  getSectorsForArea,
  getChiefsForArea,
  type LeadershipPosition,
  type AreaType,
  type AuditSector,
} from "@/lib/sectorPositionMapping";

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
      return { label: "Ouro", icon: Crown, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" };
    case "prata":
      return { label: "Prata", icon: Medal, color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-950/30" };
    case "bronze":
      return { label: "Bronze", icon: Trophy, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" };
    case "red_flag":
      return { label: "Crítico", icon: TrendingUp, color: "text-destructive", bg: "bg-destructive/10" };
  }
}

function getScoreColor(score: number): string {
  if (score >= 95) return "text-emerald-600";
  if (score >= 85) return "text-amber-600";
  return "text-destructive";
}

function getScoreBgColor(score: number): string {
  if (score >= 95) return "bg-emerald-500";
  if (score >= 85) return "bg-amber-500";
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

  // Calculate area scores (FRONT vs BACK)
  const areaScores = useMemo(() => {
    const frontSectors = getSectorsForArea("front");
    const backSectors = getSectorsForArea("back");

    let frontFailures = 0;
    let backFailures = 0;

    filteredFailures.forEach((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      if (frontSectors.includes(sector)) {
        frontFailures++;
      } else if (backSectors.includes(sector)) {
        backFailures++;
      }
    });

    // Calculate total audit count for the period
    const totalAudits = filteredAudits.length;
    const estimatedItemsPerAudit = 50; // Estimated items per audit area

    // Calculate scores based on failure ratio
    const frontTotalEstimated = totalAudits * estimatedItemsPerAudit;
    const backTotalEstimated = totalAudits * estimatedItemsPerAudit;

    const frontScore = frontTotalEstimated > 0 
      ? Math.max(0, Math.min(100, 100 - (frontFailures / frontTotalEstimated * 100)))
      : 100;
    const backScore = backTotalEstimated > 0 
      ? Math.max(0, Math.min(100, 100 - (backFailures / backTotalEstimated * 100)))
      : 100;

    // Use actual audit scores if available
    const avgGlobalScore = filteredAudits.length > 0 
      ? filteredAudits.reduce((sum, a) => sum + a.global_score, 0) / filteredAudits.length 
      : 0;

    return {
      front: {
        score: filteredAudits.length > 0 ? Math.round(avgGlobalScore * (1 - frontFailures / (frontFailures + backFailures + 1))) : 0,
        failures: frontFailures,
        tier: getTierFromScore(avgGlobalScore),
      },
      back: {
        score: filteredAudits.length > 0 ? Math.round(avgGlobalScore * (1 - backFailures / (frontFailures + backFailures + 1))) : 0,
        failures: backFailures,
        tier: getTierFromScore(avgGlobalScore),
      },
      global: {
        score: Math.round(avgGlobalScore),
        tier: getTierFromScore(avgGlobalScore),
      }
    };
  }, [filteredAudits, filteredFailures]);

  // Calculate individual leadership scores
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

    positions.forEach((position) => {
      // Find sectors for this position
      const positionSectors: AuditSector[] = [];
      Object.entries(SECTOR_POSITION_MAP).forEach(([sector, config]) => {
        if (config.primaryChief === position || 
            (config.primaryChief === null && config.responsibleManager === position)) {
          positionSectors.push(sector as AuditSector);
        }
      });

      if (positionSectors.length === 0) return;

      // Count failures in these sectors
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

      // Calculate score based on failures
      const estimatedTotal = filteredAudits.length * positionSectors.length * 5; // Estimated items
      const score = estimatedTotal > 0 
        ? Math.max(0, Math.min(100, 100 - (failureCount / estimatedTotal * 500)))
        : 100;

      scores.push({
        position,
        name: POSITION_LABELS[position],
        score: Math.round(score),
        failureCount,
        totalItems: estimatedTotal,
        tier: getTierFromScore(score),
        areaType,
        sectors: positionSectors,
      });
    });

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }, [filteredAudits, filteredFailures]);

  const handleExportIndividualPDF = (leader: LeadershipScore) => {
    const leaderFailures = filteredFailures.filter((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      return leader.sectors.includes(sector);
    });

    generateLeadershipPDF({
      leaderName: leader.name,
      position: leader.position,
      score: leader.score,
      tier: leader.tier,
      failures: leaderFailures,
      dateRange,
      unitName: selectedUnidadeId ? getLojaName(selectedUnidadeId) : "Todas as Unidades",
    });
  };

  const handleExportConsolidatedPDF = (areaType: AreaType) => {
    const areaSectors = getSectorsForArea(areaType);
    const areaFailures = filteredFailures.filter((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      return areaSectors.includes(sector);
    });

    const areaLeaders = leadershipScores.filter((l) => l.areaType === areaType);

    generateConsolidatedPDF({
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
        <Card className={`rounded-2xl shadow-card border-l-4 ${
          areaScores.front.score >= 95 ? "border-l-emerald-500" :
          areaScores.front.score >= 85 ? "border-l-amber-500" : "border-l-destructive"
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold uppercase flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Média Unidade FRONT
              </CardTitle>
              <Badge variant="outline" className="uppercase">
                Gerentes
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-4xl font-bold ${getScoreColor(areaScores.front.score)}`}>
                  {areaScores.front.score}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {areaScores.front.failures} não conformidades
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {(() => {
                  const config = getTierConfig(areaScores.front.tier);
                  const Icon = config.icon;
                  return (
                    <Badge className={`${config.bg} ${config.color} border-0`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  );
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportConsolidatedPDF("front")}
                  className="gap-1"
                >
                  <FileText className="h-3 w-3" />
                  PDF
                </Button>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${getScoreBgColor(areaScores.front.score)}`}
                style={{ width: `${areaScores.front.score}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* BACK Card */}
        <Card className={`rounded-2xl shadow-card border-l-4 ${
          areaScores.back.score >= 95 ? "border-l-emerald-500" :
          areaScores.back.score >= 85 ? "border-l-amber-500" : "border-l-destructive"
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold uppercase flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-500" />
                Média Unidade BACK
              </CardTitle>
              <Badge variant="outline" className="uppercase">
                Chefes
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-4xl font-bold ${getScoreColor(areaScores.back.score)}`}>
                  {areaScores.back.score}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {areaScores.back.failures} não conformidades
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {(() => {
                  const config = getTierConfig(areaScores.back.tier);
                  const Icon = config.icon;
                  return (
                    <Badge className={`${config.bg} ${config.color} border-0`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  );
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportConsolidatedPDF("back")}
                  className="gap-1"
                >
                  <FileText className="h-3 w-3" />
                  PDF
                </Button>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${getScoreBgColor(areaScores.back.score)}`}
                style={{ width: `${areaScores.back.score}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leadership Ranking Table */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <Award className="h-5 w-5 text-primary" />
            Ranking de Liderança
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leadershipScores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma auditoria encontrada no período selecionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Líder</TableHead>
                    <TableHead>Cargo / Setor</TableHead>
                    <TableHead className="text-center">Nota Média</TableHead>
                    <TableHead className="text-center">Selo</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadershipScores.map((leader, index) => {
                    const tierConfig = getTierConfig(leader.tier);
                    const TierIcon = tierConfig.icon;
                    return (
                      <TableRow key={leader.position} className="hover:bg-muted/50">
                        <TableCell className="font-bold text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback 
                                style={{ backgroundColor: POSITION_COLORS[leader.position] }}
                                className="text-white text-xs"
                              >
                                {leader.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{leader.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {leader.failureCount} não conformidades
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="uppercase text-xs">
                            {leader.areaType === "front" ? "FRONT" : "BACK"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xl font-bold ${getScoreColor(leader.score)}`}>
                            {leader.score}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${tierConfig.bg} ${tierConfig.color} border-0`}>
                            <TierIcon className="h-3 w-3 mr-1" />
                            {tierConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExportIndividualPDF(leader)}
                            className="gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            PDF Performance
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period Summary */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Período: {dateRange.from ? format(dateRange.from, "dd/MM/yyyy", { locale: ptBR }) : "—"} 
          {" a "} 
          {dateRange.to ? format(dateRange.to, "dd/MM/yyyy", { locale: ptBR }) : "—"}
          {" • "}
          {filteredAudits.length} auditoria(s) analisada(s)
        </p>
      </div>
    </div>
  );
}
