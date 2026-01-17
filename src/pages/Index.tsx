import { useState, useMemo } from "react";
import { ClipboardList, LayoutDashboard, Loader2, BarChart3, Settings, Users, Building2, Wrench } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AppHeader } from "@/components/AppHeader";
import { FreelancerForm } from "@/components/FreelancerForm";
import { FilterBar } from "@/components/FilterBar";
import { SummaryCard } from "@/components/SummaryCard";
import { EntriesTable } from "@/components/EntriesTable";
import { PaymentRequestGenerator } from "@/components/PaymentRequestGenerator";
import { FinancialCharts } from "@/components/FinancialCharts";
import { ImportSpreadsheetModal } from "@/components/ImportSpreadsheetModal";
import { ExportReportButton } from "@/components/ExportReportButton";
import { ConfigurationsTab } from "@/components/ConfigurationsTab";
import { UnidadeSelector } from "@/components/UnidadeSelector";
import { NetworkSummary } from "@/components/NetworkSummary";
import { UserManagement } from "@/components/UserManagement";
import { MaintenanceTab } from "@/components/MaintenanceTab";

import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { useUserProfile } from "@/hooks/useUserProfile";
import { FilterState } from "@/types/freelancer";
import { parseDateString, formatCurrency } from "@/lib/formatters";

const Index = () => {
  const {
    entries,
    isLoading,
    uniqueFuncoes,
    uniqueGerencias,
    uniqueLojas,
  } = useFreelancerEntries();

  const { isAdmin, isGerenteUnidade, unidades, isLoading: isLoadingProfile, hasNoRole } = useUserProfile();
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: undefined,
    dateTo: undefined,
    funcao: "",
    gerencia: "",
    nome: "",
    loja: "",
  });

  // Filter entries based on current filter state and unidade
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Unidade filter (multi-tenant)
      if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
        // If gerente has selected a specific unidade, filter by that
        if (selectedUnidadeId) {
          if (entry.loja_id !== selectedUnidadeId) return false;
        } else {
          // Otherwise show all entries for their unidades
          const unidadeIds = unidades.map(u => u.id);
          if (!unidadeIds.includes(entry.loja_id || "")) return false;
        }
      } else if (isAdmin && selectedUnidadeId) {
        if (entry.loja_id !== selectedUnidadeId) return false;
      }

      // Date range filter
      if (filters.dateFrom) {
        const entryDate = parseDateString(entry.data_pop);
        if (entryDate < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        const entryDate = parseDateString(entry.data_pop);
        if (entryDate > filters.dateTo) return false;
      }

      // Funcao filter
      if (filters.funcao && filters.funcao !== "all" && entry.funcao !== filters.funcao) {
        return false;
      }

      // Gerência filter
      if (filters.gerencia && filters.gerencia !== "all" && entry.gerencia !== filters.gerencia) {
        return false;
      }

      // Loja filter
      if (filters.loja && filters.loja !== "all" && entry.loja !== filters.loja) {
        return false;
      }

      // Nome filter (case-insensitive partial match)
      if (filters.nome) {
        const searchTerm = filters.nome.toLowerCase();
        if (!entry.nome_completo.toLowerCase().includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });
  }, [entries, filters, isAdmin, isGerenteUnidade, unidades, selectedUnidadeId]);

  // Calculate summary stats
  const totalValue = filteredEntries.reduce((sum, e) => sum + e.valor, 0);
  const uniqueFreelancers = new Set(filteredEntries.map((e) => e.cpf)).size;

  if (isLoading || isLoadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show message if user has no role assigned
  if (hasNoRole) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container py-6">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Aguardando Permissão</h2>
            <p className="text-muted-foreground max-w-md">
              Sua conta foi criada, mas você ainda não tem permissão de acesso.
              Entre em contato com o administrador para receber acesso ao sistema.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Show unidade selector for gerente with multiple stores or admin
  const showUnidadeSelector = isAdmin || (isGerenteUnidade && unidades.length > 1);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container py-6">
        {/* Global Unidade Selector */}
        {showUnidadeSelector && (
          <div className="mb-6">
            <UnidadeSelector
              selectedUnidadeId={selectedUnidadeId}
              onUnidadeChange={setSelectedUnidadeId}
            />
          </div>
        )}

        {/* Single store indicator for gerente */}
        {isGerenteUnidade && !isAdmin && unidades.length === 1 && (
          <div className="mb-6">
            <UnidadeSelector
              selectedUnidadeId={null}
              onUnidadeChange={() => {}}
            />
          </div>
        )}

        <Tabs defaultValue={isAdmin ? "rede" : "lancamentos"} className="space-y-6">
          <TabsList className={`grid w-full max-w-4xl ${isAdmin ? "grid-cols-6" : "grid-cols-5"}`}>
            {isAdmin && (
              <TabsTrigger value="rede" className="gap-2">
                <Building2 className="h-4 w-4" />
                Rede
              </TabsTrigger>
            )}
            <TabsTrigger value="lancamentos" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="gestao" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Gestão
            </TabsTrigger>
            <TabsTrigger value="manutencao" className="gap-2">
              <Wrench className="h-4 w-4" />
              Manutenção
            </TabsTrigger>
            <TabsTrigger value="analises" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Análises
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="configuracoes" className="gap-2">
                <Settings className="h-4 w-4" />
                Configurações
              </TabsTrigger>
            )}
          </TabsList>

          {/* Rede Tab - Admin Only */}
          {isAdmin && (
            <TabsContent value="rede" className="space-y-6">
              <NetworkSummary entries={entries} />
            </TabsContent>
          )}

          {/* Lançamentos Tab */}
          <TabsContent value="lancamentos" className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <FreelancerForm />
              <div className="flex justify-end sm:pt-0">
                <ImportSpreadsheetModal />
              </div>
            </div>
            
            <div className="rounded-xl bg-muted/50 p-4">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Últimos Lançamentos
              </h3>
              <EntriesTable entries={entries.slice(0, 10)} />
            </div>
          </TabsContent>

          {/* Gestão Tab */}
          <TabsContent value="gestao" className="space-y-6">
            {/* PDF Button - Prominent placement */}
            {filteredEntries.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div>
                  <h3 className="font-semibold text-primary">Ordem de Pagamento</h3>
                  <p className="text-sm text-muted-foreground">
                    {filteredEntries.length} lançamento(s) • {formatCurrency(totalValue)}
                  </p>
                </div>
                <ExportReportButton entries={filteredEntries} variant="button" />
              </div>
            )}

            {/* Summary Card */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SummaryCard
                  totalValue={totalValue}
                  totalEntries={filteredEntries.length}
                  uniqueFreelancers={uniqueFreelancers}
                />
              </div>
              <div className="flex items-center justify-center lg:justify-end">
                <PaymentRequestGenerator entries={filteredEntries} />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex-1">
                <FilterBar
                  filters={filters}
                  onFiltersChange={setFilters}
                  uniqueFuncoes={uniqueFuncoes}
                  uniqueGerencias={uniqueGerencias}
                  uniqueLojas={uniqueLojas}
                />
              </div>
              <div className="flex justify-end">
                <ExportReportButton entries={filteredEntries} />
              </div>
            </div>

            {/* Data Table */}
            <EntriesTable entries={filteredEntries} />
          </TabsContent>

          {/* Manutenção Tab */}
          <TabsContent value="manutencao" className="space-y-6">
            <MaintenanceTab selectedUnidadeId={selectedUnidadeId} />
          </TabsContent>

          {/* Análises Tab */}
          <TabsContent value="analises" className="space-y-6">
            {/* Filters */}
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              uniqueFuncoes={uniqueFuncoes}
              uniqueGerencias={uniqueGerencias}
              uniqueLojas={uniqueLojas}
            />

            {/* Summary */}
            <SummaryCard
              totalValue={totalValue}
              totalEntries={filteredEntries.length}
              uniqueFreelancers={uniqueFreelancers}
            />

            {/* Charts */}
            <FinancialCharts entries={filteredEntries} />
          </TabsContent>

          {/* Configurações Tab - Admin Only */}
          {isAdmin && (
            <TabsContent value="configuracoes" className="space-y-6">
              <ConfigurationsTab />
              <UserManagement />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
