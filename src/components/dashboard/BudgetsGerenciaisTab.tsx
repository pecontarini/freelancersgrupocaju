import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  User,
  Calendar,
  DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FreelancerForm } from "@/components/FreelancerForm";
import { OperationalExpenseForm } from "@/components/OperationalExpenseForm";
import { FreelancerEntry } from "@/types/freelancer";
import { OperationalExpense } from "@/hooks/useOperationalExpenses";
import { formatCurrency } from "@/lib/formatters";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";

interface BudgetsGerenciaisTabProps {
  freelancerEntries: FreelancerEntry[];
  operationalExpenses: OperationalExpense[];
  selectedUnidadeId: string | null;
}

export function BudgetsGerenciaisTab({
  freelancerEntries,
  operationalExpenses,
  selectedUnidadeId,
}: BudgetsGerenciaisTabProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentMonth = format(new Date(), "yyyy-MM");

  const { getBudgetForStoreMonth, getCurrentMonthYear } = useStoreBudgets();
  
  const budget = selectedUnidadeId 
    ? getBudgetForStoreMonth(selectedUnidadeId, getCurrentMonthYear()) 
    : undefined;

  // Filter today's entries
  const todayFreelancers = useMemo(() => {
    return freelancerEntries.filter((entry) => entry.data_pop === today);
  }, [freelancerEntries, today]);

  const todayExpenses = useMemo(() => {
    return operationalExpenses.filter(
      (expense) => expense.data_despesa === today
    );
  }, [operationalExpenses, today]);

  // Calculate today's totals
  const todayFreelancerTotal = todayFreelancers.reduce(
    (sum, e) => sum + e.valor,
    0
  );
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.valor, 0);
  const todayTotal = todayFreelancerTotal + todayExpenseTotal;

  // Calculate month totals
  const monthFreelancerTotal = freelancerEntries
    .filter((e) => e.data_pop.startsWith(currentMonth))
    .reduce((sum, e) => sum + e.valor, 0);

  const monthExpenseTotal = operationalExpenses
    .filter((e) => e.data_despesa.startsWith(currentMonth))
    .reduce((sum, e) => sum + e.valor, 0);

  // Budget calculations
  const totalMonthlyBudget = budget
    ? budget.freelancer_budget +
      budget.maintenance_budget +
      budget.uniforms_budget +
      budget.cleaning_budget
    : 0;

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const currentDay = new Date().getDate();
  const avgDailyBudget = totalMonthlyBudget / daysInMonth;

  const dailyConsumptionPercentage = avgDailyBudget
    ? Math.min((todayTotal / avgDailyBudget) * 100, 100)
    : 0;

  const monthConsumptionPercentage = totalMonthlyBudget
    ? Math.min(
        ((monthFreelancerTotal + monthExpenseTotal) / totalMonthlyBudget) * 100,
        100
      )
    : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage < 70) return "bg-emerald-500";
    if (percentage < 90) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Date Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">
              Gastos de Hoje
            </h2>
            <p className="text-muted-foreground">
              {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      {/* Today's Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Freelancers Today */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Freelancers Hoje
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todayFreelancerTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayFreelancers.length} profissional(is) escalado(s)
            </p>
          </CardContent>
        </Card>

        {/* Operational Expenses Today */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Pequenas Despesas
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todayExpenseTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayExpenses.length} lançamento(s) hoje
            </p>
          </CardContent>
        </Card>

        {/* Total Today */}
        <Card className="rounded-2xl shadow-card bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Total do Dia
            </CardTitle>
            {todayTotal > avgDailyBudget ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(todayTotal)}</div>
            <p className="text-xs text-muted-foreground">
              Meta diária: {formatCurrency(avgDailyBudget)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Budget Consumption Bar */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base uppercase">
            <span>Consumo do Budget Diário</span>
            <Badge
              variant={
                dailyConsumptionPercentage < 70
                  ? "secondary"
                  : dailyConsumptionPercentage < 90
                  ? "outline"
                  : "destructive"
              }
            >
              {dailyConsumptionPercentage.toFixed(0)}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(
                dailyConsumptionPercentage
              )}`}
              style={{ width: `${Math.min(dailyConsumptionPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Consumido: {formatCurrency(todayTotal)}</span>
            <span>Disponível: {formatCurrency(Math.max(avgDailyBudget - todayTotal, 0))}</span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <FreelancerForm />
        <OperationalExpenseForm storeId={selectedUnidadeId} />
      </div>

      {/* Today's Activity List */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base uppercase">
            Freelancers Escalados Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayFreelancers.length > 0 ? (
            <div className="space-y-3">
              {todayFreelancers.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{entry.nome_completo}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.funcao} • {entry.loja}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">
                      {formatCurrency(entry.valor)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhum freelancer escalado para hoje
              </p>
              <p className="text-sm text-muted-foreground">
                Use o botão acima para lançar um novo gasto
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
