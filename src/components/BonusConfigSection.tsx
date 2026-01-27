import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target,
  Award,
  TrendingUp,
  Loader2,
  Store,
  Calendar,
  Save,
  Settings,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useNpsTargets,
  useBonusRules,
  useBonusConfig,
  POSITION_LABELS,
  SECTOR_LABELS,
  TIER_CONFIG,
  type PositionType,
  type SectorType,
  type BonusTier,
} from "@/hooks/useBonusRules";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { formatCurrency } from "@/lib/formatters";

export function BonusConfigSection() {
  const { targets, isLoading: isLoadingTargets, updateTarget } = useNpsTargets();
  const { rules, isLoading: isLoadingRules, updateRule } = useBonusRules();
  const { configs, isLoading: isLoadingConfigs, upsertConfig } = useBonusConfig();
  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();

  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [baseValues, setBaseValues] = useState<Record<PositionType, string>>({
    gerente_front: "",
    gerente_back: "",
    chefia_front: "",
    chefia_back: "",
  });

  const isLoading = isLoadingTargets || isLoadingRules || isLoadingConfigs || isLoadingLojas;

  // Generate month options
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 6; i >= -6; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return options;
  };

  // Group targets by sector
  const targetsBySector = targets.reduce((acc, target) => {
    if (!acc[target.sector_type]) {
      acc[target.sector_type] = [];
    }
    acc[target.sector_type].push(target);
    return acc;
  }, {} as Record<SectorType, typeof targets>);

  // Group rules by position
  const rulesByPosition = rules.reduce((acc, rule) => {
    if (!acc[rule.position_type]) {
      acc[rule.position_type] = [];
    }
    acc[rule.position_type].push(rule);
    return acc;
  }, {} as Record<PositionType, typeof rules>);

  // Handle NPS target update
  const handleTargetUpdate = (id: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      updateTarget.mutate({ id, min_efficiency: numValue });
    }
  };

  // Handle bonus rule update
  const handleRuleUpdate = (id: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      updateRule.mutate({ id, percentage: numValue });
    }
  };

  // Handle base value save
  const handleSaveBaseValues = async () => {
    if (!selectedStoreId || !selectedMonthYear) return;

    for (const [position, value] of Object.entries(baseValues)) {
      const numValue = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
      if (!isNaN(numValue) && numValue > 0) {
        await upsertConfig.mutateAsync({
          loja_id: selectedStoreId,
          position_type: position as PositionType,
          base_bonus_value: numValue,
          month_year: selectedMonthYear,
        });
      }
    }
  };

  // Load existing base values when store/month changes
  const loadExistingValues = () => {
    if (!selectedStoreId || !selectedMonthYear) return;

    const positions: PositionType[] = ["gerente_front", "gerente_back", "chefia_front", "chefia_back"];
    const newValues: Record<PositionType, string> = {
      gerente_front: "",
      gerente_back: "",
      chefia_front: "",
      chefia_back: "",
    };

    for (const position of positions) {
      const config = configs.find(
        (c) =>
          c.loja_id === selectedStoreId &&
          c.position_type === position &&
          c.month_year === selectedMonthYear
      );
      if (config) {
        newValues[position] = config.base_bonus_value.toString();
      }
    }

    setBaseValues(newValues);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <CardTitle>Central de Regras - Remuneração Variável</CardTitle>
        </div>
        <CardDescription>
          Configure as metas de NPS, percentuais de bônus e valores base por cargo.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="nps" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="nps" className="gap-2">
              <Target className="h-4 w-4" />
              Metas NPS
            </TabsTrigger>
            <TabsTrigger value="percentuais" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Percentuais
            </TabsTrigger>
            <TabsTrigger value="valores" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Valores Base
            </TabsTrigger>
          </TabsList>

          {/* NPS Targets Tab */}
          <TabsContent value="nps" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina os alvos de eficiência (Faturamento / Reclamações) por setor e nível.
            </p>

            <Accordion type="single" collapsible className="w-full">
              {(Object.keys(targetsBySector) as SectorType[]).map((sector) => (
                <AccordionItem key={sector} value={sector}>
                  <AccordionTrigger className="text-sm font-medium uppercase">
                    {SECTOR_LABELS[sector]}
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nível</TableHead>
                          <TableHead className="text-right">Meta Mínima (R$)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {targetsBySector[sector]
                          .sort((a, b) => {
                            const order: BonusTier[] = ["ouro", "prata", "bronze"];
                            return order.indexOf(a.tier) - order.indexOf(b.tier);
                          })
                          .map((target) => (
                            <TableRow key={target.id}>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={TIER_CONFIG[target.tier].color}
                                >
                                  {TIER_CONFIG[target.tier].label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  className="w-32 text-right ml-auto"
                                  defaultValue={target.min_efficiency}
                                  onBlur={(e) =>
                                    handleTargetUpdate(target.id, e.target.value)
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          {/* Bonus Percentages Tab */}
          <TabsContent value="percentuais" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina os percentuais de bônus por cargo e nível de desempenho.
            </p>

            <Accordion type="single" collapsible className="w-full">
              {(Object.keys(rulesByPosition) as PositionType[]).map((position) => (
                <AccordionItem key={position} value={position}>
                  <AccordionTrigger className="text-sm font-medium uppercase">
                    {POSITION_LABELS[position]}
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nível</TableHead>
                          <TableHead className="text-right">Percentual (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rulesByPosition[position]
                          .sort((a, b) => {
                            const order: BonusTier[] = ["ouro", "prata", "bronze", "aceitavel"];
                            return order.indexOf(a.tier) - order.indexOf(b.tier);
                          })
                          .map((rule) => (
                            <TableRow key={rule.id}>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={TIER_CONFIG[rule.tier].color}
                                >
                                  {TIER_CONFIG[rule.tier].label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Input
                                    type="number"
                                    className="w-20 text-right"
                                    defaultValue={rule.percentage}
                                    min={0}
                                    max={100}
                                    onBlur={(e) =>
                                      handleRuleUpdate(rule.id, e.target.value)
                                    }
                                  />
                                  <span className="text-muted-foreground">%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          {/* Base Values Tab */}
          <TabsContent value="valores" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure os valores base de bônus (100%) por loja, cargo e mês.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Loja/Unidade</Label>
                <Select
                  value={selectedStoreId}
                  onValueChange={(v) => {
                    setSelectedStoreId(v);
                    setTimeout(loadExistingValues, 100);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map((loja) => (
                      <SelectItem key={loja.id} value={loja.id}>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          {loja.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mês de Referência</Label>
                <Select
                  value={selectedMonthYear}
                  onValueChange={(v) => {
                    setSelectedMonthYear(v);
                    setTimeout(loadExistingValues, 100);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {getMonthOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span className="capitalize">{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedStoreId && (
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      Gerente Front (100%)
                    </Label>
                    <Input
                      type="text"
                      placeholder="R$ 0,00"
                      value={baseValues.gerente_front}
                      onChange={(e) =>
                        setBaseValues((prev) => ({
                          ...prev,
                          gerente_front: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      Gerente Back (100%)
                    </Label>
                    <Input
                      type="text"
                      placeholder="R$ 0,00"
                      value={baseValues.gerente_back}
                      onChange={(e) =>
                        setBaseValues((prev) => ({
                          ...prev,
                          gerente_back: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-secondary" />
                      Chefia Front (100%)
                    </Label>
                    <Input
                      type="text"
                      placeholder="R$ 0,00"
                      value={baseValues.chefia_front}
                      onChange={(e) =>
                        setBaseValues((prev) => ({
                          ...prev,
                          chefia_front: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-secondary" />
                      Chefia Back (100%)
                    </Label>
                    <Input
                      type="text"
                      placeholder="R$ 0,00"
                      value={baseValues.chefia_back}
                      onChange={(e) =>
                        setBaseValues((prev) => ({
                          ...prev,
                          chefia_back: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSaveBaseValues}
                  disabled={upsertConfig.isPending}
                  className="w-full"
                >
                  {upsertConfig.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Valores Base
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
