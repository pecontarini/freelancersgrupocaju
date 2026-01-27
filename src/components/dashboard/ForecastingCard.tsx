import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Target, Sparkles, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { TIER_CONFIG, type BonusTier, type SectorType } from "@/hooks/useBonusRules";
import { usePerformanceEntries, calculateProjection, type AggregatedPerformance } from "@/hooks/usePerformanceEntries";

interface ForecastingCardProps {
  currentFaturamento: number;
  currentReclamacoes: number;
  supervisaoScore: number;
  determineTier: (sector: SectorType, efficiency: number) => BonusTier | null;
  sector: SectorType;
  selectedLojaId?: string | null;
}

export function ForecastingCard({
  currentFaturamento,
  currentReclamacoes,
  supervisaoScore,
  determineTier,
  sector,
  selectedLojaId,
}: ForecastingCardProps) {
  // Fetch real weekly entries for selected store
  const { aggregatedByStore, getStoreAggregated } = usePerformanceEntries();
  
  // Get real aggregated data if store is selected
  const realAggregated: AggregatedPerformance | null = selectedLojaId 
    ? getStoreAggregated(selectedLojaId) 
    : null;

  // Calculate days in month and elapsed days
  const forecastData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;

    // Use REAL data from weekly entries if available, otherwise fall back to simulator values
    const hasRealData = realAggregated && realAggregated.entries_count > 0;
    
    // Calculate real projection based on actual entries
    const realProjection = hasRealData 
      ? calculateProjection(realAggregated, daysInMonth)
      : null;

    // Use real data for projection if available
    const effectiveFaturamento = hasRealData ? realAggregated!.total_faturamento : currentFaturamento;
    const effectiveReclamacoes = hasRealData ? realAggregated!.total_reclamacoes : currentReclamacoes;
    const effectiveDailyAverage = hasRealData 
      ? realAggregated!.daily_average_faturamento 
      : (currentDay > 0 ? currentFaturamento / currentDay : 0);

    // Forecasting formula using real daily average if available
    const projectedFaturamento = hasRealData 
      ? realProjection!.projectedFaturamento
      : effectiveDailyAverage * daysInMonth;

    // Project complaints based on real pace if available
    const projectedReclamacoes = hasRealData 
      ? realProjection!.projectedReclamacoes
      : Math.round((currentDay > 0 ? currentReclamacoes / currentDay : 0) * daysInMonth);

    // Calculate projected NPS efficiency
    const projectedNpsEfficiency = projectedReclamacoes > 0 
      ? projectedFaturamento / projectedReclamacoes 
      : projectedFaturamento;

    // Determine projected tier
    const projectedTier = determineTier(sector, projectedNpsEfficiency);
    const currentNpsEfficiency = effectiveReclamacoes > 0 
      ? effectiveFaturamento / effectiveReclamacoes 
      : effectiveFaturamento;
    const currentTier = determineTier(sector, currentNpsEfficiency);

    // Check for Red Flag risk
    const isRedFlagRisk = supervisaoScore < 80 || projectedTier === null;

    // Calculate gap to reach Gold tier (assuming 200k efficiency threshold)
    const goldThreshold = 200000; // This should come from nps_targets
    const gapToGold = goldThreshold - projectedNpsEfficiency;
    const additionalDailyRevenue = daysRemaining > 0 
      ? (gapToGold * (projectedReclamacoes || 1)) / daysRemaining 
      : 0;

    return {
      currentDay,
      daysInMonth,
      daysRemaining,
      dailyAverage: effectiveDailyAverage,
      projectedFaturamento,
      projectedReclamacoes,
      projectedNpsEfficiency,
      projectedTier,
      currentTier,
      isRedFlagRisk,
      gapToGold,
      additionalDailyRevenue,
      progressPercent: (currentDay / daysInMonth) * 100,
      hasRealData,
      confidenceLevel: realProjection?.confidenceLevel || 'low',
      daysWithEntries: realAggregated?.days_with_entries || 0,
      realFaturamento: effectiveFaturamento,
      realReclamacoes: effectiveReclamacoes,
    };
  }, [currentFaturamento, currentReclamacoes, supervisaoScore, determineTier, sector, realAggregated]);

  const getTierBadgeStyle = (tier: BonusTier | null) => {
    if (!tier) return "bg-destructive text-destructive-foreground";
    return `bg-gradient-to-r ${TIER_CONFIG[tier].gradient} text-white`;
  };

  const isUptrend = forecastData.projectedTier !== null && 
    (forecastData.projectedTier === "ouro" || 
     (forecastData.projectedTier === "prata" && forecastData.currentTier !== "ouro"));

  return (
    <Card className="rounded-2xl shadow-card overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <Target className="h-5 w-5 text-primary" />
          Projeção de Resultado
          <div className="ml-auto flex items-center gap-2">
            {forecastData.hasRealData && (
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  forecastData.confidenceLevel === 'high' 
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    : forecastData.confidenceLevel === 'medium'
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                {forecastData.daysWithEntries} dias reais
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              Dia {forecastData.currentDay} de {forecastData.daysInMonth}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Progress through month */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso do Mês</span>
            <span className="font-medium">{forecastData.progressPercent.toFixed(0)}%</span>
          </div>
          <div className="relative">
            <Progress value={forecastData.progressPercent} className="h-3" />
            {/* Projection shadow overlay */}
            <div 
              className="absolute top-0 left-0 h-3 bg-primary/20 rounded-full transition-all duration-500"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Current vs Projected */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
              Realizado
              {forecastData.hasRealData && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ACUMULADO</Badge>
              )}
            </p>
            <p className="text-xl font-bold">{formatCurrency(forecastData.realFaturamento)}</p>
            <p className="text-xs text-muted-foreground">
              Média diária: {formatCurrency(forecastData.dailyAverage)}/dia
            </p>
            {forecastData.hasRealData && (
              <p className="text-xs text-emerald-600">
                📊 Base: {forecastData.daysWithEntries} lançamentos reais
              </p>
            )}
          </div>
          <div className="rounded-xl bg-primary/10 p-4 space-y-2 relative overflow-hidden">
            <Sparkles className="absolute top-2 right-2 h-4 w-4 text-primary/40" />
            <p className="text-xs text-muted-foreground uppercase">Projeção Final</p>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(forecastData.projectedFaturamento)}
            </p>
            <div className="flex items-center gap-1 text-xs">
              {isUptrend ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-amber-500" />
              )}
              <span className={isUptrend ? "text-emerald-600" : "text-amber-600"}>
                {forecastData.daysRemaining} dias restantes
              </span>
            </div>
          </div>
        </div>

        {/* Tier Projection */}
        <div className={`rounded-2xl p-4 ${
          forecastData.isRedFlagRisk 
            ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/50" 
            : "bg-gradient-to-br from-muted/50 to-muted"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase mb-1">
                Tendência Atual
              </p>
              <Badge className={getTierBadgeStyle(forecastData.projectedTier)}>
                {forecastData.projectedTier 
                  ? `NÍVEL ${TIER_CONFIG[forecastData.projectedTier].label.toUpperCase()}`
                  : "🚨 RED FLAG"
                }
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase">Eficiência Projetada</p>
              <p className="text-lg font-bold">
                {formatCurrency(forecastData.projectedNpsEfficiency)}
              </p>
            </div>
          </div>

          {/* Alert for improvement needed */}
          {forecastData.projectedTier !== "ouro" && forecastData.gapToGold > 0 && !forecastData.isRedFlagRisk && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Para atingir o Ouro
                </p>
                <p className="text-muted-foreground">
                  Aumente as vendas em{" "}
                  <span className="font-bold text-foreground">
                    {formatCurrency(Math.max(0, forecastData.additionalDailyRevenue))}/dia
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Red Flag Alert */}
          {forecastData.isRedFlagRisk && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5 animate-pulse" />
              <div className="text-sm">
                <p className="font-medium text-destructive">
                  Atenção: Risco de Red Flag
                </p>
                <p className="text-muted-foreground">
                  {supervisaoScore < 80 
                    ? `Supervisão em ${supervisaoScore}% (mínimo 80%)`
                    : "NPS abaixo do nível Bronze"
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
