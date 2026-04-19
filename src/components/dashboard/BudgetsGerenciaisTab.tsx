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
  FileText,
  AlertCircle,
} from "lucide-react";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
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
import { MaintenanceSingleExportButton } from "@/components/MaintenanceSingleExportButton";
import { MaintenanceReportModal } from "@/components/maintenance/MaintenanceReportModal";
import { InlineBudgetEditor } from "@/components/InlineBudgetEditor";
import { EditFreelancerDialog } from "@/components/EditFreelancerDialog";
import { EditMaintenanceDialog } from "@/components/EditMaintenanceDialog";
import { useCheckinBudgetEntries, CheckinBudgetEntry } from "@/hooks/useCheckinBudgetEntries";

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
  const [maintenanceReportOpen, setMaintenanceReportOpen] = useState(false);

  // Effective store ID from filters or prop
  const effectiveStoreId = filters.lojaId || selectedUnidadeId;

  // Checkin budget entries (presence-based freelancer costs)
  const effectiveMonthYearForCheckin = useMemo(() => {
    if (filters.dateStart) return format(filters.dateStart, "yyyy-MM");
    return getCurrentMonthYear();
  }, [filters.dateStart, getCurrentMonthYear]);

  const { entries: checkinBudgetEntries, total: checkinBudgetTotal } = useCheckinBudgetEntries(
    effectiveStoreId,
    effectiveMonthYearForCheckin
  );

  // Derive month_year from the effective date range filter
  const effectiveMonthYear = useMemo(() => {
    if (filters.dateStart) {
      return format(filters.dateStart, "yyyy-MM");
    }
    return getCurrentMonthYear();
  }, [filters.dateStart, getCurrentMonthYear]);

  const budget = effectiveStoreId
    ? getBudgetForStoreMonth(effectiveStoreId, effectiveMonthYear)
    : undefined;

  // Calculate effective date range: use filter dates or default to current month
  const effectiveDateRange = useMemo(() => {
    const now = new Date();
    const hasDateFilter = filters.dateStart || filters.dateEnd;
    
    if (hasDateFilter) {
      return {
        start: filters.dateStart ? startOfDay(filters.dateStart) : new Date(0),
        end: filters.dateEnd ? endOfDay(filters.dateEnd) : endOfDay(now),
        isCustomRange: true,
        label: "",
      };
    }
    
    // Default: current month (day 1 to END OF MONTH to ensure all entries are visible)
    return {
      start: startOfMonth(now),
      end: endOfMonth(now),
      isCustomRange: false,
      label: format(now, "MMMM/yyyy", { locale: ptBR }),
    };
  }, [filters.dateStart, filters.dateEnd]);

  // Generate the period display label
  const periodDisplayLabel = useMemo(() => {
    if (effectiveDateRange.isCustomRange) {
      const startStr = filters.dateStart 
        ? format(filters.dateStart, "dd/MM/yyyy", { locale: ptBR }) 
        : "...";
      const endStr = filters.dateEnd 
        ? format(filters.dateEnd, "dd/MM/yyyy", { locale: ptBR }) 
        : "...";
      return `${startStr} a ${endStr}`;
    }
    return `Acumulado - ${effectiveDateRange.label.charAt(0).toUpperCase() + effectiveDateRange.label.slice(1)}`;
  }, [effectiveDateRange, filters.dateStart, filters.dateEnd]);

  // Filter entries by all criteria - inline date check to avoid stale closures
  const filteredFreelancers = useMemo(() => {
    const { start, end } = effectiveDateRange;
    return freelancerEntries.filter((entry) => {
      if (effectiveStoreId && entry.loja_id !== effectiveStoreId) return false;
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!entry.nome_completo.toLowerCase().includes(searchLower)) return false;
      }
      if (filters.funcoes.length > 0 && !filters.funcoes.includes(entry.funcao)) return false;
      const date = parseISO(entry.data_pop);
      if (!isWithinInterval(date, { start, end })) return false;
      return true;
    });
  }, [freelancerEntries, effectiveStoreId, filters.searchTerm, filters.funcoes, effectiveDateRange]);

  const filteredMaintenance = useMemo(() => {
    const { start, end } = effectiveDateRange;
    return maintenanceEntries.filter((entry) => {
      if (effectiveStoreId && entry.loja_id !== effectiveStoreId) return false;
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (!entry.fornecedor.toLowerCase().includes(searchLower)) return false;
      }
      const date = parseISO(entry.data_servico);
      if (!isWithinInterval(date, { start, end })) return false;
      return true;
    });
  }, [maintenanceEntries, effectiveStoreId, filters.searchTerm, effectiveDateRange]);

  const filteredExpenses = useMemo(() => {
    const { start, end } = effectiveDateRange;
    return operationalExpenses.filter((expense) => {
      if (effectiveStoreId && expense.store_id !== effectiveStoreId) return false;
      const date = parseISO(expense.data_despesa);
      if (!isWithinInterval(date, { start, end })) return false;
      return true;
    });
  }, [operationalExpenses, effectiveStoreId, effectiveDateRange]);

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
  const filteredTotal = filteredFreelancerTotal + filteredMaintenanceTotal + filteredExpenseTotal + checkinBudgetTotal;

  // Calculate month totals (using the effective month from filter)
  const monthFreelancerTotal = filteredFreelancers
    .filter((e) => e.data_pop.startsWith(effectiveMonthYear))
    .reduce((sum, e) => sum + e.valor, 0);

  const monthMaintenanceTotal = filteredMaintenance
    .filter((e) => e.data_servico.startsWith(effectiveMonthYear))
    .reduce((sum, e) => sum + e.valor, 0);

  // Budget calculations
  const totalMonthlyBudget = budget
    ? budget.freelancer_budget +
      budget.maintenance_budget +
      budget.uniforms_budget +
      budget.cleaning_budget +
      budget.utensils_budget +
      (budget.apoio_venda_budget || 0)
    : 0;

  const maintenanceBudget = budget?.maintenance_budget || 0;
  const maintenancePercentage = maintenanceBudget
    ? Math.min((monthMaintenanceTotal / maintenanceBudget) * 100, 100)
    : 0;

  const daysInMonth = useMemo(() => {
    const [year, month] = effectiveMonthYear.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  }, [effectiveMonthYear]);
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

  // Check if filters are active (excluding date as it has smart default)
  const hasSearchOrFunctionFilters = !!(
    filters.searchTerm ||
    filters.lojaId ||
    filters.funcoes.length > 0
  );
  
  const hasDateFilter = !!(filters.dateStart || filters.dateEnd);
  
  // Combined flag for backwards compatibility with existing UI logic
  const hasActiveFilters = hasSearchOrFunctionFilters || hasDateFilter;

  // Check if there are no results in current filter but entries exist overall
  const hasEntriesOutsideFilter = useMemo(() => {
    const noFilteredResults = filteredFreelancers.length === 0 && 
                              filteredMaintenance.length === 0 && 
                              filteredExpenses.length === 0;
    const hasAnyEntries = freelancerEntries.length > 0 || 
                          maintenanceEntries.length > 0 || 
                          operationalExpenses.length > 0;
    return noFilteredResults && hasAnyEntries && !hasDateFilter;
  }, [filteredFreelancers, filteredMaintenance, filteredExpenses, 
      freelancerEntries, maintenanceEntries, operationalExpenses, hasDateFilter]);

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

      {/* Alert when no entries in current month but entries exist in other periods */}
      {hasEntriesOutsideFilter && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Nenhum lançamento no mês atual
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Existem registros em outros períodos. Use o filtro de datas para visualizar lançamentos de outros meses ou verifique a data ao fazer novos lançamentos.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards - Show accumulated values by default (current month) */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Freelancers - Accumulated Total */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              {hasSearchOrFunctionFilters ? "Freelancers (Filtrados)" : periodDisplayLabel.includes("Acumulado") ? "Freelancers" : "Freelancers (Período)"}
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredFreelancerTotal + checkinBudgetTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredFreelancers.length} lançamento(s) manual(is)
              {checkinBudgetEntries.length > 0 && ` + ${checkinBudgetEntries.length} via check-in`}
            </p>
          </CardContent>
        </Card>

        {/* Operational Expenses */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              {hasSearchOrFunctionFilters ? "Operacional (Filtrado)" : periodDisplayLabel.includes("Acumulado") ? "Operacional" : "Operacional (Período)"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredExpenseTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredExpenses.length} despesa(s)
            </p>
          </CardContent>
        </Card>

        {/* Maintenance */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              {hasSearchOrFunctionFilters ? "Manutenção (Filtrada)" : periodDisplayLabel.includes("Acumulado") ? "Manutenção" : "Manutenção (Período)"}
            </CardTitle>
            <Wrench className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredMaintenanceTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredMaintenance.length} serviço(s)
            </p>
          </CardContent>
        </Card>

        {/* Total */}
        <Card className="rounded-2xl shadow-card bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              {hasSearchOrFunctionFilters ? "Total Filtrado" : periodDisplayLabel.includes("Acumulado") ? "Total Acumulado" : "Total (Período)"}
            </CardTitle>
            {filteredTotal > avgDailyBudget * (effectiveDateRange.isCustomRange ? 1 : new Date().getDate()) ? (
              <TrendingUp className="h-4 w-4 text-destructive" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredTotal)}
            </div>
            <p className="text-xs text-muted-foreground">
              Meta diária: {formatCurrency(avgDailyBudget)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period Information Banner */}
      <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>
          <strong className="text-foreground">{periodDisplayLabel}</strong>
          {!effectiveDateRange.isCustomRange && (
            <span className="ml-1">
              (Dia 01 a {format(new Date(), "dd/MM/yyyy", { locale: ptBR })})
            </span>
          )}
        </span>
      </div>

      {/* Daily Budget Consumption Bar */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base uppercase">
            <span>Consumo do Budget Diário</span>
            <InlineBudgetEditor preselectedStoreId={effectiveStoreId} />
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
          operationalExpenses={filteredExpenses}
          selectedUnidadeId={effectiveStoreId}
        />
        <CostEvolutionChart
          freelancerEntries={filteredFreelancers}
          maintenanceEntries={filteredMaintenance}
          operationalExpenses={filteredExpenses}
          selectedUnidadeId={effectiveStoreId}
        />
      </div>

      {/* Freelancers List - Shows filtered data + checkin entries */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base uppercase">
            {hasActiveFilters 
              ? `Freelancers (${filteredFreelancers.length + checkinBudgetEntries.length})` 
              : "Freelancers Escalados"}
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
          {(filteredFreelancers.length > 0 || checkinBudgetEntries.length > 0) ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {/* Checkin budget entries */}
              {checkinBudgetEntries.map((entry) => {
                const [year, month, day] = entry.data_servico.split("-");
                if (isMobile) {
                  return (
                    <div key={`checkin-${entry.id}`} className="rounded-xl bg-muted/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{entry.freelancer_name}</p>
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800 text-[10px] px-1.5">
                            Via Check-in
                          </Badge>
                        </div>
                        <p className="font-semibold text-primary">{formatCurrency(entry.valor)}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Freelancer • {`${day}/${month}/${year}`}
                      </p>
                    </div>
                  );
                }
                return (
                  <div
                    key={`checkin-${entry.id}`}
                    className="flex items-center justify-between rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{entry.freelancer_name}</p>
                          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800 text-[10px] px-1.5">
                            Via Check-in
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Freelancer • CPF: {entry.cpf} • {`${day}/${month}/${year}`}
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-primary">
                      {formatCurrency(entry.valor)}
                    </p>
                  </div>
                );
              })}

              {/* Freelancer entries (manual + provisórios da escala) */}
              {filteredFreelancers.slice(0, 20).map((entry) => {
                const isFromSchedule = entry.origem === 'escala';
                if (isMobile) {
                  return (
                    <MobileFreelancerCard
                      key={entry.id}
                      entry={entry}
                      onDelete={(id) => deleteFreelancer.mutate(id)}
                    />
                  );
                }
                const [year, month, day] = entry.data_pop.split("-");
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isFromSchedule ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{entry.nome_completo}</p>
                          {isFromSchedule && (
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800 text-[10px] px-1.5">
                              Previsto (Escala)
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.funcao} • {entry.loja} • {`${day}/${month}/${year}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isFromSchedule && <EditFreelancerDialog entry={entry} />}
                      <p className="font-semibold text-primary">
                        {formatCurrency(entry.valor)}
                      </p>
                      {isFromSchedule ? (
                        <span
                          className="text-[10px] text-muted-foreground italic max-w-[140px] text-right leading-tight"
                          title="Este lançamento é gerado automaticamente pela escala. Para alterar, edite o turno no Editor de Escalas."
                        >
                          Sincronizado da escala
                        </span>
                      ) : (
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
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredFreelancers.length > 20 && (
                <p className="text-center text-sm text-muted-foreground pt-2">
                  Mostrando 20 de {filteredFreelancers.length} registros manuais
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
              <Wrench className="h-5 w-5 text-amber-500" />
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base uppercase">
            {hasActiveFilters 
              ? `Manutenções Filtradas (${filteredMaintenance.length})`
              : "Histórico de Manutenções (Mês Atual)"}
          </CardTitle>
          {filteredMaintenance.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setMaintenanceReportOpen(true)}
            >
              <FileText className="h-4 w-4" />
              Ver Relatório Completo
            </Button>
          )}
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{entry.fornecedor}</p>
                        <p className="text-sm text-muted-foreground">
                          NF: {entry.numero_nf} • {`${day}/${month}/${year}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
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
                      <p className="font-semibold text-amber-600">
                        {formatCurrency(entry.valor)}
                      </p>
                      <EditMaintenanceDialog entry={entry} />
                      <MaintenanceSingleExportButton entry={entry} />
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
              {filteredMaintenance.length > 10 && (
                <div className="pt-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={() => setMaintenanceReportOpen(true)}
                  >
                    Ver todos os {filteredMaintenance.length} registros →
                  </Button>
                </div>
              )}
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

      {/* Maintenance Report Modal */}
      <MaintenanceReportModal
        open={maintenanceReportOpen}
        onOpenChange={setMaintenanceReportOpen}
        entries={filteredMaintenance}
        periodLabel={periodDisplayLabel}
      />
    </div>
  );
}
