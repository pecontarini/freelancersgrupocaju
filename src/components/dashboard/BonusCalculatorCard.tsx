import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Award,
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCargos,
  useMetasCargo,
  META_LABELS,
  TIER_CONFIG,
  type Cargo,
  type CodigoMeta,
  type BonusTier,
} from "@/hooks/useCargos";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { formatCurrency } from "@/lib/formatters";

interface BonusCalculatorProps {
  lojaId: string;
  cargoId: string;
  referenciaMes?: string;
}

// Calculate tier from score
function getTierFromScore(score: number): BonusTier | null {
  if (score >= 95) return "ouro";
  if (score >= 90) return "prata";
  if (score >= 80) return "bronze";
  if (score >= 50) return "aceitavel";
  return null;
}

// Get tier bonus percentage based on cargo category
function getTierPercentage(tier: BonusTier, isGerente: boolean): number {
  const percentages = isGerente
    ? { ouro: 100, prata: 75, bronze: 50, aceitavel: 25 }
    : { ouro: 100, prata: 66.6, bronze: 33.3, aceitavel: 0 };
  return percentages[tier];
}

export function BonusCalculatorCard({ lojaId, cargoId, referenciaMes }: BonusCalculatorProps) {
  const currentMonth = referenciaMes || format(new Date(), "yyyy-MM");
  
  const { cargos } = useCargos();
  const { metas, getMetasByCargo } = useMetasCargo(cargoId);
  const { avaliacoes, getScore } = useAvaliacoes(lojaId, currentMonth);

  const cargo = useMemo(() => cargos.find(c => c.id === cargoId), [cargos, cargoId]);
  const cargoMetas = useMemo(() => getMetasByCargo(cargoId), [cargoId, getMetasByCargo]);
  const isGerente = cargo?.categoria === "gerencia";
  const poteMaximo = cargo?.pote_variavel_max || 3000;

  // Calculate bonus for each meta
  const metaResults = useMemo(() => {
    return cargoMetas.map((meta) => {
      const score = getScore(lojaId, cargoId, meta.codigo_meta, currentMonth);
      const tier = getTierFromScore(score);
      const percentage = tier ? getTierPercentage(tier, isGerente) : 0;
      const amount = (meta.teto_valor * percentage) / 100;

      return {
        meta,
        score,
        tier,
        percentage,
        amount,
        isRedFlag: tier === null,
      };
    });
  }, [cargoMetas, lojaId, cargoId, currentMonth, getScore, isGerente]);

  // Check for red flag
  const hasRedFlag = metaResults.some((r) => r.isRedFlag);

  // Calculate total bonus
  const totalBonus = useMemo(() => {
    if (hasRedFlag) return 0;
    return metaResults.reduce((sum, r) => sum + r.amount, 0);
  }, [metaResults, hasRedFlag]);

  // Calculate overall score (weighted average)
  const overallScore = useMemo(() => {
    const totalWeight = cargoMetas.reduce((sum, m) => sum + m.peso, 0);
    const weightedSum = metaResults.reduce((sum, r) => sum + r.score * r.meta.peso, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }, [cargoMetas, metaResults]);

  const overallTier = getTierFromScore(overallScore);

  if (!cargo) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Selecione um cargo para calcular o bônus.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Cálculo de Bônus - {cargo.nome}
            </CardTitle>
            <CardDescription>
              Referência: {format(new Date(currentMonth + "-01"), "MMMM yyyy", { locale: ptBR })}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Pote Máximo</p>
            <p className="font-bold text-lg">{formatCurrency(poteMaximo)}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Status */}
        <div className={`rounded-xl p-4 ${hasRedFlag ? "bg-destructive/10" : "bg-primary/5"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasRedFlag ? (
                <AlertTriangle className="h-8 w-8 text-destructive" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-primary" />
              )}
              <div>
                <p className="font-medium">
                  {hasRedFlag ? "Red Flag Ativo" : "Elegível para Bônus"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Nota média: {overallScore.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="text-right">
              {hasRedFlag ? (
                <Badge variant="destructive" className="text-lg px-4 py-1">
                  R$ 0,00
                </Badge>
              ) : overallTier ? (
                <div>
                  <Badge className={`bg-gradient-to-r ${TIER_CONFIG[overallTier].gradient} text-white text-lg px-4 py-1`}>
                    {formatCurrency(totalBonus)}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {TIER_CONFIG[overallTier].label}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Meta Breakdown */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meta</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metaResults.map((result) => (
                <TableRow key={result.meta.id} className={result.isRedFlag ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">
                    {META_LABELS[result.meta.codigo_meta]}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={result.score} className="w-16 h-2" />
                      <span className="text-sm">{result.score.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {result.isRedFlag ? (
                      <Badge variant="destructive">RED FLAG</Badge>
                    ) : result.tier ? (
                      <Badge className={`bg-gradient-to-r ${TIER_CONFIG[result.tier].gradient} text-white`}>
                        {TIER_CONFIG[result.tier].label}
                      </Badge>
                    ) : (
                      <Badge variant="outline">—</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {result.isRedFlag ? (
                      <span className="text-destructive">R$ 0,00</span>
                    ) : (
                      formatCurrency(result.amount)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Tier Legend */}
        <div className="grid grid-cols-4 gap-2">
          {(["ouro", "prata", "bronze", "aceitavel"] as const).map((tier) => {
            const config = TIER_CONFIG[tier];
            return (
              <div
                key={tier}
                className={`p-2 rounded-lg text-center bg-gradient-to-br ${config.gradient} text-white opacity-60`}
              >
                <p className="text-xs font-medium">{config.label}</p>
                <p className="text-xs">≥{config.minPercent}%</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
