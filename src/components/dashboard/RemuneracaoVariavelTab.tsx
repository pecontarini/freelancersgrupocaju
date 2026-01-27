import { useState, useMemo } from "react";
import {
  TrendingUp,
  Award,
  Target,
  Trophy,
  Medal,
  Star,
  AlertTriangle,
  Clock,
  Users,
  ChefHat,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import {
  useNpsTargets,
  useBonusRules,
  useBonusConfig,
  useStorePerformance,
  calculateBonus,
  checkRedFlag,
  TIER_CONFIG,
  POSITION_LABELS,
  type PositionType,
  type SectorType,
  type BonusTier,
} from "@/hooks/useBonusRules";

interface RemuneracaoVariavelTabProps {
  selectedUnidadeId: string | null;
}

// Brand mappings for filtering
const BRAND_PATTERNS: Record<string, string[]> = {
  caminito: ["CAMINITO", "MULT"],
  nazo: ["NAZO", "NFE"],
  frangobrasil: ["FB", "FRANGO"],
  caju: ["CAJU"],
};

export function RemuneracaoVariavelTab({
  selectedUnidadeId,
}: RemuneracaoVariavelTabProps) {
  const { options: lojas } = useConfigLojas();
  const { targets, determineTier } = useNpsTargets();
  const { rules, getPercentage } = useBonusRules();
  const { configs, getConfig } = useBonusConfig();
  const { performances, getPerformancesByMonth } = useStorePerformance();

  // Simulator state
  const [simulatedFaturamento, setSimulatedFaturamento] = useState([100000]);
  const [simulatedReclamacoes, setSimulatedReclamacoes] = useState([1]);
  const [simulatedSupervisao, setSimulatedSupervisao] = useState([85]);
  const [simulatedTempoPrato, setSimulatedTempoPrato] = useState([15]);
  const [selectedPosition, setSelectedPosition] = useState<PositionType>("gerente_front");
  const [selectedSector, setSelectedSector] = useState<SectorType>("salao");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const currentMonthYear = format(new Date(), "yyyy-MM");

  // Calculate NPS efficiency (Faturamento / Reclamações)
  const npsEfficiency = useMemo(() => {
    if (simulatedReclamacoes[0] === 0) return simulatedFaturamento[0];
    return simulatedFaturamento[0] / simulatedReclamacoes[0];
  }, [simulatedFaturamento, simulatedReclamacoes]);

  // Determine the tier based on efficiency
  const currentTier = useMemo(() => {
    return determineTier(selectedSector, npsEfficiency);
  }, [selectedSector, npsEfficiency, determineTier]);

  // Check for red flag
  const isRedFlag = useMemo(() => {
    return checkRedFlag(simulatedSupervisao[0], currentTier, 80);
  }, [simulatedSupervisao, currentTier]);

  // Get base bonus value for selected store and position
  const baseValue = useMemo(() => {
    if (!selectedUnidadeId) return 3500; // Default value
    const config = getConfig(selectedUnidadeId, selectedPosition, currentMonthYear);
    return config?.base_bonus_value || 3500;
  }, [selectedUnidadeId, selectedPosition, currentMonthYear, getConfig]);

  // Calculate final bonus
  const bonusResult = useMemo(() => {
    return calculateBonus(baseValue, currentTier, rules, selectedPosition, isRedFlag);
  }, [baseValue, currentTier, rules, selectedPosition, isRedFlag]);

  // Filter stores by brand
  const filteredStores = useMemo(() => {
    if (brandFilter === "all") return lojas;
    const patterns = BRAND_PATTERNS[brandFilter] || [];
    return lojas.filter((loja) =>
      patterns.some((pattern) => loja.nome.toUpperCase().includes(pattern))
    );
  }, [lojas, brandFilter]);

  // Get current month performances with store data for ranking
  const rankingData = useMemo(() => {
    const monthPerformances = getPerformancesByMonth(currentMonthYear);
    
    return filteredStores
      .map((loja) => {
        const perf = monthPerformances.find((p) => p.loja_id === loja.id);
        const nps = perf?.nps_score || 0;
        const supervisao = perf?.supervisao_score || 0;
        const faturamento = perf?.faturamento || 0;
        
        // Calculate average score
        const avg = supervisao > 0 ? ((nps > 0 ? 50 : 0) + supervisao) / (nps > 0 ? 2 : 1) : 0;
        
        return {
          id: loja.id,
          nome: loja.nome,
          nps: nps,
          supervisao: supervisao,
          faturamento: faturamento,
          avg: avg,
        };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [filteredStores, getPerformancesByMonth, currentMonthYear]);

  // Get color based on value
  const getGaugeColor = (value: number) => {
    if (value >= 90) return "text-emerald-500";
    if (value >= 75) return "text-amber-500";
    if (value >= 60) return "text-orange-500";
    return "text-red-500";
  };

  // Gauge indicator component
  const GaugeIndicator = ({
    value,
    label,
    target,
    icon: Icon,
  }: {
    value: number;
    label: string;
    target: number;
    icon?: React.ElementType;
  }) => {
    const percentage = Math.min((value / target) * 100, 100);

    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="relative h-32 w-32">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 50">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 1.26}, 126`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
              {Icon && <Icon className={`h-5 w-5 mb-1 ${getGaugeColor(percentage)}`} />}
              <span className={`text-2xl font-bold ${getGaugeColor(percentage)}`}>
                {typeof value === "number" && value > 1000
                  ? formatCurrency(value)
                  : `${value.toFixed(0)}%`}
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium uppercase text-muted-foreground">
            {label}
          </p>
          <p className="text-xs text-muted-foreground">
            Meta: {target > 1000 ? formatCurrency(target) : `${target}%`}
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">
              Performance Mensal
            </h2>
            <p className="text-muted-foreground">
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      {/* Bonus Simulator */}
      <Card className="rounded-2xl shadow-card overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <Star className="h-5 w-5 text-amber-500" />
            Simulador de Bônus
          </CardTitle>
          <CardDescription>
            Ajuste os indicadores para simular o bônus estimado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Position and Sector selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium uppercase">Cargo</label>
              <Select
                value={selectedPosition}
                onValueChange={(v) => setSelectedPosition(v as PositionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(POSITION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium uppercase">Setor</label>
              <Select
                value={selectedSector}
                onValueChange={(v) => setSelectedSector(v as SectorType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salao">Salão</SelectItem>
                  <SelectItem value="back">Back</SelectItem>
                  <SelectItem value="apv">APV</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Faturamento do Setor
                </label>
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(simulatedFaturamento[0])}
                </span>
              </div>
              <Slider
                value={simulatedFaturamento}
                onValueChange={setSimulatedFaturamento}
                min={0}
                max={200000}
                step={1000}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Número de Reclamações
                </label>
                <span className="text-sm font-bold text-destructive">
                  {simulatedReclamacoes[0]}
                </span>
              </div>
              <Slider
                value={simulatedReclamacoes}
                onValueChange={setSimulatedReclamacoes}
                min={0}
                max={20}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  % Supervisão
                </label>
                <span className="text-sm font-bold text-primary">
                  {simulatedSupervisao[0]}%
                </span>
              </div>
              <Slider
                value={simulatedSupervisao}
                onValueChange={setSimulatedSupervisao}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Tempo Médio Prato (min)
                </label>
                <span className="text-sm font-bold text-muted-foreground">
                  {simulatedTempoPrato[0]} min
                </span>
              </div>
              <Slider
                value={simulatedTempoPrato}
                onValueChange={setSimulatedTempoPrato}
                min={5}
                max={45}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* NPS Efficiency Display */}
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground uppercase">
                Eficiência NPS (Faturamento / Reclamações)
              </span>
              <span className="text-lg font-bold">
                {formatCurrency(npsEfficiency)}
              </span>
            </div>
            <Progress 
              value={Math.min((npsEfficiency / 120000) * 100, 100)} 
              className="h-2" 
            />
          </div>

          {/* Result */}
          <div
            className={`rounded-2xl p-6 ${
              isRedFlag
                ? "bg-gradient-to-br from-red-500/20 to-red-600/10 border-2 border-red-500"
                : "bg-gradient-to-br from-muted/50 to-muted"
            }`}
          >
            {isRedFlag ? (
              <div className="flex flex-col items-center gap-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <div className="text-center">
                  <p className="text-xl font-bold text-red-500">🚨 STATUS: RED FLAG</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    KPI abaixo do nível Bronze. Bônus bloqueado.
                  </p>
                  <p className="text-3xl font-bold text-red-500 mt-4">
                    R$ 0,00
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase">
                      Nível Atingido
                    </p>
                    {currentTier && (
                      <Badge
                        className={`mt-1 bg-gradient-to-r ${TIER_CONFIG[currentTier].gradient} text-white`}
                      >
                        {TIER_CONFIG[currentTier].label}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground uppercase">
                      Bônus Estimado ({bonusResult.percentage}%)
                    </p>
                    <p className="text-3xl font-bold text-primary">
                      {formatCurrency(bonusResult.amount)}
                    </p>
                  </div>
                </div>

                {/* Tier Badges */}
                <div className="mt-6 flex gap-3">
                  {(["ouro", "prata", "bronze"] as BonusTier[]).map((tier) => {
                    const isActive = currentTier === tier;
                    const percentage = getPercentage(selectedPosition, tier);
                    return (
                      <div
                        key={tier}
                        className={`flex-1 rounded-xl p-3 text-center transition-all ${
                          isActive
                            ? `bg-gradient-to-r ${TIER_CONFIG[tier].gradient} text-white shadow-lg scale-105`
                            : "bg-muted/50"
                        }`}
                      >
                        {tier === "ouro" && <Trophy className="h-6 w-6 mx-auto mb-1" />}
                        {tier === "prata" && <Medal className="h-6 w-6 mx-auto mb-1" />}
                        {tier === "bronze" && <Award className="h-6 w-6 mx-auto mb-1" />}
                        <p className="text-xs font-medium uppercase">
                          {TIER_CONFIG[tier].label}
                        </p>
                        <p className="text-xs">{percentage}%</p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ranking Inter-Unidades */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              <Trophy className="h-5 w-5 text-amber-500" />
              Ranking Inter-Unidades
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Todas as marcas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Marcas</SelectItem>
                  <SelectItem value="caminito">Caminito</SelectItem>
                  <SelectItem value="nazo">Nazo</SelectItem>
                  <SelectItem value="frangobrasil">Frango Brasil</SelectItem>
                  <SelectItem value="caju">Caju</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Pos.</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">NPS Efic.</TableHead>
                <TableHead className="text-center">Supervisão</TableHead>
                <TableHead className="text-right">Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum dado de performance encontrado para este mês.
                  </TableCell>
                </TableRow>
              ) : (
                rankingData.map((store, index) => (
                  <TableRow
                    key={store.id}
                    className={
                      store.id === selectedUnidadeId ? "bg-primary/5" : undefined
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <Medal className="h-5 w-5 text-amber-500" />
                        )}
                        {index === 1 && (
                          <Medal className="h-5 w-5 text-slate-400" />
                        )}
                        {index === 2 && (
                          <Medal className="h-5 w-5 text-amber-700" />
                        )}
                        {index > 2 && (
                          <span className="text-muted-foreground">
                            {index + 1}º
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{store.nome}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={store.nps >= 95000 ? "default" : "secondary"}
                      >
                        {formatCurrency(store.nps)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={store.supervisao >= 85 ? "default" : "secondary"}
                      >
                        {store.supervisao.toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {store.avg.toFixed(0)}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
