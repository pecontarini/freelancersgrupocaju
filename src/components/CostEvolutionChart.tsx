import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FreelancerEntry } from "@/types/freelancer";
import { MaintenanceEntry } from "@/types/maintenance";
import { OperationalExpense } from "@/hooks/useOperationalExpenses";
import { formatCurrency, parseDateString } from "@/lib/formatters";
import { TrendingUp, Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { useStoreBudgets, StoreBudget } from "@/hooks/useStoreBudgets";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  getWeek,
  format,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type ViewMode = "daily" | "weekly" | "monthly";

interface CostEvolutionChartProps {
  freelancerEntries: FreelancerEntry[];
  maintenanceEntries: MaintenanceEntry[];
  operationalExpenses: OperationalExpense[];
  selectedUnidadeId?: string | null;
}

interface ChartDataPoint {
  name: string;
  freelancers: number;
  manutencao: number;
  uniformes: number;
  limpeza: number;
  total: number;
  sortKey: string;
}

const CHART_COLORS = {
  freelancers: "hsl(12, 76%, 61%)",     // Coral primary
  manutencao: "hsl(173, 58%, 39%)",     // Teal
  uniformes: "hsl(43, 96%, 56%)",       // Amber
  limpeza: "hsl(215, 72%, 52%)",        // Blue
  budget: "hsl(var(--destructive))",
};

export const CostEvolutionChart = ({
  freelancerEntries,
  maintenanceEntries,
  operationalExpenses,
  selectedUnidadeId,
}: CostEvolutionChartProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const { getBudgetForStoreMonth, getCurrentMonthYear } = useStoreBudgets();
  const { isAdmin, isGerenteUnidade, unidades } = useUserProfile();

  // Determine effective store ID
  const effectiveStoreId = useMemo(() => {
    if (selectedUnidadeId) return selectedUnidadeId;
    if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
      return unidades[0].id;
    }
    return null;
  }, [selectedUnidadeId, isGerenteUnidade, isAdmin, unidades]);

  // Get current budget for the store
  const currentMonthYear = getCurrentMonthYear();
  const currentBudget = effectiveStoreId
    ? getBudgetForStoreMonth(effectiveStoreId, currentMonthYear)
    : null;

  // Calculate daily budget average for reference line
  const dailyBudgetAverage = useMemo(() => {
    if (!currentBudget) return 0;
    const totalBudget =
      (currentBudget.freelancer_budget || 0) +
      (currentBudget.maintenance_budget || 0) +
      (currentBudget.uniforms_budget || 0) +
      (currentBudget.cleaning_budget || 0);
    const daysInMonth = getDaysInMonth(new Date());
    return totalBudget / daysInMonth;
  }, [currentBudget]);

  // Weekly budget average
  const weeklyBudgetAverage = dailyBudgetAverage * 7;

  // Monthly budget total
  const monthlyBudgetTotal = useMemo(() => {
    if (!currentBudget) return 0;
    return (
      (currentBudget.freelancer_budget || 0) +
      (currentBudget.maintenance_budget || 0) +
      (currentBudget.uniforms_budget || 0) +
      (currentBudget.cleaning_budget || 0)
    );
  }, [currentBudget]);

  // Filter entries by store
  const filteredFreelancerEntries = useMemo(() => {
    if (!effectiveStoreId) return freelancerEntries;
    return freelancerEntries.filter((e) => e.loja_id === effectiveStoreId);
  }, [freelancerEntries, effectiveStoreId]);

  const filteredMaintenanceEntries = useMemo(() => {
    if (!effectiveStoreId) return maintenanceEntries;
    return maintenanceEntries.filter((e) => e.loja_id === effectiveStoreId);
  }, [maintenanceEntries, effectiveStoreId]);

  const filteredOperationalExpenses = useMemo(() => {
    if (!effectiveStoreId) return operationalExpenses;
    return operationalExpenses.filter((e) => e.store_id === effectiveStoreId);
  }, [operationalExpenses, effectiveStoreId]);

  // DAILY DATA - Group by day within current month
  const dailyData = useMemo((): ChartDataPoint[] => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Initialize all days
    const dayMap: Record<string, ChartDataPoint> = {};
    allDays.forEach((day) => {
      const dayKey = format(day, "yyyy-MM-dd");
      const displayName = format(day, "dd");
      dayMap[dayKey] = {
        name: displayName,
        freelancers: 0,
        manutencao: 0,
        uniformes: 0,
        limpeza: 0,
        total: 0,
        sortKey: dayKey,
      };
    });

    // Add freelancer entries
    filteredFreelancerEntries.forEach((entry) => {
      const entryDate = parseDateString(entry.data_pop);
      if (entryDate >= monthStart && entryDate <= monthEnd) {
        const dayKey = format(entryDate, "yyyy-MM-dd");
        if (dayMap[dayKey]) {
          dayMap[dayKey].freelancers += entry.valor;
          dayMap[dayKey].total += entry.valor;
        }
      }
    });

    // Add maintenance entries
    filteredMaintenanceEntries.forEach((entry) => {
      const entryDate = parseDateString(entry.data_servico);
      if (entryDate >= monthStart && entryDate <= monthEnd) {
        const dayKey = format(entryDate, "yyyy-MM-dd");
        if (dayMap[dayKey]) {
          dayMap[dayKey].manutencao += entry.valor;
          dayMap[dayKey].total += entry.valor;
        }
      }
    });

    // Add operational expenses
    filteredOperationalExpenses.forEach((expense) => {
      const expenseDate = parseDateString(expense.data_despesa);
      if (expenseDate >= monthStart && expenseDate <= monthEnd) {
        const dayKey = format(expenseDate, "yyyy-MM-dd");
        if (dayMap[dayKey]) {
          if (expense.category === "uniformes") {
            dayMap[dayKey].uniformes += expense.valor;
          } else if (expense.category === "limpeza") {
            dayMap[dayKey].limpeza += expense.valor;
          }
          dayMap[dayKey].total += expense.valor;
        }
      }
    });

    return Object.values(dayMap).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );
  }, [filteredFreelancerEntries, filteredMaintenanceEntries, filteredOperationalExpenses]);

  // WEEKLY DATA - Group by week within current month
  const weeklyData = useMemo((): ChartDataPoint[] => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Determine weeks in the month
    const weeks: { start: Date; end: Date; name: string }[] = [];
    let current = monthStart;
    let weekNum = 1;

    while (current <= monthEnd) {
      const weekEnd = endOfWeek(current, { locale: ptBR });
      const adjustedEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
      weeks.push({
        start: current,
        end: adjustedEnd,
        name: `Sem ${weekNum}`,
      });
      current = new Date(weekEnd);
      current.setDate(current.getDate() + 1);
      weekNum++;
    }

    return weeks.map((week, index) => {
      let freelancers = 0;
      let manutencao = 0;
      let uniformes = 0;
      let limpeza = 0;

      // Sum freelancer entries in this week
      filteredFreelancerEntries.forEach((entry) => {
        const entryDate = parseDateString(entry.data_pop);
        if (entryDate >= week.start && entryDate <= week.end && isSameMonth(entryDate, now)) {
          freelancers += entry.valor;
        }
      });

      // Sum maintenance entries in this week
      filteredMaintenanceEntries.forEach((entry) => {
        const entryDate = parseDateString(entry.data_servico);
        if (entryDate >= week.start && entryDate <= week.end && isSameMonth(entryDate, now)) {
          manutencao += entry.valor;
        }
      });

      // Sum operational expenses in this week
      filteredOperationalExpenses.forEach((expense) => {
        const expenseDate = parseDateString(expense.data_despesa);
        if (expenseDate >= week.start && expenseDate <= week.end && isSameMonth(expenseDate, now)) {
          if (expense.category === "uniformes") {
            uniformes += expense.valor;
          } else if (expense.category === "limpeza") {
            limpeza += expense.valor;
          }
        }
      });

      return {
        name: week.name,
        freelancers,
        manutencao,
        uniformes,
        limpeza,
        total: freelancers + manutencao + uniformes + limpeza,
        sortKey: String(index),
      };
    });
  }, [filteredFreelancerEntries, filteredMaintenanceEntries, filteredOperationalExpenses]);

  // MONTHLY DATA - Historical view across year with per-month budgets
  const monthlyData = useMemo((): (ChartDataPoint & { budget?: number })[] => {
    const monthMap: Record<string, ChartDataPoint & { budget?: number }> = {};

    // Initialize months for the current year
    const now = new Date();
    const currentYear = now.getFullYear();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    for (let m = 0; m < 12; m++) {
      const monthKey = `${currentYear}-${String(m + 1).padStart(2, "0")}`;
      // Get stored budget for this month
      const monthBudget = effectiveStoreId 
        ? getBudgetForStoreMonth(effectiveStoreId, monthKey)
        : null;
      const totalBudget = monthBudget 
        ? (monthBudget.freelancer_budget || 0) + (monthBudget.maintenance_budget || 0) + (monthBudget.uniforms_budget || 0) + (monthBudget.cleaning_budget || 0) + (monthBudget.utensils_budget || 0)
        : 0;
      monthMap[monthKey] = {
        name: monthNames[m],
        freelancers: 0,
        manutencao: 0,
        uniformes: 0,
        limpeza: 0,
        total: 0,
        sortKey: monthKey,
        budget: totalBudget > 0 ? totalBudget : undefined,
      };
    }

    // Add freelancer entries
    filteredFreelancerEntries.forEach((entry) => {
      const date = parseDateString(entry.data_pop);
      if (date.getFullYear() === currentYear) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap[monthKey]) {
          monthMap[monthKey].freelancers += entry.valor;
          monthMap[monthKey].total += entry.valor;
        }
      }
    });

    // Add maintenance entries
    filteredMaintenanceEntries.forEach((entry) => {
      const date = parseDateString(entry.data_servico);
      if (date.getFullYear() === currentYear) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap[monthKey]) {
          monthMap[monthKey].manutencao += entry.valor;
          monthMap[monthKey].total += entry.valor;
        }
      }
    });

    // Add operational expenses
    filteredOperationalExpenses.forEach((expense) => {
      const date = parseDateString(expense.data_despesa);
      if (date.getFullYear() === currentYear) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (monthMap[monthKey]) {
          if (expense.category === "uniformes") {
            monthMap[monthKey].uniformes += expense.valor;
          } else if (expense.category === "limpeza") {
            monthMap[monthKey].limpeza += expense.valor;
          }
          monthMap[monthKey].total += expense.valor;
        }
      }
    });

    return Object.values(monthMap).sort((a, b) =>
      a.sortKey.localeCompare(b.sortKey)
    );
  }, [filteredFreelancerEntries, filteredMaintenanceEntries, filteredOperationalExpenses, effectiveStoreId, getBudgetForStoreMonth]);

  // Select data based on view mode
  const chartData = useMemo(() => {
    switch (viewMode) {
      case "daily":
        return dailyData;
      case "weekly":
        return weeklyData;
      case "monthly":
        return monthlyData;
      default:
        return monthlyData;
    }
  }, [viewMode, dailyData, weeklyData, monthlyData]);

  // Budget reference line value based on view mode
  const budgetReferenceValue = useMemo(() => {
    switch (viewMode) {
      case "daily":
        return dailyBudgetAverage;
      case "weekly":
        return weeklyBudgetAverage;
      case "monthly":
        return monthlyBudgetTotal;
      default:
        return 0;
    }
  }, [viewMode, dailyBudgetAverage, weeklyBudgetAverage, monthlyBudgetTotal]);

  // Custom tooltip with category breakdown
  const DetailedTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload as (ChartDataPoint & { budget?: number });
      if (!data) return null;

      return (
        <div className="rounded-lg border bg-background p-3 shadow-xl min-w-[200px]">
          <p className="font-semibold text-foreground mb-2 border-b pb-1">
            {viewMode === "daily" && `Dia ${label}`}
            {viewMode === "weekly" && label}
            {viewMode === "monthly" && label}
          </p>
          <div className="space-y-1.5 text-sm">
            {data.freelancers > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS.freelancers }}
                  />
                  <span className="text-muted-foreground">Freelancers</span>
                </div>
                <span className="font-medium">{formatCurrency(data.freelancers)}</span>
              </div>
            )}
            {data.manutencao > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS.manutencao }}
                  />
                  <span className="text-muted-foreground">Manutenção</span>
                </div>
                <span className="font-medium">{formatCurrency(data.manutencao)}</span>
              </div>
            )}
            {data.uniformes > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS.uniformes }}
                  />
                  <span className="text-muted-foreground">Uniformes</span>
                </div>
                <span className="font-medium">{formatCurrency(data.uniformes)}</span>
              </div>
            )}
            {data.limpeza > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CHART_COLORS.limpeza }}
                  />
                  <span className="text-muted-foreground">Limpeza</span>
                </div>
                <span className="font-medium">{formatCurrency(data.limpeza)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1.5 border-t mt-1.5">
              <span className="font-medium text-foreground">Total</span>
              <span className="font-bold text-primary">{formatCurrency(data.total)}</span>
            </div>
            {viewMode === "monthly" && data.budget && data.budget > 0 && (
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Budget</span>
                <span className="font-medium">{formatCurrency(data.budget)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const viewModeLabels = {
    daily: "Diário",
    weekly: "Semanal",
    monthly: "Mensal",
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            EVOLUÇÃO DE CUSTOS POR PERÍODO
          </CardTitle>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as ViewMode)}
            className="bg-muted rounded-lg p-1"
          >
            <ToggleGroupItem
              value="daily"
              aria-label="Visão Diária"
              className={cn(
                "gap-1.5 px-3 py-1.5 text-xs font-medium transition-all data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Diário</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="weekly"
              aria-label="Visão Semanal"
              className={cn(
                "gap-1.5 px-3 py-1.5 text-xs font-medium transition-all data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Semanal</span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="monthly"
              aria-label="Visão Mensal"
              className={cn(
                "gap-1.5 px-3 py-1.5 text-xs font-medium transition-all data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mensal</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <p className="text-sm text-muted-foreground">
          {viewMode === "daily" && `Gastos diários do mês atual (${format(new Date(), "MMMM yyyy", { locale: ptBR })})`}
          {viewMode === "weekly" && `Gastos semanais do mês atual (${format(new Date(), "MMMM yyyy", { locale: ptBR })})`}
          {viewMode === "monthly" && `Comparativo mensal de ${new Date().getFullYear()}`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFreelancers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.freelancers} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={CHART_COLORS.freelancers} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorManutencao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.manutencao} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={CHART_COLORS.manutencao} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorUniformes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.uniformes} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={CHART_COLORS.uniformes} stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorLimpeza" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.limpeza} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={CHART_COLORS.limpeza} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
                }
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<DetailedTooltip />} />
              {budgetReferenceValue > 0 && viewMode !== "monthly" && (
                <ReferenceLine
                  y={budgetReferenceValue}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{
                    value: `Meta ${viewModeLabels[viewMode]}`,
                    position: "right",
                    fill: "hsl(var(--destructive))",
                    fontSize: 10,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="freelancers"
                stackId="1"
                stroke={CHART_COLORS.freelancers}
                fill="url(#colorFreelancers)"
                strokeWidth={2}
                animationDuration={500}
              />
              <Area
                type="monotone"
                dataKey="manutencao"
                stackId="1"
                stroke={CHART_COLORS.manutencao}
                fill="url(#colorManutencao)"
                strokeWidth={2}
                animationDuration={500}
              />
              <Area
                type="monotone"
                dataKey="uniformes"
                stackId="1"
                stroke={CHART_COLORS.uniformes}
                fill="url(#colorUniformes)"
                strokeWidth={2}
                animationDuration={500}
              />
              <Area
                type="monotone"
                dataKey="limpeza"
                stackId="1"
                stroke={CHART_COLORS.limpeza}
                fill="url(#colorLimpeza)"
                strokeWidth={2}
                animationDuration={500}
              />
              {viewMode === "monthly" && (
                <Line
                  type="monotone"
                  dataKey="budget"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "hsl(var(--destructive))", r: 3, strokeWidth: 0 }}
                  connectNulls={false}
                  animationDuration={500}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.freelancers }}
            />
            <span className="text-muted-foreground">Freelancers</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.manutencao }}
            />
            <span className="text-muted-foreground">Manutenção</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.uniformes }}
            />
            <span className="text-muted-foreground">Uniformes</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.limpeza }}
            />
            <span className="text-muted-foreground">Limpeza</span>
          </div>
          {(budgetReferenceValue > 0 || viewMode === "monthly") && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-4 h-0.5 border-t-2 border-dashed border-destructive" />
              <span className="text-muted-foreground">Meta Budget</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
