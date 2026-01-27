import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ActionPlanFilters } from "./ActionPlanFilters";
import { ActionPlanList } from "./ActionPlanList";
import { UnitExecutiveSummary } from "./UnitExecutiveSummary";

export function ActionPlanDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, unidades, isGerenteUnidade } = useUserProfile();

  // Initialize filters from URL params
  const initialLojaId = searchParams.get("loja") || null;
  const initialStatus = (searchParams.get("status") as "all" | "pending" | "resolved") || "all";

  const [selectedLojaId, setSelectedLojaId] = useState<string | null>(initialLojaId);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">(initialStatus);

  // For gerente with single store, lock to their store
  useEffect(() => {
    if (isGerenteUnidade && unidades.length === 1 && !selectedLojaId) {
      setSelectedLojaId(unidades[0].id);
    }
  }, [isGerenteUnidade, unidades, selectedLojaId]);

  // Sync filters to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedLojaId) {
      params.set("loja", selectedLojaId);
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    setSearchParams(params, { replace: true });
  }, [selectedLojaId, statusFilter, setSearchParams]);

  const {
    pendingFailures,
    awaitingValidation,
    isLoadingFailures,
    resolveFailure,
    validateFailure,
    isRecurring,
  } = useSupervisionAudits(selectedLojaId);

  const allFailures = [...pendingFailures, ...awaitingValidation];

  // Apply status filter
  const filteredFailures = allFailures.filter((f) => {
    if (statusFilter === "pending") return f.status === "pending";
    if (statusFilter === "resolved") return f.status === "resolved";
    return true;
  });

  const handleLojaChange = (lojaId: string | null) => {
    // Managers can only see their assigned stores
    if (isGerenteUnidade && lojaId !== null) {
      const hasAccess = unidades.some((u) => u.id === lojaId);
      if (!hasAccess) return;
    }
    setSelectedLojaId(lojaId);
  };

  const handleClearFilters = () => {
    setSelectedLojaId(null);
    setStatusFilter("all");
  };

  if (isLoadingFailures) {
    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Executive Summary - only shown when a specific unit is selected */}
      {selectedLojaId && (
        <UnitExecutiveSummary lojaId={selectedLojaId} />
      )}

      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base uppercase">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Plano de Ação e Auditoria
                </CardTitle>
                <CardDescription>
                  Gerencie as pendências de supervisão e acompanhe correções.
                </CardDescription>
              </div>
            </div>

            {/* Filters */}
            <ActionPlanFilters
              selectedLojaId={selectedLojaId}
              onLojaChange={handleLojaChange}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              onClearFilters={handleClearFilters}
            />
          </div>
        </CardHeader>

        <CardContent>
          <ActionPlanList
            failures={filteredFailures}
            isAdmin={isAdmin}
            isRecurring={isRecurring}
            onResolve={resolveFailure}
            onValidate={validateFailure}
          />

          {/* Summary */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                <span>{pendingFailures.length} Pendentes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>{awaitingValidation.length} Aguardando Validação</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
