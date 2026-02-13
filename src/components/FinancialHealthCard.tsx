import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, differenceInDays, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, Wallet, Users, Wrench, Shirt, SprayCanIcon, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useOperationalExpenses } from "@/hooks/useOperationalExpenses";
import { FreelancerEntry } from "@/types/freelancer";
import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency, parseDateString } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface FinancialHealthCardProps {
  freelancerEntries: FreelancerEntry[];
  maintenanceEntries: MaintenanceEntry[];
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
  selectedUnidadeId,
}: FinancialHealthCardProps) {
  const { getBudgetForStoreMonth, getCurrentMonthYear, isLoading } = useStoreBudgets();
  const { getTotalsForStoreMonth, isLoading: isLoadingExpenses } = useOperationalExpenses();
  const { options: lojas } = useConfigLojas();
  const { isAdmin, isGerenteUnidade, unidades } = useUserProfile();

  const currentMonthYear = getCurrentMonthYear();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const totalDaysInMonth = getDaysInMonth(now);
  const daysElapsed = differenceInDays(now, monthStart) + 1;
  const daysRemaining = totalDaysInMonth - daysElapsed;

  // Determine effective store ID: use selected or fallback to first assigned store for gerentes
  const effectiveStoreId = useMemo(() => {
    if (selectedUnidadeId) return selectedUnidadeId;
    // For gerentes without explicit selection, use their first assigned store
    if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
      return unidades[0].id;
    }
    return null;
  }, [selectedUnidadeId, isGerenteUnidade, isAdmin, unidades]);

  const stats = useMemo(() => {
    // Filter entries for current month and selected store
    const currentMonthFreelancerEntries = freelancerEntries.filter((entry) => {
      const entryDate = parseDateString(entry.data_pop);
      const isCurrentMonth = entryDate >= monthStart && entryDate <= monthEnd;
      const matchesStore = !effectiveStoreId || entry.loja_id === effectiveStoreId;
      return isCurrentMonth && matchesStore;
    });

    const currentMonthMaintenanceEntries = maintenanceEntries.filter((entry) => {
      const entryDate = parseDateString(entry.data_servico);
      const isCurrentMonth = entryDate >= monthStart && entryDate <= monthEnd;
      const matchesStore = !effectiveStoreId || entry.loja_id === effectiveStoreId;
      return isCurrentMonth && matchesStore;
    });

    const freelancerTotal = currentMonthFreelancerEntries.reduce((sum, e) => sum + e.valor, 0);
    const maintenanceTotal = currentMonthMaintenanceEntries.reduce((sum, e) => sum + e.valor, 0);

    // Get operational expenses for the store
    const operationalTotals = effectiveStoreId 
      ? getTotalsForStoreMonth(effectiveStoreId, currentMonthYear)
      : { uniformes: 0, limpeza: 0, utensilios: 0, total: 0 };

    const totalSpent = freelancerTotal + maintenanceTotal + operationalTotals.uniformes + operationalTotals.limpeza + operationalTotals.utensilios;

    // Get budget for effective store
    const budget = effectiveStoreId 
      ? getBudgetForStoreMonth(effectiveStoreId, currentMonthYear)
      : null;
    
    const freelancerBudget = budget?.freelancer_budget || 0;
    const maintenanceBudget = budget?.maintenance_budget || 0;
    const uniformsBudget = budget?.uniforms_budget || 0;
    const cleaningBudget = budget?.cleaning_budget || 0;
    const utensilsBudget = budget?.utensils_budget || 0;
    const totalBudget = budget?.total_budget || 0;
    
    // Category stats
    const freelancerStats: CategoryStats = {
      spent: freelancerTotal,
      budget: freelancerBudget,
      percentageUsed: freelancerBudget > 0 ? (freelancerTotal / freelancerBudget) * 100 : 0,
      remaining: freelancerBudget - freelancerTotal,
      hasBudget: freelancerBudget > 0,
    };

    const maintenanceStats: CategoryStats = {
      spent: maintenanceTotal,
      budget: maintenanceBudget,
      percentageUsed: maintenanceBudget > 0 ? (maintenanceTotal / maintenanceBudget) * 100 : 0,
      remaining: maintenanceBudget - maintenanceTotal,
      hasBudget: maintenanceBudget > 0,
    };

    const uniformsStats: CategoryStats = {
      spent: operationalTotals.uniformes,
      budget: uniformsBudget,
      percentageUsed: uniformsBudget > 0 ? (operationalTotals.uniformes / uniformsBudget) * 100 : 0,
      remaining: uniformsBudget - operationalTotals.uniformes,
      hasBudget: uniformsBudget > 0,
    };

    const cleaningStats: CategoryStats = {
      spent: operationalTotals.limpeza,
      budget: cleaningBudget,
      percentageUsed: cleaningBudget > 0 ? (operationalTotals.limpeza / cleaningBudget) * 100 : 0,
      remaining: cleaningBudget - operationalTotals.limpeza,
      hasBudget: cleaningBudget > 0,
    };

    const utensilsStats: CategoryStats = {
      spent: operationalTotals.utensilios,
      budget: utensilsBudget,
      percentageUsed: utensilsBudget > 0 ? (operationalTotals.utensilios / utensilsBudget) * 100 : 0,
      remaining: utensilsBudget - operationalTotals.utensilios,
      hasBudget: utensilsBudget > 0,
    };

    const totalStats: CategoryStats = {
      spent: totalSpent,
      budget: totalBudget,
      percentageUsed: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      remaining: totalBudget - totalSpent,
      hasBudget: totalBudget > 0,
    };

    // Calculate daily average and projection
    const dailyAverage = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const projectedTotal = dailyAverage * totalDaysInMonth;
    const projectedOverBudget = totalBudget > 0 ? projectedTotal - totalBudget : 0;

    // Performance indicator
    const performanceVsBudget = totalBudget > 0 
      ? ((totalBudget - projectedTotal) / totalBudget) * 100 
      : 0;

    return {
      freelancer: freelancerStats,
      maintenance: maintenanceStats,
      uniforms: uniformsStats,
      cleaning: cleaningStats,
      utensils: utensilsStats,
      total: totalStats,
      dailyAverage,
      projectedTotal,
      projectedOverBudget,
      performanceVsBudget,
      hasBudget: totalBudget > 0,
    };
  }, [freelancerEntries, maintenanceEntries, effectiveStoreId, monthStart, monthEnd, getBudgetForStoreMonth, getTotalsForStoreMonth, currentMonthYear, daysElapsed, totalDaysInMonth]);

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
    stats: catStats 
  }: { 
    label: string; 
    icon: React.ElementType; 
    iconColor: string; 
    stats: CategoryStats;
  }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className={cn("h-3.5 w-3.5", iconColor)} />
          {label}
        </span>
        <span className="font-medium">
          {catStats.hasBudget ? `${catStats.percentageUsed.toFixed(1)}%` : "N/A"}
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
    </div>
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
          <span>{selectedStoreName} • {format(now, "MMMM yyyy", { locale: ptBR })}</span>
          <span className={cn(
            "text-xs font-medium",
            stats.total.percentageUsed > 90 ? "text-destructive" :
            stats.total.percentageUsed > 70 ? "text-amber-500" : "text-green-500"
          )}>
            {getStatusMessage()}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Category Progress Bars */}
        <div className="space-y-3">
          <CategoryProgressBar 
            label="Freelancers" 
            icon={Users} 
            iconColor="text-blue-500" 
            stats={stats.freelancer} 
          />
          <CategoryProgressBar 
            label="Manutenção" 
            icon={Wrench} 
            iconColor="text-amber-500" 
            stats={stats.maintenance} 
          />
          <CategoryProgressBar 
            label="Uniformes" 
            icon={Shirt} 
            iconColor="text-purple-500" 
            stats={stats.uniforms} 
          />
          <CategoryProgressBar 
            label="Limpeza" 
            icon={SprayCanIcon} 
            iconColor="text-cyan-500" 
            stats={stats.cleaning} 
          />
          <CategoryProgressBar 
            label="Utensílios" 
            icon={UtensilsCrossed} 
            iconColor="text-rose-500" 
            stats={stats.utensils} 
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
          {/* Saldo Freelancers */}
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

          {/* Saldo Manutenção */}
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

          {/* Saldo Uniformes */}
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

          {/* Saldo Limpeza */}
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

          {/* Saldo Utensílios */}
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
        </div>

        {/* Projection */}
        {stats.hasBudget && (
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
      </CardContent>
    </Card>
  );
}
