import { useMemo } from "react";
import { Award, TrendingUp, Target, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  SECTOR_POSITION_MAP, 
  POSITION_LABELS,
  POSITION_COLORS,
  getSectorsByPosition,
  categorizeItemToSector,
  isChiefPosition,
  type LeadershipPosition,
  type AuditSector,
} from "@/lib/sectorPositionMapping";
import { SupervisionFailure } from "@/hooks/useSupervisionAudits";

interface MyPerformanceCardProps {
  position: LeadershipPosition;
  failures: SupervisionFailure[];
  globalScore: number;
  className?: string;
}

// Tier configuration
const TIER_CONFIG = {
  ouro: { label: 'Ouro', minScore: 95, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  prata: { label: 'Prata', minScore: 85, color: 'text-slate-400', bg: 'bg-slate-400/10' },
  bronze: { label: 'Bronze', minScore: 75, color: 'text-orange-600', bg: 'bg-orange-600/10' },
  redFlag: { label: 'Red Flag', minScore: 0, color: 'text-destructive', bg: 'bg-destructive/10' },
};

function getTierForScore(score: number): keyof typeof TIER_CONFIG {
  if (score >= 95) return 'ouro';
  if (score >= 85) return 'prata';
  if (score >= 75) return 'bronze';
  return 'redFlag';
}

function getNextTierInfo(currentScore: number): { nextTier: string; pointsNeeded: number } | null {
  if (currentScore >= 95) return null; // Already at top tier
  if (currentScore >= 85) return { nextTier: 'Ouro', pointsNeeded: 95 - currentScore };
  if (currentScore >= 75) return { nextTier: 'Prata', pointsNeeded: 85 - currentScore };
  return { nextTier: 'Bronze', pointsNeeded: 75 - currentScore };
}

export function MyPerformanceCard({
  position,
  failures,
  globalScore,
  className = "",
}: MyPerformanceCardProps) {
  // Get sectors this position is responsible for
  const mySectors = useMemo(() => getSectorsByPosition(position), [position]);
  
  // Filter failures for this position's sectors
  const myFailures = useMemo(() => {
    return failures.filter((failure) => {
      const sector = categorizeItemToSector(failure.item_name, failure.category);
      return mySectors.includes(sector);
    });
  }, [failures, mySectors]);

  // Calculate sector-specific scores
  const sectorScores = useMemo(() => {
    const scores: Record<AuditSector, { total: number; pending: number; score: number }> = {} as any;
    
    mySectors.forEach((sector) => {
      const sectorFailures = myFailures.filter(
        (f) => categorizeItemToSector(f.item_name, f.category) === sector
      );
      const pending = sectorFailures.filter((f) => f.status === 'pending').length;
      const total = sectorFailures.length;
      // Inverse score: fewer failures = higher score
      // This is a simplified calculation - in reality you'd use actual checklist totals
      const score = total === 0 ? 100 : Math.max(0, 100 - (pending * 5));
      
      scores[sector] = { total, pending, score };
    });
    
    return scores;
  }, [mySectors, myFailures]);

  // Calculate position score
  const myScore = useMemo(() => {
    if (isChiefPosition(position)) {
      // Chiefs get only their specific sector score
      const sectors = mySectors.filter((s) => {
        const config = SECTOR_POSITION_MAP[s];
        return config.primaryChief === position;
      });
      
      if (sectors.length === 0) return globalScore;
      
      const scores = sectors.map((s) => sectorScores[s]?.score || 100);
      return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    } else {
      // Managers get weighted average of all sectors under their supervision
      const managerSectors = mySectors.filter((s) => {
        const config = SECTOR_POSITION_MAP[s];
        return config.responsibleManager === position;
      });
      
      if (managerSectors.length === 0) return globalScore;
      
      const scores = managerSectors.map((s) => sectorScores[s]?.score || 100);
      return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }, [position, mySectors, sectorScores, globalScore]);

  const tier = getTierForScore(myScore);
  const tierConfig = TIER_CONFIG[tier];
  const nextTierInfo = getNextTierInfo(myScore);
  const pendingCount = myFailures.filter((f) => f.status === 'pending').length;
  const positionColor = POSITION_COLORS[position];

  return (
    <Card className={`rounded-2xl shadow-card overflow-hidden ${className}`}>
      {/* Header with position color accent */}
      <div 
        className="h-2"
        style={{ backgroundColor: positionColor }}
      />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base uppercase flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Minha Performance
          </CardTitle>
          <Badge 
            variant="outline" 
            style={{ borderColor: positionColor, color: positionColor }}
          >
            {POSITION_LABELS[position]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score */}
        <div className="text-center py-4">
          <div className={`text-5xl font-bold ${tierConfig.color}`}>
            {myScore}%
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            {tier === 'redFlag' ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle className="h-4 w-4" style={{ color: positionColor }} />
            )}
            <span className={`font-semibold ${tierConfig.color}`}>
              {tierConfig.label}
            </span>
          </div>
        </div>

        {/* Progress to next tier */}
        {nextTierInfo && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" />
                Próximo Nível: {nextTierInfo.nextTier}
              </span>
              <span className="font-medium text-primary">
                +{nextTierInfo.pointsNeeded.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={((myScore - (tier === 'redFlag' ? 0 : tier === 'bronze' ? 75 : tier === 'prata' ? 85 : 95)) / 10) * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Pending Actions */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Pendências no meu setor</span>
          </div>
          <Badge variant={pendingCount > 0 ? "destructive" : "secondary"}>
            {pendingCount}
          </Badge>
        </div>

        {/* Sector breakdown for managers */}
        {!isChiefPosition(position) && mySectors.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase font-medium">Setores sob supervisão</p>
            <div className="grid grid-cols-2 gap-2">
              {mySectors.slice(0, 4).map((sector) => {
                const config = SECTOR_POSITION_MAP[sector];
                const score = sectorScores[sector];
                return (
                  <div 
                    key={sector}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm"
                  >
                    <span className="truncate">{config.displayName}</span>
                    <span className={`font-medium ${getTierForScore(score?.score || 100) === 'redFlag' ? 'text-destructive' : 'text-primary'}`}>
                      {score?.pending || 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
