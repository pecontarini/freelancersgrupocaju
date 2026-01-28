import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  User,
  Calendar,
  DollarSign,
  Wrench,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FreelancerForm } from "@/components/FreelancerForm";
import { UnifiedExpenseForm } from "@/components/UnifiedExpenseForm";
import { ExportReportButton } from "@/components/ExportReportButton";
import { FinancialHealthCard } from "@/components/FinancialHealthCard";
import { CostEvolutionChart } from "@/components/CostEvolutionChart";
import { FreelancerFilters, FreelancerFiltersState } from "@/components/FreelancerFilters";
import { FreelancerEntry } from "@/types/freelancer";
import { MaintenanceEntry } from "@/types/maintenance";
import { OperationalExpense } from "@/hooks/useOperationalExpenses";
import { formatCurrency } from "@/lib/formatters";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";
import { MobileFreelancerCard } from "@/components/mobile/MobileFreelancerCard";

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
  const isMobile = useIsMobile();

  const { getBudgetForStoreMonth, getCurrentMonthYear } = useStoreBudgets();
  const { options: lojas } = useConfigLojas();
  const { deleteEntry: deleteFreelancer } = useFreelancerEntries();
  const { deleteEntry: deleteMaintenance } = useMaintenanceEntries();

  // Filter state
  const [filters, setFilters] = useState<FreelancerFiltersState>({
    searchTerm: "",
    lojaId: selectedUnidadeId,
    funcoes: [],
    dateStart: null,
    dateEnd: null,
  });

  // Effective store ID from filters or prop
  const effectiveStoreId = filters.lojaId || selectedUnidadeId;

  const budget = effectiveStoreId
    ? getBudgetForStoreMonth(effectiveStoreId, getCurrentMonthYear())
    : undefined;

  // Helper function to check if date is within range
  const isInDateRange = (dateStr: string) => {
    if (!filters.dateStart && !filters.dateEnd) return true;
    
    const date = parseISO(dateStr);
    const start = filters.dateStart ? startOfDay(filters.dateStart) : new Date(0);
    const end = filters.dateEnd ? endOfDay(filters.dateEnd) : new Date(9999, 11, 31);
    
    return isWithinInterval(date, { start, end });
  };

  // Filter entries by all criteria
  const filteredFreelancers = useMemo(() => {
    return freelancerEntries.filter((entry) => {
      // Store filter
      if (effectiveStoreId && entry.loja_id !== effectiveStoreId) return false;
      
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!entry.nome_completo.toLowerCase().includes(searchLower)) return false;
      }
      
      // Function filter (multi-select)
      if (filters.funcoes.length > 0 && !filters.funcoes.includes(entry.funcao)) return false;
      
      // Date range filter
      if (!isInDateRange(entry.data_pop)) return false;
      
      return true;
    });
  }, [freelancerEntries, effectiveStoreId, filters.searchTerm, filters.funcoes, filters.dateStart, filters.dateEnd]);

  const filteredMaintenance = useMemo(() => {
    return maintenanceEntries.filter((entry) => {
      // Store filter
      if (effectiveStoreId && entry.loja_id !== effectiveStoreId) return false;
      
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!entry.fornecedor.toLowerCase().includes(searchLower)) return false;
      }
      
      // Date range filter
      if (!isInDateRange(entry.data_servico)) return false;
      
      return true;
    });
  }, [maintenanceEntries, effectiveStoreId, filters.searchTerm, filters.dateStart, filters.dateEnd]);

  const filteredExpenses = useMemo(() => {
    return operationalExpenses.filter((expense) => {
      // Store filter
      if (effectiveStoreId && expense.store_id !== effectiveStoreId) return false;
      
      // Date range filter
      if (!isInDateRange(expense.data_despesa)) return false;
      
      return true;
    });
  }, [operationalExpenses, effectiveStoreId, filters.dateStart, filters.dateEnd]);

  // Filter today's entries (from filtered data)
  const todayFreelancers = useMemo(() => {
    return filteredFreelancers.filter((entry) => entry.data_pop === today);
  }, [filteredFreelancers, today]);

  const todayExpenses = useMemo(() => {
    return filteredExpenses.filter((expense) => expense.data_despesa === today);
  }, [filteredExpenses, today]);

  const todayMaintenance = useMemo(() => {
    return filteredMaintenance.filter((entry) => entry.data_servico === today);
  }, [filteredMaintenance, today]);

  // Calculate today's totals (from filtered data)
  const todayFreelancerTotal = todayFreelancers.reduce((sum, e) => sum + e.valor, 0);
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.valor, 0);
  const todayMaintenanceTotal = todayMaintenance.reduce((sum, e) => sum + e.valor, 0);
  const todayTotal = todayFreelancerTotal + todayExpenseTotal + todayMaintenanceTotal;

  // Calculate filtered totals for cards
  const filteredFreelancerTotal = filteredFreelancers.reduce((sum, e) => sum + e.valor, 0);
  const filteredMaintenanceTotal = filteredMaintenance.reduce((sum, e) => sum + e.valor, 0);
  const filteredExpenseTotal = filteredExpenses.reduce((sum, e) => sum + e.valor, 0);
  const filteredTotal = filteredFreelancerTotal + filteredMaintenanceTotal + filteredExpenseTotal;

  // Calculate month totals (using filtered data within current month)
  const monthFreelancerTotal = filteredFreelancers
    .filter((e) => e.data_pop.startsWith(currentMonth))
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

  // Recent maintenance entries (last 10 from filtered)
  const recentMaintenance = useMemo(() => {
    return filteredMaintenance.slice(0, 10);
  }, [filteredMaintenance]);

  // Get PDF title and date range
  const selectedLojaName = effectiveStoreId
    ? lojas.find((l) => l.id === effectiveStoreId)?.nome || "TODAS"
    : "TODAS";

  const pdfDateRange = {
    start: filters.dateStart ? format(filters.dateStart, "yyyy-MM-dd") : null,
    end: filters.dateEnd ? format(filters.dateEnd, "yyyy-MM-dd") : null,
  };

  // Check if filters are active
  const hasActiveFilters = !!(
    filters.searchTerm ||
    filters.lojaId ||
    filters.funcoes.length > 0 ||
    filters.dateStart ||
    filters.dateEnd
  );

  return (
    <div className="space-y-6 fade-in">
      {/* Date Header */}
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
        
        {/* PDF Export Button - Uses filtered data */}
        <ExportReportButton 
          entries={filteredFreelancers} 
          variant="dropdown"
          customTitle={selectedLojaName}
          dateRange={pdfDateRange}
        />
      </div>

      {/* Filter Bar */}
      <FreelancerFilters
        filters={filters}
        onFiltersChange={setFilters}
        selectedUnidadeId={selectedUnidadeId}
      />

      {/* Summary Cards - Reflect filtered data */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Freelancers - Filtered Total */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              {hasActiveFilters ? "Freelancers (Filtrados)" : "Freelancers Hoje"}
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(hasActiveFilters ? filteredFreelancerTotal : todayFreelancerTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters 
                ? `${filteredFreelancers.length} lançamento(s)` 
                : `${todayFreelancers.length} escalado(s) hoje`}
            </p>
          </CardContent>
        </Card>

        {/* Operational Expenses */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              {hasActiveFilters ? "Operacional (Filtrado)" : "Operacional Hoje"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(hasActiveFilters ? filteredExpenseTotal : todayExpenseTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters 
                ? `${filteredExpenses.length} despesa(s)` 
                : `${todayExpenses.length} despesa(s) hoje`}
            </p>
          </CardContent>
        </Card>

        {/* Maintenance */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              {hasActiveFilters ? "Manutenção (Filtrada)" : "Manutenção Hoje"}
            </CardTitle>
            <Wrench className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(hasActiveFilters ? filteredMaintenanceTotal : todayMaintenanceTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters 
                ? `${filteredMaintenance.length} serviço(s)` 
                : `${todayMaintenance.length} serviço(s) hoje`}
            </p>
          </CardContent>
        </Card>

        {/* Total */}
        <Card className="rounded-2xl shadow-card bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              {hasActiveFilters ? "Total Filtrado" : "Total do Dia"}
            </CardTitle>
            {(hasActiveFilters ? filteredTotal : todayTotal) > avgDailyBudget ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(hasActiveFilters ? filteredTotal : todayTotal)}
            </div>
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
        <UnifiedExpenseForm storeId={effectiveStoreId} />
      </div>

      {/* Financial Health Card + Cost Evolution Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialHealthCard
          freelancerEntries={filteredFreelancers}
          maintenanceEntries={filteredMaintenance}
          selectedUnidadeId={effectiveStoreId}
        />
        <CostEvolutionChart
          freelancerEntries={filteredFreelancers}
          maintenanceEntries={filteredMaintenance}
          operationalExpenses={filteredExpenses}
          selectedUnidadeId={effectiveStoreId}
        />
      </div>

      {/* Freelancers List - Shows filtered data */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base uppercase">
            {hasActiveFilters 
              ? `Freelancers Filtrados (${filteredFreelancers.length})` 
              : "Freelancers Escalados Hoje"}
          </CardTitle>
          {filteredFreelancers.length > 0 && (
            <ExportReportButton 
              entries={filteredFreelancers} 
              variant="button"
              customTitle={selectedLojaName}
              dateRange={pdfDateRange}
            />
          )}
        </CardHeader>
        <CardContent>
          {filteredFreelancers.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {filteredFreelancers.slice(0, 20).map((entry) => {
                // Mobile: use card component
                if (isMobile) {
                  return (
                    <MobileFreelancerCard
                      key={entry.id}
                      entry={entry}
                      onDelete={(id) => deleteFreelancer.mutate(id)}
                    />
                  );
                }

                // Desktop: inline row
                const [year, month, day] = entry.data_pop.split("-");
                return (
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
                          {entry.funcao} • {entry.loja} • {`${day}/${month}/${year}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-primary">
                        {formatCurrency(entry.valor)}
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deseja excluir este lançamento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação é permanente e removerá o gasto de{" "}
                              <strong>{entry.nome_completo}</strong> do cálculo de budget da unidade.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteFreelancer.mutate(entry.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
              {filteredFreelancers.length > 20 && (
                <p className="text-center text-sm text-muted-foreground pt-2">
                  Mostrando 20 de {filteredFreelancers.length} registros
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {hasActiveFilters 
                  ? "Nenhum freelancer encontrado com os filtros aplicados"
                  : "Nenhum freelancer escalado para hoje"}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters 
                  ? "Tente ajustar os filtros de busca"
                  : "Use o botão acima para lançar um novo gasto"}
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
            {hasActiveFilters 
              ? `Manutenções Filtradas (${filteredMaintenance.length})`
              : "Histórico de Manutenções (Mês Atual)"}
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
                    <div className="flex items-center gap-3">
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Deseja excluir este lançamento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação é permanente e removerá o registro de manutenção de{" "}
                              <strong>{entry.fornecedor}</strong> do cálculo de budget da unidade.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMaintenance(entry.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wrench className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {hasActiveFilters 
                  ? "Nenhuma manutenção encontrada com os filtros aplicados"
                  : "Nenhuma manutenção registrada este mês"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
