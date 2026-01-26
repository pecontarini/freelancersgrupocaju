import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  User,
  Calendar,
  DollarSign,
  Wrench,
  FileText,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FreelancerForm } from "@/components/FreelancerForm";
import { UnifiedExpenseForm } from "@/components/UnifiedExpenseForm";
import { ExportReportButton } from "@/components/ExportReportButton";
import { FinancialHealthCard } from "@/components/FinancialHealthCard";
import { CostEvolutionChart } from "@/components/CostEvolutionChart";
import { FreelancerEntry } from "@/types/freelancer";
import { MaintenanceEntry } from "@/types/maintenance";
import { OperationalExpense } from "@/hooks/useOperationalExpenses";
import { formatCurrency } from "@/lib/formatters";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";

interface BudgetsGerenciaisTabProps {
  freelancerEntries: FreelancerEntry[];
  operationalExpenses: OperationalExpense[];
  maintenanceEntries: MaintenanceEntry[];
  selectedUnidadeId: string | null;
}

export function BudgetsGerenciaisTab({
  freelancerEntries,
  operationalExpenses,
  maintenanceEntries,
  selectedUnidadeId,
}: BudgetsGerenciaisTabProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentMonth = format(new Date(), "yyyy-MM");

  const { getBudgetForStoreMonth, getCurrentMonthYear } = useStoreBudgets();

  const budget = selectedUnidadeId
    ? getBudgetForStoreMonth(selectedUnidadeId, getCurrentMonthYear())
    : undefined;

  // Filter entries by selected store
  const filteredFreelancers = useMemo(() => {
    if (!selectedUnidadeId) return freelancerEntries;
    return freelancerEntries.filter((e) => e.loja_id === selectedUnidadeId);
  }, [freelancerEntries, selectedUnidadeId]);

  const filteredMaintenance = useMemo(() => {
    if (!selectedUnidadeId) return maintenanceEntries;
    return maintenanceEntries.filter((e) => e.loja_id === selectedUnidadeId);
  }, [maintenanceEntries, selectedUnidadeId]);

  const filteredExpenses = useMemo(() => {
    if (!selectedUnidadeId) return operationalExpenses;
    return operationalExpenses.filter((e) => e.store_id === selectedUnidadeId);
  }, [operationalExpenses, selectedUnidadeId]);

  // Filter today's entries
  const todayFreelancers = useMemo(() => {
    return filteredFreelancers.filter((entry) => entry.data_pop === today);
  }, [filteredFreelancers, today]);

  const todayExpenses = useMemo(() => {
    return filteredExpenses.filter((expense) => expense.data_despesa === today);
  }, [filteredExpenses, today]);

  const todayMaintenance = useMemo(() => {
    return filteredMaintenance.filter((entry) => entry.data_servico === today);
  }, [filteredMaintenance, today]);

  // Calculate today's totals
  const todayFreelancerTotal = todayFreelancers.reduce((sum, e) => sum + e.valor, 0);
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.valor, 0);
  const todayMaintenanceTotal = todayMaintenance.reduce((sum, e) => sum + e.valor, 0);
  const todayTotal = todayFreelancerTotal + todayExpenseTotal + todayMaintenanceTotal;

  // Calculate month totals
  const monthFreelancerTotal = filteredFreelancers
    .filter((e) => e.data_pop.startsWith(currentMonth))
    .reduce((sum, e) => sum + e.valor, 0);

  const monthExpenseTotal = filteredExpenses
    .filter((e) => e.data_despesa.startsWith(currentMonth))
    .reduce((sum, e) => sum + e.valor, 0);

  const monthMaintenanceTotal = filteredMaintenance
    .filter((e) => e.data_servico.startsWith(currentMonth))
    .reduce((sum, e) => sum + e.valor, 0);

  // Budget calculations
  const totalMonthlyBudget = budget
    ? budget.freelancer_budget +
      budget.maintenance_budget +
      budget.uniforms_budget +
      budget.cleaning_budget
    : 0;

  const maintenanceBudget = budget?.maintenance_budget || 0;
  const maintenancePercentage = maintenanceBudget
    ? Math.min((monthMaintenanceTotal / maintenanceBudget) * 100, 100)
    : 0;

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const avgDailyBudget = totalMonthlyBudget / daysInMonth;

  const dailyConsumptionPercentage = avgDailyBudget
    ? Math.min((todayTotal / avgDailyBudget) * 100, 100)
    : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage < 70) return "bg-emerald-500";
    if (percentage < 90) return "bg-amber-500";
    return "bg-red-500";
  };

  // Recent maintenance entries (last 10)
  const recentMaintenance = useMemo(() => {
    return filteredMaintenance
      .filter((e) => e.data_servico.startsWith(currentMonth))
      .slice(0, 10);
  }, [filteredMaintenance, currentMonth]);

  // Filter freelancers for current month (for PDF)
  const monthFreelancers = useMemo(() => {
    return filteredFreelancers.filter((e) => e.data_pop.startsWith(currentMonth));
  }, [filteredFreelancers, currentMonth]);

  return (
    <div className="space-y-6 fade-in">
      {/* Date Header with PDF Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
        
        {/* PDF Export Button for Freelancers */}
        <ExportReportButton entries={monthFreelancers} variant="dropdown" />
      </div>

      {/* Today's Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Freelancers Today */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Freelancers
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todayFreelancerTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayFreelancers.length} escalado(s) hoje
            </p>
          </CardContent>
        </Card>

        {/* Operational Expenses Today */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Operacional
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todayExpenseTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayExpenses.length} despesa(s) hoje
            </p>
          </CardContent>
        </Card>

        {/* Maintenance Today */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Manutenção
            </CardTitle>
            <Wrench className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(todayMaintenanceTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {todayMaintenance.length} serviço(s) hoje
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
        <UnifiedExpenseForm storeId={selectedUnidadeId} />
      </div>

      {/* Financial Health Card + Cost Evolution Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialHealthCard
          freelancerEntries={filteredFreelancers}
          maintenanceEntries={filteredMaintenance}
          selectedUnidadeId={selectedUnidadeId}
        />
        <CostEvolutionChart
          freelancerEntries={filteredFreelancers}
          maintenanceEntries={filteredMaintenance}
          operationalExpenses={filteredExpenses}
          selectedUnidadeId={selectedUnidadeId}
        />
      </div>

      {/* Today's Freelancers List */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base uppercase">
            Freelancers Escalados Hoje
          </CardTitle>
          {todayFreelancers.length > 0 && (
            <ExportReportButton entries={todayFreelancers} variant="button" />
          )}
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

      {/* Maintenance Budget Status */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base uppercase">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-500" />
              <span>Budget de Manutenção (Mês)</span>
            </div>
            <Badge
              variant={
                maintenancePercentage < 70
                  ? "secondary"
                  : maintenancePercentage < 90
                  ? "outline"
                  : "destructive"
              }
            >
              {maintenancePercentage.toFixed(0)}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(
                maintenancePercentage
              )}`}
              style={{ width: `${Math.min(maintenancePercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Consumido: {formatCurrency(monthMaintenanceTotal)}</span>
            <span>
              Disponível: {formatCurrency(Math.max(maintenanceBudget - monthMaintenanceTotal, 0))}
            </span>
          </div>
          {maintenanceBudget === 0 && (
            <p className="text-xs text-amber-600">
              ⚠️ Budget de manutenção não configurado para esta unidade/mês.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Maintenance History */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="text-base uppercase">
            Histórico de Manutenções (Mês Atual)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentMaintenance.length > 0 ? (
            <div className="space-y-3">
              {recentMaintenance.map((entry) => {
                const [year, month, day] = entry.data_servico.split("-");
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-orange-500">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{entry.fornecedor}</p>
                        <p className="text-sm text-muted-foreground">
                          NF: {entry.numero_nf} • {`${day}/${month}/${year}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      {entry.anexo_url && (
                        <a
                          href={entry.anexo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <p className="font-semibold text-orange-600">
                        {formatCurrency(entry.valor)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhuma manutenção registrada este mês
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
