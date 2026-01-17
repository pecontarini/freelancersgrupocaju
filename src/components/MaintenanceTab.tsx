import { useMemo } from "react";
import { Wrench } from "lucide-react";

import { MaintenanceForm } from "@/components/MaintenanceForm";
import { MaintenanceBudgetDashboard } from "@/components/MaintenanceBudgetDashboard";
import { MaintenanceList } from "@/components/MaintenanceList";
import { MaintenanceExportButton } from "@/components/MaintenanceExportButton";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCurrency } from "@/lib/formatters";
import { Loader2 } from "lucide-react";

interface MaintenanceTabProps {
  selectedUnidadeId: string | null;
}

export function MaintenanceTab({ selectedUnidadeId }: MaintenanceTabProps) {
  const { entries, budgets, isLoading } = useMaintenanceEntries();
  const { isAdmin, unidades, isGerenteUnidade } = useUserProfile();

  // Filter entries based on selected loja and user permissions
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Admin with no filter sees all
      if (isAdmin && !selectedUnidadeId) return true;

      // Admin with filter or gerente
      if (selectedUnidadeId) {
        return entry.loja_id === selectedUnidadeId;
      }

      // Gerente sees only their stores
      if (isGerenteUnidade && unidades.length > 0) {
        const unidadeIds = unidades.map((u) => u.id);
        return unidadeIds.includes(entry.loja_id || "");
      }

      return true;
    });
  }, [entries, selectedUnidadeId, isAdmin, isGerenteUnidade, unidades]);

  // Get current loja name for export and budget
  const currentLojaName = useMemo(() => {
    if (selectedUnidadeId) {
      // First try to find from entries
      const entry = entries.find((e) => e.loja_id === selectedUnidadeId);
      if (entry?.loja) return entry.loja;
      // Then try from user's unidades
      const unidade = unidades.find((u) => u.id === selectedUnidadeId);
      return unidade?.nome;
    }
    return undefined;
  }, [entries, selectedUnidadeId, unidades]);

  // Calculate total for current filtered entries
  const totalValue = filteredEntries.reduce((sum, e) => sum + e.valor, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Dashboard */}
      <MaintenanceBudgetDashboard
        entries={entries}
        budgets={budgets}
        selectedLojaId={selectedUnidadeId}
        selectedLojaName={currentLojaName}
      />

      {/* Form */}
      <MaintenanceForm />

      {/* PDF Export Button */}
      {filteredEntries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <h3 className="font-semibold text-primary flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Ordem de Pagamento - Manutenção
            </h3>
            <p className="text-sm text-muted-foreground">
              {filteredEntries.length} registro(s) • {formatCurrency(totalValue)}
            </p>
          </div>
          <MaintenanceExportButton entries={filteredEntries} lojaNome={currentLojaName} />
        </div>
      )}

      {/* Entries List */}
      <MaintenanceList entries={filteredEntries} />
    </div>
  );
}
