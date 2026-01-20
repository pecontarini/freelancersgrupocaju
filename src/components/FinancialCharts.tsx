import { useMemo, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FreelancerEntry } from "@/types/freelancer";
import { formatCurrency, parseDateString } from "@/lib/formatters";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, BarChart3, PieChartIcon, TrendingUpIcon, Target, AlertTriangle } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
import { useUserProfile } from "@/hooks/useUserProfile";
import { startOfMonth, endOfMonth, getDaysInMonth, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface FinancialChartsProps {
  entries: FreelancerEntry[];
  selectedUnidadeId?: string | null;
}

const CHART_COLORS = [
  "hsl(12, 76%, 61%)",    // Coral/Terracotta
  "hsl(173, 58%, 39%)",   // Teal
  "hsl(43, 96%, 56%)",    // Amber
  "hsl(215, 72%, 52%)",   // Blue
  "hsl(330, 72%, 55%)",   // Pink
  "hsl(142, 71%, 45%)",   // Green
  "hsl(271, 76%, 53%)",   // Purple
  "hsl(24, 85%, 55%)",    // Orange
  "hsl(197, 71%, 52%)",   // Cyan
  "hsl(350, 65%, 52%)",   // Red
  "hsl(88, 55%, 50%)",    // Lime
  "hsl(262, 52%, 47%)",   // Indigo
];

export const FinancialCharts = ({ entries, selectedUnidadeId }: FinancialChartsProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { getBudgetForStoreMonth, getCurrentMonthYear } = useStoreBudgets();
  const { isAdmin, isGerenteUnidade, unidades } = useUserProfile();

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  // Set up the onSelect callback
  useMemo(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  // Determine effective store ID: use selected or fallback to first assigned store for gerentes
  const effectiveStoreId = useMemo(() => {
    if (selectedUnidadeId) return selectedUnidadeId;
    // For gerentes without explicit selection, use their first assigned store
    if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
      return unidades[0].id;
    }
    return null;
  }, [selectedUnidadeId, isGerenteUnidade, isAdmin, unidades]);

  // Get current budget for store
  const currentMonthYear = getCurrentMonthYear();
  const currentBudget = effectiveStoreId 
    ? getBudgetForStoreMonth(effectiveStoreId, currentMonthYear)
    : null;
  const budgetAmount = currentBudget?.total_budget || 0;
  const freelancerBudgetAmount = currentBudget?.freelancer_budget || 0;

  // Budget analysis calculations
  const budgetStats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const totalDaysInMonth = getDaysInMonth(now);
    const daysElapsed = differenceInDays(now, monthStart) + 1;

    // Filter current month entries
    const currentMonthEntries = entries.filter((entry) => {
      const entryDate = parseDateString(entry.data_pop);
      return entryDate >= monthStart && entryDate <= monthEnd;
    });

    const currentMonthTotal = currentMonthEntries.reduce((sum, e) => sum + e.valor, 0);
    const dailyAverage = daysElapsed > 0 ? currentMonthTotal / daysElapsed : 0;
    const projectedTotal = dailyAverage * totalDaysInMonth;
    
    const performanceVsBudget = budgetAmount > 0 
      ? ((budgetAmount - projectedTotal) / budgetAmount) * 100 
      : 0;

    return {
      currentMonthTotal,
      dailyAverage,
      projectedTotal,
      performanceVsBudget,
      hasBudget: budgetAmount > 0,
      daysElapsed,
      totalDaysInMonth,
    };
  }, [entries, budgetAmount]);

  // Calculate total for percentages
  const totalValue = useMemo(() => {
    return entries.reduce((acc, entry) => acc + entry.valor, 0);
  }, [entries]);

  // Data by Função with percentage
  const dataByFuncao = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const key = entry.funcao || "Sem Função";
      acc[key] = (acc[key] || 0) + entry.valor;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.value - a.value);
  }, [entries, totalValue]);

  // Data by Gerência
  const dataByGerencia = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const key = entry.gerencia || "Sem Gerência";
      acc[key] = (acc[key] || 0) + entry.valor;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  // Data by Period (monthly) with budget line
  const dataByPeriod = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      const date = parseDateString(entry.data_pop);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      acc[monthKey] = (acc[monthKey] || 0) + entry.valor;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([period, value]) => {
        const [year, month] = period.split("-");
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        // Add budget line for current month
        const isCurrentMonth = period === currentMonthYear;
        return {
          name: `${monthNames[parseInt(month) - 1]}/${year.slice(2)}`,
          value,
          freelancerBudget: isCurrentMonth && freelancerBudgetAmount > 0 ? freelancerBudgetAmount : undefined,
          totalBudget: isCurrentMonth && budgetAmount > 0 ? budgetAmount : undefined,
          sortKey: period,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [entries, currentMonthYear, budgetAmount, freelancerBudgetAmount]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-primary">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const PieTooltipWithPercent = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-3 shadow-lg min-w-[160px]">
          <p className="font-semibold text-foreground mb-1">{data.name}</p>
          <p className="text-sm text-primary font-medium">
            {formatCurrency(data.value)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.percentage}% do total
          </p>
        </div>
      );
    }
    return null;
  };

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        Nenhum dado disponível para exibir gráficos
      </div>
    );
  }

  // Top 5 functions for ranking
  const topFuncoes = dataByFuncao.slice(0, 5);

  const chartSlides = [
    { id: "funcao", title: "Por Função", icon: PieChartIcon },
    { id: "gerencia", title: "Por Gerência", icon: BarChart3 },
    { id: "periodo", title: "Por Período", icon: TrendingUpIcon },
  ];

  // Donut Chart Component
  const DonutChartContent = () => (
    <div className="flex flex-col items-center">
      <div className="w-full h-[200px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataByFuncao.slice(0, 6)}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="75%"
              paddingAngle={2}
              dataKey="value"
              label={false}
            >
              {dataByFuncao.slice(0, 6).map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<PieTooltipWithPercent />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend as list below chart */}
      <div className="w-full mt-4 grid grid-cols-2 gap-2">
        {dataByFuncao.slice(0, 6).map((funcao, index) => (
          <div key={funcao.name} className="flex items-center gap-2 text-xs">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <span className="truncate text-foreground">{funcao.name}</span>
            <span className="text-muted-foreground ml-auto">{funcao.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Bar Chart Component
  const BarChartContent = () => (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dataByGerencia.slice(0, 5)} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tickFormatter={(value) =>
              value.length > 10 ? `${value.slice(0, 10)}...` : value
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {dataByGerencia.slice(0, 5).map((_, index) => (
              <Cell
                key={`cell-gerencia-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  // Line Chart Component with Budget Lines
  const LineChartContent = () => (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dataByPeriod}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <YAxis
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
          />
          <Tooltip content={<CustomTooltip />} />
          {freelancerBudgetAmount > 0 && (
            <ReferenceLine 
              y={freelancerBudgetAmount} 
              stroke="hsl(217, 91%, 60%)" 
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ 
                value: "Budget Freelancer", 
                position: "right",
                fill: "hsl(217, 91%, 60%)",
                fontSize: 9,
              }}
            />
          )}
          {budgetAmount > 0 && budgetAmount !== freelancerBudgetAmount && (
            <ReferenceLine 
              y={budgetAmount} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{ 
                value: "Budget Total", 
                position: "right",
                fill: "hsl(var(--destructive))",
                fontSize: 9,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: "hsl(var(--accent))" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  // Budget Stats Card
  const BudgetStatsCard = () => {
    if (!budgetStats.hasBudget) return null;
    
    return (
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Análise de Budget
          </CardTitle>
          <CardDescription>
            Projeção baseada em {budgetStats.daysElapsed} de {budgetStats.totalDaysInMonth} dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Gasto do Mês</p>
              <p className="text-lg font-bold">{formatCurrency(budgetStats.currentMonthTotal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Média Diária</p>
              <p className="text-lg font-bold">{formatCurrency(budgetStats.dailyAverage)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Projeção Fim do Mês</p>
              <p className={cn(
                "text-lg font-bold",
                budgetStats.projectedTotal > budgetAmount ? "text-destructive" : "text-green-600"
              )}>
                {formatCurrency(budgetStats.projectedTotal)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Performance</p>
              <div className={cn(
                "flex items-center gap-1 text-lg font-bold",
                budgetStats.performanceVsBudget >= 0 ? "text-green-600" : "text-destructive"
              )}>
                {budgetStats.performanceVsBudget >= 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4" />
                    {budgetStats.performanceVsBudget.toFixed(1)}%
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    {Math.abs(budgetStats.performanceVsBudget).toFixed(1)}%
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {budgetStats.performanceVsBudget >= 0 ? "abaixo do budget" : "acima do budget"}
              </p>
            </div>
          </div>
          {budgetStats.projectedTotal > budgetAmount && (
            <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
              No ritmo atual, a unidade fechará o mês com um gasto de {formatCurrency(budgetStats.projectedTotal)}, 
              ultrapassando o budget em {formatCurrency(budgetStats.projectedTotal - budgetAmount)}.
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Budget Stats Card */}
      <BudgetStatsCard />

      {/* Mobile Carousel */}
      <div className="sm:hidden">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Análise Financeira
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={scrollPrev}
                  disabled={selectedIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={scrollNext}
                  disabled={selectedIndex === chartSlides.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(totalValue)}
            </p>
          </CardHeader>
          
          {/* Slide indicators */}
          <div className="flex justify-center gap-2 px-4 pb-2">
            {chartSlides.map((slide, index) => {
              const Icon = slide.icon;
              return (
                <button
                  key={slide.id}
                  onClick={() => emblaApi?.scrollTo(index)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                    selectedIndex === index
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden xs:inline">{slide.title}</span>
                </button>
              );
            })}
          </div>

          <CardContent className="px-2 pb-4">
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex">
                {/* Slide 1: Donut Chart */}
                <div className="flex-none w-full min-w-0 px-2">
                  <DonutChartContent />
                </div>
                
                {/* Slide 2: Bar Chart */}
                <div className="flex-none w-full min-w-0 px-2">
                  <BarChartContent />
                </div>
                
                {/* Slide 3: Line Chart */}
                <div className="flex-none w-full min-w-0 px-2">
                  <LineChartContent />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop Grid Layout */}
      <div className="hidden sm:grid gap-6 md:grid-cols-2">
        {/* Distribution by Função - Donut Chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Distribuição de Custos por Função
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Total do período: {formatCurrency(totalValue)}
            </p>
          </CardHeader>
          <CardContent className="px-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Donut Chart */}
              <div className="flex flex-col items-center">
                <div className="w-full h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataByFuncao}
                        cx="50%"
                        cy="50%"
                        innerRadius="40%"
                        outerRadius="75%"
                        paddingAngle={2}
                        dataKey="value"
                        label={false}
                      >
                        {dataByFuncao.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltipWithPercent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Desktop Legend */}
                <div className="w-full mt-4 grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {dataByFuncao.map((funcao, index) => (
                    <div key={funcao.name} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="truncate text-foreground">{funcao.name}</span>
                      <span className="text-muted-foreground ml-auto">{funcao.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ranking Cards */}
              <div className="hidden lg:block space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">
                  Ranking de Custos por Função
                </h4>
                {topFuncoes.map((funcao, index) => (
                  <div
                    key={funcao.name}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    >
                      {index + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {funcao.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(funcao.value)} • {funcao.percentage}%
                      </p>
                    </div>
                    {index === 0 && (
                      <TrendingUp className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                  </div>
                ))}
                {topFuncoes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum dado disponível
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Costs by Gerência - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Custos por Gerência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataByGerencia} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(value) =>
                      value.length > 12 ? `${value.slice(0, 12)}...` : value
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {dataByGerencia.map((_, index) => (
                      <Cell
                        key={`cell-gerencia-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Costs by Period - Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução de Custos por Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataByPeriod}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "hsl(var(--accent))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
