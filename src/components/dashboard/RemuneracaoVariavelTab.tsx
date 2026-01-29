import { useState, useMemo } from "react";
import { TrendingUp, Award, Target, Trophy, Medal, Star, AlertTriangle, Clock, Users, ChefHat, Filter, LayoutDashboard, UtensilsCrossed, Bike, Plus, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActionPlanDashboard } from "@/components/action-plan";
import { AuditReportButton } from "@/components/AuditReportButton";
import { ForecastingCard } from "@/components/dashboard/ForecastingCard";
import { ComplianceHeatmap } from "@/components/dashboard/ComplianceHeatmap";
import { LeadershipRadar } from "@/components/dashboard/LeadershipRadar";
import { WinsAlertsFeed } from "@/components/dashboard/WinsAlertsFeed";
import { PerformanceEntryForm } from "@/components/dashboard/PerformanceEntryForm";
import { PerformanceEntriesList } from "@/components/dashboard/PerformanceEntriesList";
import { usePerformanceEntries } from "@/hooks/usePerformanceEntries";
import { MobileRankingCard, MobileBonusResult } from "@/components/mobile";
import { useNpsTargets, useBonusRules, useBonusConfig, useStorePerformance, calculateBonus, TIER_CONFIG, POSITION_LABELS, type PositionType, type SectorType, type BonusTier } from "@/hooks/useBonusRules";
import { useCargos, useMetasCargo, type Cargo } from "@/hooks/useCargos";
import { RankingsTab } from "@/components/dashboard/RankingsTab";
import { BonusCalculatorCard } from "@/components/dashboard/BonusCalculatorCard";
interface RemuneracaoVariavelTabProps {
  selectedUnidadeId: string | null;
}

// Brand mappings for filtering
const BRAND_PATTERNS: Record<string, string[]> = {
  caminito: ["CAMINITO", "MULT"],
  nazo: ["NAZO", "NFE"],
  fosters: ["FB", "FOSTER"],
  caju: ["CAJU"]
};
export function RemuneracaoVariavelTab({
  selectedUnidadeId
}: RemuneracaoVariavelTabProps) {
  const {
    options: lojas
  } = useConfigLojas();
  const {
    isAdmin
  } = useUserProfile();
  const isMobile = useIsMobile();
  const {
    targets,
    determineTier
  } = useNpsTargets();
  const {
    rules,
    getPercentage
  } = useBonusRules();
  const {
    configs,
    getConfig
  } = useBonusConfig();
  const {
    performances,
    getPerformancesByMonth
  } = useStorePerformance();
  const {
    aggregatedByStore
  } = usePerformanceEntries();

  // V2: Load cargos from database
  const {
    cargos,
    gerencias,
    chefias,
    chefiasBack,
    chefiasFront,
    isLoading: isLoadingCargos
  } = useCargos();
  const {
    metas,
    getMetasByCargo
  } = useMetasCargo();

  // State for collapsible admin section
  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false);

  // Simulator state - Separate inputs for Salão and Delivery
  const [faturamentoSalao, setFaturamentoSalao] = useState([500000]);
  const [reclamacoesSalao, setReclamacoesSalao] = useState([3]);
  const [faturamentoDelivery, setFaturamentoDelivery] = useState([100000]);
  const [reclamacoesDelivery, setReclamacoesDelivery] = useState([5]);
  const [simulatedSupervisao, setSimulatedSupervisao] = useState([85]);
  const [simulatedTempoPrato, setSimulatedTempoPrato] = useState([15]);
  const [selectedPosition, setSelectedPosition] = useState<PositionType>("gerente_front");
  const [selectedSector, setSelectedSector] = useState<SectorType>("salao");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  // V2: Selected cargo from new model
  const [selectedCargoId, setSelectedCargoId] = useState<string>("");

  // Get selected cargo details
  const selectedCargo = useMemo(() => {
    return cargos.find(c => c.id === selectedCargoId);
  }, [cargos, selectedCargoId]);

  // Get metas for selected cargo
  const selectedCargoMetas = useMemo(() => {
    if (!selectedCargoId) return [];
    return getMetasByCargo(selectedCargoId);
  }, [selectedCargoId, getMetasByCargo]);

  // V2: Determine if cargo is Gerencia or Chefia
  const isGerenteV2 = useMemo(() => {
    return selectedCargo?.categoria === 'gerencia';
  }, [selectedCargo]);

  // V2: Get pote variável from cargo
  const poteVariavelV2 = useMemo(() => {
    return selectedCargo?.pote_variavel_max || 3000;
  }, [selectedCargo]);
  const currentMonthYear = format(new Date(), "yyyy-MM");

  // NPS Targets for each channel (Faturamento / Reclamações thresholds)
  const NPS_TARGETS = {
    salao: {
      ouro: 120000,
      prata: 90000,
      bronze: 60000
    },
    delivery: {
      ouro: 12000,
      prata: 9000,
      bronze: 6000
    }
  };

  // Fixed bonus values per tier (50% of total NPS bonus for each channel)
  const NPS_BONUS_VALUES = {
    gerente: {
      ouro: 750,
      prata: 562.5,
      bronze: 375,
      aceitavel: 187.5
    },
    chefia: {
      ouro: 750,
      prata: 500,
      bronze: 250,
      aceitavel: 0
    }
  };

  // Calculate efficiency for Salão
  const eficienciaSalao = useMemo(() => {
    if (reclamacoesSalao[0] === 0) return faturamentoSalao[0];
    return faturamentoSalao[0] / reclamacoesSalao[0];
  }, [faturamentoSalao, reclamacoesSalao]);

  // Calculate efficiency for Delivery
  const eficienciaDelivery = useMemo(() => {
    if (reclamacoesDelivery[0] === 0) return faturamentoDelivery[0];
    return faturamentoDelivery[0] / reclamacoesDelivery[0];
  }, [faturamentoDelivery, reclamacoesDelivery]);

  // Determine tier for Salão
  const tierSalao = useMemo((): BonusTier | null => {
    if (eficienciaSalao >= NPS_TARGETS.salao.ouro) return "ouro";
    if (eficienciaSalao >= NPS_TARGETS.salao.prata) return "prata";
    if (eficienciaSalao >= NPS_TARGETS.salao.bronze) return "bronze";
    if (eficienciaSalao >= NPS_TARGETS.salao.bronze * 0.5) return "aceitavel";
    return null; // Red Flag
  }, [eficienciaSalao]);

  // Determine tier for Delivery
  const tierDelivery = useMemo((): BonusTier | null => {
    if (eficienciaDelivery >= NPS_TARGETS.delivery.ouro) return "ouro";
    if (eficienciaDelivery >= NPS_TARGETS.delivery.prata) return "prata";
    if (eficienciaDelivery >= NPS_TARGETS.delivery.bronze) return "bronze";
    if (eficienciaDelivery >= NPS_TARGETS.delivery.bronze * 0.5) return "aceitavel";
    return null; // Red Flag
  }, [eficienciaDelivery]);

  // Legacy compatibility - combined efficiency for forecasting
  const npsEfficiency = useMemo(() => {
    return eficienciaSalao + eficienciaDelivery;
  }, [eficienciaSalao, eficienciaDelivery]);

  // Determine the tier based on combined efficiency (legacy compatibility)
  const currentTier = useMemo(() => {
    return determineTier(selectedSector, npsEfficiency);
  }, [selectedSector, npsEfficiency, determineTier]);

  // Check for red flag (supervision below 80% OR any NPS channel below minimum)
  const isNpsRedFlag = useMemo(() => {
    // For Gerentes, both channels must be above minimum threshold
    if (selectedPosition === "gerente_front" || selectedPosition === "gerente_back") {
      return tierSalao === null || tierDelivery === null;
    }
    // For Chefias, use combined efficiency
    return tierSalao === null && tierDelivery === null;
  }, [selectedPosition, tierSalao, tierDelivery]);
  const isRedFlag = useMemo(() => {
    return simulatedSupervisao[0] < 80 || isNpsRedFlag;
  }, [simulatedSupervisao, isNpsRedFlag]);

  // Determine supervision tier based on percentage
  const supervisionTier = useMemo((): BonusTier | null => {
    const score = simulatedSupervisao[0];
    if (score >= 95) return "ouro";
    if (score >= 90) return "prata";
    if (score >= 80) return "bronze";
    return null; // Red Flag
  }, [simulatedSupervisao]);

  // Determine if user is Gerente or Chefia based on selected position
  const isGerente = useMemo(() => {
    return selectedPosition === "gerente_front" || selectedPosition === "gerente_back";
  }, [selectedPosition]);

  // Calculate NPS bonus for Salão (50% weight for Gerentes)
  const npsBonusSalao = useMemo(() => {
    if (isRedFlag || !tierSalao) {
      return {
        amount: 0,
        tier: null,
        tierLabel: "RED FLAG"
      };
    }
    const values = isGerente ? NPS_BONUS_VALUES.gerente : NPS_BONUS_VALUES.chefia;
    const amount = values[tierSalao];
    return {
      amount,
      tier: tierSalao,
      tierLabel: TIER_CONFIG[tierSalao].label.toUpperCase()
    };
  }, [tierSalao, isGerente, isRedFlag]);

  // Calculate NPS bonus for Delivery (50% weight for Gerentes)
  const npsBonusDelivery = useMemo(() => {
    if (isRedFlag || !tierDelivery) {
      return {
        amount: 0,
        tier: null,
        tierLabel: "RED FLAG"
      };
    }
    const values = isGerente ? NPS_BONUS_VALUES.gerente : NPS_BONUS_VALUES.chefia;
    const amount = values[tierDelivery];
    return {
      amount,
      tier: tierDelivery,
      tierLabel: TIER_CONFIG[tierDelivery].label.toUpperCase()
    };
  }, [tierDelivery, isGerente, isRedFlag]);

  // Total NPS Bonus (sum of both channels)
  const totalNpsBonus = useMemo(() => {
    return npsBonusSalao.amount + npsBonusDelivery.amount;
  }, [npsBonusSalao, npsBonusDelivery]);

  // Calculate supervision bonus based on fixed tier values
  const supervisionBonus = useMemo(() => {
    if (simulatedSupervisao[0] < 80 || !supervisionTier) {
      return {
        amount: 0,
        tier: null,
        tierLabel: "RED FLAG"
      };
    }

    // Fixed values per position type
    if (isGerente) {
      // Gerentes (Front e Back)
      switch (supervisionTier) {
        case "ouro":
          return {
            amount: 1500,
            tier: supervisionTier,
            tierLabel: "OURO"
          };
        case "prata":
          return {
            amount: 1125,
            tier: supervisionTier,
            tierLabel: "PRATA"
          };
        case "bronze":
          return {
            amount: 750,
            tier: supervisionTier,
            tierLabel: "BRONZE"
          };
        default:
          return {
            amount: 0,
            tier: null,
            tierLabel: "RED FLAG"
          };
      }
    } else {
      // Chefias (Salão, APV, Cozinha, Sushi, Bar, Parrilla)
      switch (supervisionTier) {
        case "ouro":
          return {
            amount: 1500,
            tier: supervisionTier,
            tierLabel: "OURO"
          };
        case "prata":
          return {
            amount: 1000,
            tier: supervisionTier,
            tierLabel: "PRATA"
          };
        case "bronze":
          return {
            amount: 500,
            tier: supervisionTier,
            tierLabel: "BRONZE"
          };
        default:
          return {
            amount: 0,
            tier: null,
            tierLabel: "RED FLAG"
          };
      }
    }
  }, [supervisionTier, isGerente, simulatedSupervisao]);

  // Get base bonus value for selected store and position (legacy)
  const baseValue = useMemo(() => {
    if (!selectedUnidadeId) return 3500;
    const config = getConfig(selectedUnidadeId, selectedPosition, currentMonthYear);
    return config?.base_bonus_value || 3500;
  }, [selectedUnidadeId, selectedPosition, currentMonthYear, getConfig]);

  // Calculate legacy NPS bonus for compatibility
  const npsBonus = useMemo(() => {
    if (isRedFlag) return {
      amount: 0,
      percentage: 0,
      tier: null
    };
    return calculateBonus(baseValue, currentTier, rules, selectedPosition, false);
  }, [baseValue, currentTier, rules, selectedPosition, isRedFlag]);

  // Total bonus (supervision bonus, zeroed if Red Flag)
  const bonusResult = useMemo(() => {
    if (isRedFlag) {
      return {
        amount: 0,
        percentage: 0,
        tier: null
      };
    }
    return {
      amount: supervisionBonus.amount,
      percentage: supervisionTier === "ouro" ? 100 : supervisionTier === "prata" ? isGerente ? 75 : 66.6 : isGerente ? 50 : 33.3,
      tier: supervisionTier
    };
  }, [supervisionBonus, supervisionTier, isGerente, isRedFlag]);

  // Filter stores by brand
  const filteredStores = useMemo(() => {
    if (brandFilter === "all") return lojas;
    const patterns = BRAND_PATTERNS[brandFilter] || [];
    return lojas.filter(loja => patterns.some(pattern => loja.nome.toUpperCase().includes(pattern)));
  }, [lojas, brandFilter]);

  // Get current month performances with store data for ranking (use weekly entries)
  const rankingData = useMemo(() => {
    const monthPerformances = getPerformancesByMonth(currentMonthYear);
    return filteredStores.map(loja => {
      // Prioritize weekly accumulated entries, fall back to store_performance
      const weeklyData = aggregatedByStore[loja.id];
      const perf = monthPerformances.find(p => p.loja_id === loja.id);

      // Use accumulated weekly data if available
      const faturamento = weeklyData ? weeklyData.total_faturamento : perf?.faturamento || 0;
      const reclamacoes = weeklyData ? weeklyData.total_reclamacoes : perf?.num_reclamacoes || 0;

      // Calculate NPS efficiency
      const npsEfficiency = reclamacoes > 0 ? faturamento / reclamacoes : faturamento;

      // Supervision comes from audits (fixed pillar)
      const supervisao = perf?.supervisao_score || 0;

      // Calculate average score (NPS efficiency normalized + supervision)
      const npsNormalized = Math.min(npsEfficiency / 200000 * 100, 100); // Normalize to 0-100
      const avg = supervisao > 0 ? (npsNormalized + supervisao) / 2 : npsNormalized;
      return {
        id: loja.id,
        nome: loja.nome,
        nps: npsEfficiency,
        supervisao: supervisao,
        faturamento: faturamento,
        avg: avg,
        hasWeeklyData: !!weeklyData && weeklyData.entries_count > 0
      };
    }).sort((a, b) => b.avg - a.avg);
  }, [filteredStores, getPerformancesByMonth, currentMonthYear, aggregatedByStore]);

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
    icon: Icon
  }: {
    value: number;
    label: string;
    target: number;
    icon?: React.ElementType;
  }) => {
    const percentage = Math.min(value / target * 100, 100);
    return <Card className="rounded-2xl shadow-card">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="relative h-32 w-32">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 50">
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" strokeLinecap="round" />
              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${percentage * 1.26}, 126`} className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
              {Icon && <Icon className={`h-5 w-5 mb-1 ${getGaugeColor(percentage)}`} />}
              <span className={`text-2xl font-bold ${getGaugeColor(percentage)}`}>
                {typeof value === "number" && value > 1000 ? formatCurrency(value) : `${value.toFixed(0)}%`}
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
      </Card>;
  };
  return <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">
              Performance Mensal
            </h2>
            <p className="text-muted-foreground">
              {format(new Date(), "MMMM 'de' yyyy", {
              locale: ptBR
            })}
            </p>
          </div>
        </div>
      </div>

      {/* Admin: Weekly Performance Entry Section */}
      {isAdmin && <Collapsible open={isEntryFormOpen} onOpenChange={setIsEntryFormOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Lançar Dados Semanais (Faturamento & NPS)
              </span>
              <Badge variant="secondary" className="ml-2">
                Admin
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <PerformanceEntryForm selectedUnidadeId={selectedUnidadeId} />
            <PerformanceEntriesList selectedLojaId={selectedUnidadeId} />
          </CollapsibleContent>
        </Collapsible>}

      {/* Wins & Alerts Feed - Activity Timeline */}
      <WinsAlertsFeed lojaId={selectedUnidadeId} showAllStores={isAdmin} />

      {/* Strategic BI Section with Tabs */}
      <Tabs defaultValue="forecast" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="forecast" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Projeção</span>
          </TabsTrigger>
          <TabsTrigger value="rankings" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Rankings</span>
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Conformidade</span>
          </TabsTrigger>
          <TabsTrigger value="radar" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Competências</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="forecast" className="animate-fade-in">
          <ForecastingCard currentFaturamento={faturamentoSalao[0] + faturamentoDelivery[0]} currentReclamacoes={reclamacoesSalao[0] + reclamacoesDelivery[0]} supervisaoScore={simulatedSupervisao[0]} determineTier={determineTier} sector={selectedSector} selectedLojaId={selectedUnidadeId} />
        </TabsContent>

        <TabsContent value="rankings" className="animate-fade-in">
          <RankingsTab />
        </TabsContent>

        <TabsContent value="heatmap" className="animate-fade-in">
          <ComplianceHeatmap lojaId={selectedUnidadeId} />
        </TabsContent>

        <TabsContent value="radar" className="animate-fade-in">
          <LeadershipRadar lojaId={selectedUnidadeId} />
        </TabsContent>
      </Tabs>

      {/* V2: Bonus Calculator when cargo is selected */}
      {selectedCargoId && selectedUnidadeId && <BonusCalculatorCard lojaId={selectedUnidadeId} cargoId={selectedCargoId} />}

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
          {/* V2: Cargo selector with grouped options */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium uppercase flex items-center gap-2">CARGO<Briefcase className="h-4 w-4" />
                Cargo (V2)
              </label>
              <Select value={selectedCargoId} onValueChange={setSelectedCargoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {/* Gerências */}
                  {gerencias.length > 0 && <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                        Gerência (Teto R$ 5.000)
                      </div>
                      {gerencias.map(cargo => <SelectItem key={cargo.id} value={cargo.id}>
                          {cargo.nome}
                        </SelectItem>)}
                    </>}
                  {/* Chefias Front */}
                  {chefiasFront.length > 0 && <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-1">
                        Chefia Front (Teto R$ 3.000)
                      </div>
                      {chefiasFront.map(cargo => <SelectItem key={cargo.id} value={cargo.id}>
                          {cargo.nome}
                        </SelectItem>)}
                    </>}
                  {/* Chefias Back */}
                  {chefiasBack.length > 0 && <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase mt-1">
                        Chefia Back (Teto R$ 3.000)
                      </div>
                      {chefiasBack.map(cargo => <SelectItem key={cargo.id} value={cargo.id}>
                          {cargo.nome} {cargo.setor_back && `(${cargo.setor_back})`}
                        </SelectItem>)}
                    </>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium uppercase">SETOR </label>
              <Select value={selectedSector} onValueChange={v => setSelectedSector(v as SectorType)}>
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
          
          {/* V2: Display selected cargo info */}
          {selectedCargo && <div className="rounded-lg bg-primary/5 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedCargo.categoria === 'gerencia' ? <Briefcase className="h-5 w-5 text-primary" /> : <ChefHat className="h-5 w-5 text-primary" />}
                <div>
                  <p className="font-medium">{selectedCargo.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCargoMetas.length} metas configuradas
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Pote Máximo</p>
                <p className="font-bold text-primary">{formatCurrency(poteVariavelV2)}</p>
              </div>
            </div>}

          {/* NPS Inputs - Salão Block */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UtensilsCrossed className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-bold uppercase text-amber-700 dark:text-amber-400">
                Pilar A - Salão (50%)
              </span>
              {tierSalao && !isRedFlag && <Badge className={`ml-auto bg-gradient-to-r ${TIER_CONFIG[tierSalao].gradient} text-white text-xs`}>
                  {npsBonusSalao.tierLabel}
                </Badge>}
              {!tierSalao && <Badge variant="destructive" className="ml-auto text-xs">RED FLAG</Badge>}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Faturamento Salão
                </label>
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(faturamentoSalao[0])}
                </span>
              </div>
              <Slider value={faturamentoSalao} onValueChange={setFaturamentoSalao} min={0} max={4000000} step={10000} className="w-full" />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Reclamações Salão
                </label>
                <span className="text-sm font-bold text-destructive">
                  {reclamacoesSalao[0]}
                </span>
              </div>
              <Slider value={reclamacoesSalao} onValueChange={setReclamacoesSalao} min={0} max={50} step={1} className="w-full" />
            </div>

            {/* Salão Efficiency Display */}
            <div className="rounded-lg bg-background/80 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Eficiência Salão:</span>
                <span className="font-bold">{formatCurrency(eficienciaSalao)}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground">Target Ouro: &gt; R$ 120k</span>
                <span className="font-bold text-primary">{formatCurrency(npsBonusSalao.amount)}</span>
              </div>
            </div>
          </div>

          {/* NPS Inputs - Delivery Block */}
          <div className="rounded-xl border border-sky-200 bg-sky-50/30 dark:bg-sky-950/20 dark:border-sky-800 p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Bike className="h-5 w-5 text-sky-600" />
              <span className="text-sm font-bold uppercase text-sky-700 dark:text-sky-400">
                Pilar B - Delivery (50%)
              </span>
              {tierDelivery && !isRedFlag && <Badge className={`ml-auto bg-gradient-to-r ${TIER_CONFIG[tierDelivery].gradient} text-white text-xs`}>
                  {npsBonusDelivery.tierLabel}
                </Badge>}
              {!tierDelivery && <Badge variant="destructive" className="ml-auto text-xs">RED FLAG</Badge>}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Faturamento Delivery
                </label>
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(faturamentoDelivery[0])}
                </span>
              </div>
              <Slider value={faturamentoDelivery} onValueChange={setFaturamentoDelivery} min={0} max={1500000} step={5000} className="w-full" />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Reclamações iFood
                </label>
                <span className="text-sm font-bold text-destructive">
                  {reclamacoesDelivery[0]}
                </span>
              </div>
              <Slider value={reclamacoesDelivery} onValueChange={setReclamacoesDelivery} min={0} max={100} step={1} className="w-full" />
            </div>

            {/* Delivery Efficiency Display */}
            <div className="rounded-lg bg-background/80 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Eficiência Delivery:</span>
                <span className="font-bold">{formatCurrency(eficienciaDelivery)}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground">Target Ouro: &gt; R$ 12k</span>
                <span className="font-bold text-primary">{formatCurrency(npsBonusDelivery.amount)}</span>
              </div>
            </div>
          </div>

          {/* Total NPS Bonus Display */}
          <div className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-bold uppercase">Bônus NPS Total</span>
              </div>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(totalNpsBonus)}
              </span>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>Salão: {formatCurrency(npsBonusSalao.amount)} ({npsBonusSalao.tierLabel})</span>
              <span>|</span>
              <span>Delivery: {formatCurrency(npsBonusDelivery.amount)} ({npsBonusDelivery.tierLabel})</span>
            </div>
          </div>

          {/* Supervision Slider */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <label className="text-sm font-medium uppercase flex items-center gap-2">
                <Users className="h-4 w-4" />
                % Supervisão
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary">
                  {simulatedSupervisao[0]}%
                </span>
                {supervisionTier && simulatedSupervisao[0] >= 80 && <Badge className={`bg-gradient-to-r ${TIER_CONFIG[supervisionTier].gradient} text-white text-xs`}>
                    {supervisionBonus.tierLabel}
                  </Badge>}
                {simulatedSupervisao[0] < 80 && <Badge variant="destructive" className="text-xs">
                    RED FLAG
                  </Badge>}
              </div>
            </div>
            <Slider value={simulatedSupervisao} onValueChange={setSimulatedSupervisao} min={0} max={100} step={1} className="w-full" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Bônus Supervisão: <span className={simulatedSupervisao[0] < 80 ? "text-destructive font-bold" : "text-primary font-bold"}>{formatCurrency(supervisionBonus.amount)}</span></span>
              <span className="text-muted-foreground">
                {isGerente ? "Gerente" : "Chefia"}: 
                {" "}Ouro R$1.500 | Prata R${isGerente ? "1.125" : "1.000"} | Bronze R${isGerente ? "750" : "500"}
              </span>
            </div>
          </div>

          {/* Tempo Médio Prato */}
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
            <Slider value={simulatedTempoPrato} onValueChange={setSimulatedTempoPrato} min={5} max={45} step={1} className="w-full" />
          </div>

          {/* Final Result - Desktop */}
          <div className={`hidden md:block rounded-2xl p-6 ${isRedFlag ? "bg-gradient-to-br from-red-500/20 to-red-600/10 border-2 border-red-500" : "bg-gradient-to-br from-muted/50 to-muted"}`}>
            {isRedFlag ? <div className="flex flex-col items-center gap-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <div className="text-center">
                  <p className="text-xl font-bold text-red-500">🚨 STATUS: RED FLAG</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {simulatedSupervisao[0] < 80 ? "Supervisão abaixo de 80%." : "NPS de algum canal abaixo do mínimo."}
                    {" "}Bônus TOTAL bloqueado.
                  </p>
                  <p className="text-3xl font-bold text-red-500 mt-4">
                    R$ 0,00
                  </p>
                </div>
              </div> : <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-3 rounded-xl bg-background/50">
                    <p className="text-xs text-muted-foreground uppercase">NPS Salão</p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(npsBonusSalao.amount)}</p>
                    {tierSalao && <Badge className={`mt-1 text-xs bg-gradient-to-r ${TIER_CONFIG[tierSalao].gradient} text-white`}>
                        {TIER_CONFIG[tierSalao].label}
                      </Badge>}
                  </div>
                  <div className="text-center p-3 rounded-xl bg-background/50">
                    <p className="text-xs text-muted-foreground uppercase">NPS Delivery</p>
                    <p className="text-lg font-bold text-sky-600">{formatCurrency(npsBonusDelivery.amount)}</p>
                    {tierDelivery && <Badge className={`mt-1 text-xs bg-gradient-to-r ${TIER_CONFIG[tierDelivery].gradient} text-white`}>
                        {TIER_CONFIG[tierDelivery].label}
                      </Badge>}
                  </div>
                  <div className="text-center p-3 rounded-xl bg-background/50">
                    <p className="text-xs text-muted-foreground uppercase">Supervisão</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(supervisionBonus.amount)}</p>
                    {supervisionTier && <Badge className={`mt-1 text-xs bg-gradient-to-r ${TIER_CONFIG[supervisionTier].gradient} text-white`}>
                        {TIER_CONFIG[supervisionTier].label}
                      </Badge>}
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <p className="text-sm text-muted-foreground uppercase">Bônus Total Estimado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      NPS ({formatCurrency(totalNpsBonus)}) + Supervisão ({formatCurrency(supervisionBonus.amount)})
                    </p>
                  </div>
                  <p className="text-4xl font-bold text-primary">
                    {formatCurrency(totalNpsBonus + supervisionBonus.amount)}
                  </p>
                </div>
              </>}
          </div>

          {/* Final Result - Mobile (inline, not fixed) */}
          <div className="md:hidden">
            <MobileBonusResult isRedFlag={isRedFlag} redFlagReason={simulatedSupervisao[0] < 80 ? "Supervisão abaixo de 80%" : "NPS abaixo do mínimo"} totalBonus={totalNpsBonus + supervisionBonus.amount} details={[{
            label: "Salão",
            amount: npsBonusSalao.amount,
            tier: tierSalao,
            tierLabel: npsBonusSalao.tierLabel,
            color: "bg-amber-50 dark:bg-amber-950/30"
          }, {
            label: "Delivery",
            amount: npsBonusDelivery.amount,
            tier: tierDelivery,
            tierLabel: npsBonusDelivery.tierLabel,
            color: "bg-sky-50 dark:bg-sky-950/30"
          }, {
            label: "Supervisão",
            amount: supervisionBonus.amount,
            tier: supervisionTier,
            tierLabel: supervisionBonus.tierLabel,
            color: "bg-primary/5"
          }]} />
          </div>
        </CardContent>
      </Card>

      {/* Ranking Inter-Unidades */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              <Trophy className="h-5 w-5 text-amber-500" />
              Ranking Inter-Unidades
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && <AuditReportButton brandFilter={brandFilter} />}
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Todas as marcas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Marcas</SelectItem>
                  <SelectItem value="caminito">Caminito</SelectItem>
                  <SelectItem value="nazo">Nazo</SelectItem>
                  <SelectItem value="fosters">FOSTERS BURGUER</SelectItem>
                  <SelectItem value="caju">Caju</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mobile: Card-based layout */}
          {isMobile ? <div className="space-y-3">
              {rankingData.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  Nenhum dado de performance encontrado para este mês.
                </div> : rankingData.map((store, index) => <MobileRankingCard key={store.id} store={store} index={index} isSelected={store.id === selectedUnidadeId} />)}
            </div> : (/* Desktop: Table layout */
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
                {rankingData.length === 0 ? <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum dado de performance encontrado para este mês.
                    </TableCell>
                  </TableRow> : rankingData.map((store, index) => <TableRow key={store.id} className={store.id === selectedUnidadeId ? "bg-primary/5" : undefined}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && <Medal className="h-5 w-5 text-amber-500" />}
                          {index === 1 && <Medal className="h-5 w-5 text-slate-400" />}
                          {index === 2 && <Medal className="h-5 w-5 text-amber-700" />}
                          {index > 2 && <span className="text-muted-foreground">
                              {index + 1}º
                            </span>}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{store.nome}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={store.nps >= 95000 ? "default" : "secondary"}>
                          {formatCurrency(store.nps)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={store.supervisao >= 85 ? "default" : "secondary"}>
                          {store.supervisao.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {store.avg.toFixed(0)}%
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>)}
        </CardContent>
      </Card>

      {/* Action Plan Dashboard - Now with its own filters and URL sync */}
      <ActionPlanDashboard />
    </div>;
}