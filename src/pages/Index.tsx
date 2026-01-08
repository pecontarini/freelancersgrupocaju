import { useState, useMemo } from "react";
import { ClipboardList, LayoutDashboard, Loader2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AppHeader } from "@/components/AppHeader";
import { FreelancerForm } from "@/components/FreelancerForm";
import { FilterBar } from "@/components/FilterBar";
import { SummaryCard } from "@/components/SummaryCard";
import { EntriesTable } from "@/components/EntriesTable";
import { PaymentRequestGenerator } from "@/components/PaymentRequestGenerator";

import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { FilterState } from "@/types/freelancer";

const Index = () => {
  const {
    entries,
    isLoading,
    uniqueSetores,
    uniqueGerencias,
    uniqueLojas,
  } = useFreelancerEntries();

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: undefined,
    dateTo: undefined,
    setor: "",
    gerencia: "",
    nome: "",
    loja: "",
  });

  // Filter entries based on current filter state
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Date range filter
      if (filters.dateFrom) {
        const entryDate = new Date(entry.data_pop);
        if (entryDate < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        const entryDate = new Date(entry.data_pop);
        if (entryDate > filters.dateTo) return false;
      }

      // Setor filter
      if (filters.setor && filters.setor !== "all" && entry.setor !== filters.setor) {
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
  }, [entries, filters]);

  // Calculate summary stats
  const totalValue = filteredEntries.reduce((sum, e) => sum + e.valor, 0);
  const uniqueFreelancers = new Set(filteredEntries.map((e) => e.cpf)).size;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container py-6">
        <Tabs defaultValue="lancamentos" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="lancamentos" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="gestao" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Gestão
            </TabsTrigger>
          </TabsList>

          {/* Lançamentos Tab */}
          <TabsContent value="lancamentos" className="space-y-6">
            <FreelancerForm />
            
            <div className="rounded-xl bg-muted/50 p-4">
              <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                Últimos Lançamentos
              </h3>
              <EntriesTable entries={entries.slice(0, 10)} />
            </div>
          </TabsContent>

          {/* Gestão Tab */}
          <TabsContent value="gestao" className="space-y-6">
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
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              uniqueSetores={uniqueSetores}
              uniqueGerencias={uniqueGerencias}
              uniqueLojas={uniqueLojas}
            />

            {/* Data Table */}
            <EntriesTable entries={filteredEntries} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
