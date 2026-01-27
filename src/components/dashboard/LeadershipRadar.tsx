import { useMemo } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, TrendingUp } from "lucide-react";
import { useStorePerformance } from "@/hooks/useBonusRules";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { format } from "date-fns";

interface LeadershipRadarProps {
  lojaId: string | null;
  storeBudget?: {
    freelancer_budget: number;
    maintenance_budget: number;
    uniforms_budget: number;
    cleaning_budget: number;
    total_budget: number | null;
  };
  currentSpend?: number;
}

interface RadarDataPoint {
  subject: string;
  fullMark: number;
  leader: number;
  network: number;
}

export function LeadershipRadar({ lojaId, storeBudget, currentSpend = 0 }: LeadershipRadarProps) {
  const { performances, getPerformancesByMonth } = useStorePerformance();
  const { options: lojas } = useConfigLojas();
  
  const currentMonthYear = format(new Date(), "yyyy-MM");

  // Calculate radar data
  const radarData = useMemo((): RadarDataPoint[] => {
    const monthPerformances = getPerformancesByMonth(currentMonthYear);
    const storePerformance = performances.find(
      p => p.loja_id === lojaId && p.month_year === currentMonthYear
    );

    // Calculate network averages
    const networkAvg = {
      faturamento: monthPerformances.reduce((sum, p) => sum + p.faturamento, 0) / Math.max(monthPerformances.length, 1),
      nps: monthPerformances.reduce((sum, p) => sum + (p.nps_score || 0), 0) / Math.max(monthPerformances.length, 1),
      supervisao: monthPerformances.reduce((sum, p) => sum + p.supervisao_score, 0) / Math.max(monthPerformances.length, 1),
      tempoPrato: monthPerformances.reduce((sum, p) => sum + (p.tempo_prato_avg || 0), 0) / Math.max(monthPerformances.length, 1),
    };

    // Normalize values to 0-100 scale for radar display
    const normalize = (value: number, max: number) => Math.min(100, (value / max) * 100);

    // Leader values (or defaults if no data)
    const leaderFaturamento = storePerformance?.faturamento || 0;
    const leaderNps = storePerformance?.nps_score || 0;
    const leaderSupervisao = storePerformance?.supervisao_score || 0;
    const leaderTempoPrato = storePerformance?.tempo_prato_avg || 0;

    // Budget efficiency (lower spend % = better efficiency)
    const totalBudget = storeBudget?.total_budget || 
      ((storeBudget?.freelancer_budget || 0) + 
       (storeBudget?.maintenance_budget || 0) + 
       (storeBudget?.uniforms_budget || 0) + 
       (storeBudget?.cleaning_budget || 0));
    
    const budgetEfficiency = totalBudget > 0 
      ? Math.max(0, 100 - ((currentSpend / totalBudget) * 100))
      : 50;

    // Tempo de prato efficiency (lower time = better, invert scale)
    const tempoEfficiency = leaderTempoPrato > 0 
      ? Math.max(0, 100 - ((leaderTempoPrato / 30) * 100)) // 30 min = 0%, 0 min = 100%
      : 50;

    const networkTempoEfficiency = networkAvg.tempoPrato > 0
      ? Math.max(0, 100 - ((networkAvg.tempoPrato / 30) * 100))
      : 50;

    return [
      {
        subject: "Financeiro",
        fullMark: 100,
        leader: normalize(leaderFaturamento, 500000), // 500k = 100%
        network: normalize(networkAvg.faturamento, 500000),
      },
      {
        subject: "NPS",
        fullMark: 100,
        leader: normalize(leaderNps, 200000), // 200k efficiency = 100%
        network: normalize(networkAvg.nps, 200000),
      },
      {
        subject: "Supervisão",
        fullMark: 100,
        leader: leaderSupervisao, // Already 0-100%
        network: networkAvg.supervisao,
      },
      {
        subject: "Budget",
        fullMark: 100,
        leader: budgetEfficiency,
        network: 70, // Network average assumption
      },
      {
        subject: "Operação",
        fullMark: 100,
        leader: tempoEfficiency,
        network: networkTempoEfficiency,
      },
    ];
  }, [lojaId, performances, getPerformancesByMonth, currentMonthYear, storeBudget, currentSpend]);

  // Calculate overall score
  const overallScore = useMemo(() => {
    const leaderSum = radarData.reduce((sum, d) => sum + d.leader, 0);
    return Math.round(leaderSum / radarData.length);
  }, [radarData]);

  // Get score badge color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-destructive";
  };

  const storeName = lojas.find(l => l.id === lojaId)?.nome || "Unidade";

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              <User className="h-5 w-5 text-primary" />
              Radar de Competências
            </CardTitle>
            <CardDescription>
              Performance do líder vs. média da rede
            </CardDescription>
          </div>
          <Badge className={`${getScoreColor(overallScore)} text-white`}>
            Score: {overallScore}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!lojaId ? (
          <div className="text-center py-8 text-muted-foreground">
            Selecione uma unidade para visualizar o radar de competências.
          </div>
        ) : (
          <>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid 
                    stroke="hsl(var(--border))" 
                    strokeDasharray="3 3"
                  />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ 
                      fill: "hsl(var(--muted-foreground))", 
                      fontSize: 12,
                      fontWeight: 500 
                    }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]} 
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    axisLine={false}
                  />
                  <Radar
                    name="Média da Rede"
                    dataKey="network"
                    stroke="hsl(var(--muted-foreground))"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.2}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <Radar
                    name={storeName}
                    dataKey="leader"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.4}
                    strokeWidth={2}
                  />
                  <Legend 
                    wrapperStyle={{ 
                      paddingTop: "20px",
                      fontSize: "12px"
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Insights */}
            <div className="mt-4 space-y-2">
              {radarData.map((point) => {
                const diff = point.leader - point.network;
                const isAbove = diff > 5;
                const isBelow = diff < -5;
                
                if (!isAbove && !isBelow) return null;

                return (
                  <div 
                    key={point.subject}
                    className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                      isAbove ? "bg-emerald-500/10" : "bg-amber-500/10"
                    }`}
                  >
                    <TrendingUp className={`h-4 w-4 ${
                      isAbove ? "text-emerald-500" : "text-amber-500 rotate-180"
                    }`} />
                    <span>
                      <span className="font-medium">{point.subject}:</span>{" "}
                      {isAbove ? (
                        <span className="text-emerald-600">
                          +{diff.toFixed(0)}% acima da média
                        </span>
                      ) : (
                        <span className="text-amber-600">
                          {Math.abs(diff).toFixed(0)}% abaixo da média
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
