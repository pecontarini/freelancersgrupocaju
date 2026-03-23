import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, differenceInDays, getDaysInMonth, subMonths, addMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, Wallet, Users, Wrench, Shirt, SprayCanIcon, UtensilsCrossed, ShoppingBag, ChevronRight, ChevronLeft } from "lucide-react";
import { BudgetDrillDownDialog, BudgetCategory } from "@/components/dashboard/BudgetDrillDownDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOperationalExpenses } from "@/hooks/useOperationalExpenses";
import { useCheckinBudgetEntries } from "@/hooks/useCheckinBudgetEntries";
import { FreelancerEntry } from "@/types/freelancer";
import { MaintenanceEntry } from "@/types/maintenance";
import { OperationalExpense } from "@/hooks/useOperationalExpenses";
import { formatCurrency, parseDateString } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface FinancialHealthCardProps {
  freelancerEntries: FreelancerEntry[];
  maintenanceEntries: MaintenanceEntry[];
  operationalExpenses?: OperationalExpense[];
  selectedUnidadeId: string | null;
}

interface CategoryStats {
  spent: number;
  budget: number;
  percentageUsed: number;
  remaining: number;
  hasBudget: boolean;
}

export function FinancialHealthCard({
  freelancerEntries,
  maintenanceEntries,
  operationalExpenses: operationalExpensesProp,
  selectedUnidadeId,
}: FinancialHealthCardProps) {
  const [drillDownCategory, setDrillDownCategory] = useState<BudgetCategory | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { getBudgetForStoreMonth, isLoading } = useStoreBudgets();
  const { expenses: allOperationalExpenses, getTotalsForStoreMonth, isLoading: isLoadingExpenses } = useOperationalExpenses();
  const opExpenses = operationalExpensesProp ?? allOperationalExpenses;
  
  const { options: lojas } = useConfigLojas();
  const { isAdmin, isGerenteUnidade, unidades } = useUserProfile();

  const isCurrentMonth = isSameMonth(selectedDate, new Date());
  const selectedMonthYear = format(selectedDate, "yyyy-MM");
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const totalDaysInMonth = getDaysInMonth(selectedDate);
  const now = new Date();
  const daysElapsed = isCurrentMonth 
    ? differenceInDays(now, monthStart) + 1 
    : totalDaysInMonth;
  const daysRemaining = isCurrentMonth ? totalDaysInMonth - daysElapsed : 0;

  const navigateMonth = (direction: "prev" | "next") => {
    setSelectedDate(prev => direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  // Determine effective store ID
  const effectiveStoreId = useMemo(() => {
    if (selectedUnidadeId) return selectedUnidadeId;
    if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
      return unidades[0].id;
    }
    return null;
  }, [selectedUnidadeId, isGerenteUnidade, isAdmin, unidades]);

  const { total: checkinBudgetTotal } = useCheckinBudgetEntries(effectiveStoreId, selectedMonthYear);

  const stats = useMemo(() => {
    const currentMonthFreelancerEntries = freelancerEntries.filter((entry) => {
      const entryDate = parseDateString(entry.data_pop);
      const isInMonth = entryDate >= monthStart && entryDate <= monthEnd;
      const matchesStore = !effectiveStoreId || entry.loja_id === effectiveStoreId;
      return isInMonth && matchesStore;
    });

    const currentMonthMaintenanceEntries = maintenanceEntries.filter((entry) => {
      const entryDate = parseDateString(entry.data_servico);
      const isInMonth = entryDate >= monthStart && entryDate <= monthEnd;
      const matchesStore = !effectiveStoreId || entry.loja_id === effectiveStoreId;
      return isInMonth && matchesStore;
    });

    const freelancerTotal = currentMonthFreelancerEntries.reduce((sum, e) => sum + e.valor, 0);
    const checkinPresenceTotal = checkinBudgetTotal;
    const combinedFreelancerTotal = freelancerTotal + checkinPresenceTotal;
    const maintenanceTotal = currentMonthMaintenanceEntries.reduce((sum, e) => sum + e.valor, 0);

    const operationalTotals = effectiveStoreId 
      ? getTotalsForStoreMonth(effectiveStoreId, selectedMonthYear)
      : { uniformes: 0, limpeza: 0, utensilios: 0, apoio_venda: 0, total: 0 };

    const totalSpent = combinedFreelancerTotal + maintenanceTotal + operationalTotals.uniformes + operationalTotals.limpeza + operationalTotals.utensilios + operationalTotals.apoio_venda;

    const budget = effectiveStoreId 
      ? getBudgetForStoreMonth(effectiveStoreId, selectedMonthYear)
      : null;
    
    const freelancerBudget = budget?.freelancer_budget || 0;
    const maintenanceBudget = budget?.maintenance_budget || 0;
    const uniformsBudget = budget?.uniforms_budget || 0;
    const cleaningBudget = budget?.cleaning_budget || 0;
    const utensilsBudget = budget?.utensils_budget || 0;
    const apoioVendaBudget = budget?.apoio_venda_budget || 0;
    const totalBudget = budget?.total_budget || 0;
    
    const mkStats = (spent: number, bgt: number): CategoryStats => ({
      spent,
      budget: bgt,
      percentageUsed: bgt > 0 ? (spent / bgt) * 100 : 0,
      remaining: bgt - spent,
      hasBudget: bgt > 0,
    });

    const freelancerStats = mkStats(combinedFreelancerTotal, freelancerBudget);
    const maintenanceStats = mkStats(maintenanceTotal, maintenanceBudget);
    const uniformsStats = mkStats(operationalTotals.uniformes, uniformsBudget);
    const cleaningStats = mkStats(operationalTotals.limpeza, cleaningBudget);
    const utensilsStats = mkStats(operationalTotals.utensilios, utensilsBudget);
    const apoioVendaStats = mkStats(operationalTotals.apoio_venda, apoioVendaBudget);
    const totalStats = mkStats(totalSpent, totalBudget);

    const dailyAverage = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const projectedTotal = isCurrentMonth ? dailyAverage * totalDaysInMonth : totalSpent;
    const projectedOverBudget = totalBudget > 0 ? projectedTotal - totalBudget : 0;
    const performanceVsBudget = totalBudget > 0 
      ? ((totalBudget - projectedTotal) / totalBudget) * 100 
      : 0;

    return {
      freelancer: freelancerStats,
      maintenance: maintenanceStats,
      uniforms: uniformsStats,
      cleaning: cleaningStats,
      utensils: utensilsStats,
      apoioVenda: apoioVendaStats,
      total: totalStats,
      dailyAverage,
      projectedTotal,
      projectedOverBudget,
      performanceVsBudget,
      hasBudget: totalBudget > 0,
    };
  }, [freelancerEntries, maintenanceEntries, effectiveStoreId, monthStart, monthEnd, getBudgetForStoreMonth, getTotalsForStoreMonth, selectedMonthYear, daysElapsed, totalDaysInMonth, isCurrentMonth]);

  const getProgressColor = (percentage: number) => {
    if (percentage > 90) return "bg-destructive";
    if (percentage > 70) return "bg-amber-500";
    return "bg-green-500";
  };

  const getStatusIcon = () => {
    if (!stats.hasBudget) return <Target className="h-5 w-5 text-muted-foreground" />;
    if (stats.total.percentageUsed > 90) return <AlertTriangle className="h-5 w-5 text-destructive" />;
    if (stats.total.percentageUsed > 70) return <TrendingUp className="h-5 w-5 text-amber-500" />;
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  const getStatusMessage = () => {
    if (!stats.hasBudget) return "Budget não configurado";
    if (stats.total.percentageUsed > 100) return "Orçamento excedido!";
    if (stats.total.percentageUsed > 90) return "Atenção: próximo do limite";
    if (stats.total.percentageUsed > 70) return "Consumo moderado";
    return "Dentro do orçamento";
  };

  const selectedStoreName = effectiveStoreId 
    ? lojas.find(l => l.id === effectiveStoreId)?.nome || "Loja selecionada"
    : "Todas as lojas";

  if (isLoading || isLoadingExpenses) return null;

  const CategoryProgressBar = ({ 
    label, 
    icon: Icon, 
    iconColor, 
    stats: catStats,
    onClick,
  }: { 
    label: string; 
    icon: React.ElementType; 
    iconColor: string; 
    stats: CategoryStats;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      className={cn(
        "w-full text-left space-y-1.5 rounded-lg p-2 -mx-2 transition-colors",
        onClick && "hover:bg-muted/60 cursor-pointer group"
      )}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className={cn("h-3.5 w-3.5", iconColor)} />
          {label}
        </span>
        <span className="flex items-center gap-1 font-medium">
          {catStats.hasBudget ? `${catStats.percentageUsed.toFixed(1)}%` : "N/A"}
          {onClick && <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </span>
      </div>
      {catStats.hasBudget ? (
        <div className="relative">
          <Progress value={0} className="h-2" />
          <div 
            className={cn(
              "absolute inset-0 h-2 rounded-full transition-all",
              getProgressColor(catStats.percentageUsed)
            )}
            style={{ width: `${Math.min(catStats.percentageUsed, 100)}%` }}
          />
        </div>
      ) : (
        <div className="h-2 bg-muted rounded-full" />
      )}
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{formatCurrency(catStats.spent)}</span>
        <span>{catStats.hasBudget ? formatCurrency(catStats.budget) : "Sem budget"}</span>
      </div>
    </button>
  );

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Saúde Financeira</CardTitle>
          </div>
          {getStatusIcon()}
        </div>
        <CardDescription className="flex items-center justify-between">
          <span>{selectedStoreName}</span>
          <span className={cn(
            "text-xs font-medium",
            stats.total.percentageUsed > 90 ? "text-destructive" :
            stats.total.percentageUsed > 70 ? "text-amber-500" : "text-green-500"
          )}>
            {getStatusMessage()}
          </span>
        </CardDescription>
        {/* Month Navigation */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigateMonth("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center capitalize">
            {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigateMonth("next")}
            disabled={isCurrentMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Category Progress Bars */}
        <div className="space-y-3">
          <CategoryProgressBar 
            label="Freelancers" 
            icon={Users} 
            iconColor="text-blue-500" 
            stats={stats.freelancer} 
            onClick={() => setDrillDownCategory("freelancer")}
          />
          <CategoryProgressBar 
            label="Manutenção" 
            icon={Wrench} 
            iconColor="text-amber-500" 
            stats={stats.maintenance} 
            onClick={() => setDrillDownCategory("maintenance")}
          />
          <CategoryProgressBar 
            label="Uniformes" 
            icon={Shirt} 
            iconColor="text-purple-500" 
            stats={stats.uniforms} 
            onClick={() => setDrillDownCategory("uniforms")}
          />
          <CategoryProgressBar 
            label="Limpeza" 
            icon={SprayCanIcon} 
            iconColor="text-cyan-500" 
            stats={stats.cleaning} 
            onClick={() => setDrillDownCategory("cleaning")}
          />
          <CategoryProgressBar 
            label="Utensílios" 
            icon={UtensilsCrossed} 
            iconColor="text-rose-500" 
            stats={stats.utensils} 
            onClick={() => setDrillDownCategory("utensils")}
          />
          <CategoryProgressBar 
            label="Apoio à Venda" 
            icon={ShoppingBag} 
            iconColor="text-emerald-500" 
            stats={stats.apoioVenda} 
            onClick={() => setDrillDownCategory("apoio_venda")}
          />
          <div className="pt-2 border-t">
            <CategoryProgressBar 
              label="Total Geral" 
              icon={DollarSign} 
              iconColor="text-primary" 
              stats={stats.total} 
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3 text-blue-500" />
              Saldo Freelancers
            </p>
            <p className={cn(
              "text-sm font-bold",
              stats.freelancer.remaining >= 0 ? "text-blue-600" : "text-destructive"
            )}>
              {stats.freelancer.hasBudget ? formatCurrency(stats.freelancer.remaining) : "N/A"}
            </p>
          </div>

          <div className="space-y-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Wrench className="h-3 w-3 text-amber-500" />
              Saldo Manutenção
            </p>
            <p className={cn(
              "text-sm font-bold",
              stats.maintenance.remaining >= 0 ? "text-amber-600" : "text-destructive"
            )}>
              {stats.maintenance.hasBudget ? formatCurrency(stats.maintenance.remaining) : "N/A"}
            </p>
          </div>

          <div className="space-y-1 rounded-lg bg-purple-50 dark:bg-purple-950/30 p-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Shirt className="h-3 w-3 text-purple-500" />
              Saldo Uniformes
            </p>
            <p className={cn(
              "text-sm font-bold",
              stats.uniforms.remaining >= 0 ? "text-purple-600" : "text-destructive"
            )}>
              {stats.uniforms.hasBudget ? formatCurrency(stats.uniforms.remaining) : "N/A"}
            </p>
          </div>

          <div className="space-y-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 p-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <SprayCanIcon className="h-3 w-3 text-cyan-500" />
              Saldo Limpeza
            </p>
            <p className={cn(
              "text-sm font-bold",
              stats.cleaning.remaining >= 0 ? "text-cyan-600" : "text-destructive"
            )}>
              {stats.cleaning.hasBudget ? formatCurrency(stats.cleaning.remaining) : "N/A"}
            </p>
          </div>

          <div className="space-y-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 p-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <UtensilsCrossed className="h-3 w-3 text-rose-500" />
              Saldo Utensílios
            </p>
            <p className={cn(
              "text-sm font-bold",
              stats.utensils.remaining >= 0 ? "text-rose-600" : "text-destructive"
            )}>
              {stats.utensils.hasBudget ? formatCurrency(stats.utensils.remaining) : "N/A"}
            </p>
          </div>

          <div className="space-y-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <ShoppingBag className="h-3 w-3 text-emerald-500" />
              Saldo Apoio à Venda
            </p>
            <p className={cn(
              "text-sm font-bold",
              stats.apoioVenda.remaining >= 0 ? "text-emerald-600" : "text-destructive"
            )}>
              {stats.apoioVenda.hasBudget ? formatCurrency(stats.apoioVenda.remaining) : "N/A"}
            </p>
          </div>
        </div>

        {/* Projection - only show for current month */}
        {stats.hasBudget && isCurrentMonth && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Projeção de Fechamento</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Média diária: {formatCurrency(stats.dailyAverage)}
                </p>
                <p className="text-lg font-bold">
                  Previsão: {formatCurrency(stats.projectedTotal)}
                </p>
              </div>
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                stats.performanceVsBudget >= 0 
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                {stats.performanceVsBudget >= 0 ? (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    {stats.performanceVsBudget.toFixed(1)}% abaixo
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    {Math.abs(stats.performanceVsBudget).toFixed(1)}% acima
                  </>
                )}
              </div>
            </div>
            {stats.projectedOverBudget > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Projeção ultrapassa o budget em {formatCurrency(stats.projectedOverBudget)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {daysRemaining} dias restantes no mês
            </p>
          </div>
        )}

        {/* Past month summary */}
        {stats.hasBudget && !isCurrentMonth && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Resultado do Mês</span>
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                stats.total.remaining >= 0 
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                {stats.total.remaining >= 0 ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Dentro do budget
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    Excedido em {formatCurrency(Math.abs(stats.total.remaining))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Drill-down dialog */}
      {drillDownCategory && (
        <BudgetDrillDownDialog
          open={!!drillDownCategory}
          onOpenChange={(open) => { if (!open) setDrillDownCategory(null); }}
          category={drillDownCategory}
          freelancerEntries={freelancerEntries}
          maintenanceEntries={maintenanceEntries}
          operationalExpenses={opExpenses}
          storeId={effectiveStoreId}
          monthYear={selectedMonthYear}
          budgetAmount={
            drillDownCategory === "freelancer" ? stats.freelancer.budget :
            drillDownCategory === "maintenance" ? stats.maintenance.budget :
            drillDownCategory === "uniforms" ? stats.uniforms.budget :
            drillDownCategory === "cleaning" ? stats.cleaning.budget :
            drillDownCategory === "apoio_venda" ? stats.apoioVenda.budget :
            stats.utensils.budget
          }
        />
      )}
    </Card>
  );
}
