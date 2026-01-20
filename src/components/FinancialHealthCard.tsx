import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, differenceInDays, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Target, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { FreelancerEntry } from "@/types/freelancer";
import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency, parseDateString } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface FinancialHealthCardProps {
  freelancerEntries: FreelancerEntry[];
  maintenanceEntries: MaintenanceEntry[];
  selectedUnidadeId: string | null;
}

export function FinancialHealthCard({
  freelancerEntries,
  maintenanceEntries,
  selectedUnidadeId,
}: FinancialHealthCardProps) {
  const { getBudgetForStoreMonth, getCurrentMonthYear, isLoading } = useStoreBudgets();
  const { options: lojas } = useConfigLojas();

  const currentMonthYear = getCurrentMonthYear();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const totalDaysInMonth = getDaysInMonth(now);
  const daysElapsed = differenceInDays(now, monthStart) + 1;
  const daysRemaining = totalDaysInMonth - daysElapsed;

  const stats = useMemo(() => {
    // Filter entries for current month and selected store
    const currentMonthFreelancerEntries = freelancerEntries.filter((entry) => {
      const entryDate = parseDateString(entry.data_pop);
      const isCurrentMonth = entryDate >= monthStart && entryDate <= monthEnd;
      const matchesStore = !selectedUnidadeId || entry.loja_id === selectedUnidadeId;
      return isCurrentMonth && matchesStore;
    });

    const currentMonthMaintenanceEntries = maintenanceEntries.filter((entry) => {
      const entryDate = parseDateString(entry.data_servico);
      const isCurrentMonth = entryDate >= monthStart && entryDate <= monthEnd;
      const matchesStore = !selectedUnidadeId || entry.loja_id === selectedUnidadeId;
      return isCurrentMonth && matchesStore;
    });

    const freelancerTotal = currentMonthFreelancerEntries.reduce((sum, e) => sum + e.valor, 0);
    const maintenanceTotal = currentMonthMaintenanceEntries.reduce((sum, e) => sum + e.valor, 0);
    const totalSpent = freelancerTotal + maintenanceTotal;

    // Get budget for selected store
    const budget = selectedUnidadeId 
      ? getBudgetForStoreMonth(selectedUnidadeId, currentMonthYear)
      : null;
    
    const budgetAmount = budget?.budget_amount || 0;
    const percentageUsed = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;
    const remainingBudget = budgetAmount - totalSpent;

    // Calculate daily average and projection
    const dailyAverage = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const projectedTotal = dailyAverage * totalDaysInMonth;
    const projectedOverBudget = budgetAmount > 0 ? projectedTotal - budgetAmount : 0;

    // Performance indicator
    const performanceVsBudget = budgetAmount > 0 
      ? ((budgetAmount - projectedTotal) / budgetAmount) * 100 
      : 0;

    return {
      totalSpent,
      freelancerTotal,
      maintenanceTotal,
      budgetAmount,
      percentageUsed,
      remainingBudget,
      dailyAverage,
      projectedTotal,
      projectedOverBudget,
      performanceVsBudget,
      hasBudget: budgetAmount > 0,
    };
  }, [freelancerEntries, maintenanceEntries, selectedUnidadeId, monthStart, monthEnd, getBudgetForStoreMonth, currentMonthYear, daysElapsed, totalDaysInMonth]);

  const getProgressColor = (percentage: number) => {
    if (percentage > 90) return "bg-destructive";
    if (percentage > 70) return "bg-amber-500";
    return "bg-green-500";
  };

  const getStatusIcon = () => {
    if (!stats.hasBudget) return <Target className="h-5 w-5 text-muted-foreground" />;
    if (stats.percentageUsed > 90) return <AlertTriangle className="h-5 w-5 text-destructive" />;
    if (stats.percentageUsed > 70) return <TrendingUp className="h-5 w-5 text-amber-500" />;
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  const getStatusMessage = () => {
    if (!stats.hasBudget) return "Budget não configurado";
    if (stats.percentageUsed > 100) return "Orçamento excedido!";
    if (stats.percentageUsed > 90) return "Atenção: próximo do limite";
    if (stats.percentageUsed > 70) return "Consumo moderado";
    return "Dentro do orçamento";
  };

  const selectedStoreName = selectedUnidadeId 
    ? lojas.find(l => l.id === selectedUnidadeId)?.nome || "Loja selecionada"
    : "Todas as lojas";

  if (isLoading) return null;

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
            stats.percentageUsed > 90 ? "text-destructive" :
            stats.percentageUsed > 70 ? "text-amber-500" : "text-green-500"
          )}>
            {getStatusMessage()}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Consumo do mês</span>
            <span className="font-semibold">
              {stats.hasBudget ? `${stats.percentageUsed.toFixed(1)}%` : "N/A"}
            </span>
          </div>
          {stats.hasBudget ? (
            <div className="relative">
              <Progress 
                value={Math.min(stats.percentageUsed, 100)} 
                className="h-3"
              />
              <div 
                className={cn(
                  "absolute inset-0 h-3 rounded-full",
                  getProgressColor(stats.percentageUsed)
                )}
                style={{ width: `${Math.min(stats.percentageUsed, 100)}%` }}
              />
            </div>
          ) : (
            <div className="h-3 bg-muted rounded-full flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground">Sem budget</span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Gasto Acumulado */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Gasto Acumulado</p>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(stats.totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground">
              Freelancer: {formatCurrency(stats.freelancerTotal)}
            </p>
            <p className="text-xs text-muted-foreground">
              Manutenção: {formatCurrency(stats.maintenanceTotal)}
            </p>
          </div>

          {/* Budget Definido */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Budget Definido</p>
            <p className="text-lg font-bold text-primary">
              {stats.hasBudget ? formatCurrency(stats.budgetAmount) : "Não definido"}
            </p>
            {stats.hasBudget && (
              <>
                <p className={cn(
                  "text-xs font-medium",
                  stats.remainingBudget >= 0 ? "text-green-600" : "text-destructive"
                )}>
                  Saldo: {formatCurrency(stats.remainingBudget)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {daysRemaining} dias restantes
                </p>
              </>
            )}
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
                  ? "bg-green-100 text-green-700" 
                  : "bg-red-100 text-red-700"
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
