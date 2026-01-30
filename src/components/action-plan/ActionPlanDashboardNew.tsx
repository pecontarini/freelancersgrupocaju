import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FileCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSupervisionAudits, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { useUserProfile } from "@/hooks/useUserProfile";
import { ActionPlanFilters } from "./ActionPlanFilters";
import { ActionPlanList, RecurrenceInfo } from "./ActionPlanList";
import { UnitExecutiveSummary } from "./UnitExecutiveSummary";
import { subDays } from "date-fns";

export function ActionPlanDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, unidades, isGerenteUnidade } = useUserProfile();

  // Initialize filters from URL params
  const initialLojaId = searchParams.get("loja") || null;
  const initialStatus = (searchParams.get("status") as "all" | "pending" | "resolved") || "all";
  const initialRecurring = searchParams.get("recurring") === "true";
  const initialTag = searchParams.get("tag") || null;

  const [selectedLojaId, setSelectedLojaId] = useState<string | null>(initialLojaId);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">(initialStatus);
  const [showOnlyRecurring, setShowOnlyRecurring] = useState(initialRecurring);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);

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
    if (showOnlyRecurring) {
      params.set("recurring", "true");
    }
    if (selectedTag) {
      params.set("tag", selectedTag);
    }
    setSearchParams(params, { replace: true });
  }, [selectedLojaId, statusFilter, showOnlyRecurring, selectedTag, setSearchParams]);

  const {
    failures,
    pendingFailures,
    awaitingValidation,
    isLoadingFailures,
    resolveFailure,
    validateFailure,
  } = useSupervisionAudits(selectedLojaId);

  // Calculate recurrence info with 30-day window
  const recurrenceMap = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    const recentFailures = failures.filter(
      (f) => new Date(f.created_at) >= thirtyDaysAgo
    );

    const map: Record<string, SupervisionFailure[]> = {};
    
    recentFailures.forEach((failure) => {
      // Key by loja + item_name OR loja + category (tag)
      const itemKey = `${failure.loja_id}-item-${failure.item_name}`;
      const categoryKey = failure.category ? `${failure.loja_id}-cat-${failure.category}` : null;

      if (!map[itemKey]) map[itemKey] = [];
      map[itemKey].push(failure);

      if (categoryKey) {
        if (!map[categoryKey]) map[categoryKey] = [];
        map[categoryKey].push(failure);
      }
    });

    return map;
  }, [failures]);

  // Check if a failure is recurring (>1 occurrence in 30 days)
  const isRecurring = (failure: SupervisionFailure): boolean => {
    const itemKey = `${failure.loja_id}-item-${failure.item_name}`;
    return (recurrenceMap[itemKey]?.length || 0) > 1;
  };

  // Get recurrence info with history
  const getRecurrenceInfo = (failure: SupervisionFailure): RecurrenceInfo => {
    const itemKey = `${failure.loja_id}-item-${failure.item_name}`;
    const history = recurrenceMap[itemKey] || [];
    return {
      count: history.length,
      history: history.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    };
  };

  // Extract available tags (categories) from failures
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    failures.forEach((f) => {
      if (f.category) {
        tags.add(f.category);
      }
    });
    return Array.from(tags).sort();
  }, [failures]);

  const allFailures = [...pendingFailures, ...awaitingValidation];

  // Apply all filters
  const filteredFailures = useMemo(() => {
    let result = allFailures;

    // Status filter
    if (statusFilter === "pending") {
      result = result.filter((f) => f.status === "pending");
    } else if (statusFilter === "resolved") {
      result = result.filter((f) => f.status === "resolved");
    }

    // Recurring filter
    if (showOnlyRecurring) {
      result = result.filter((f) => isRecurring(f));
    }

    // Tag filter
    if (selectedTag) {
      result = result.filter((f) => f.category === selectedTag);
    }

    // Sort by recurrence frequency when recurring filter is active
    if (showOnlyRecurring) {
      result = result.sort((a, b) => {
        const countA = getRecurrenceInfo(a).count;
        const countB = getRecurrenceInfo(b).count;
        return countB - countA; // Highest frequency first
      });
    }

    return result;
  }, [allFailures, statusFilter, showOnlyRecurring, selectedTag]);

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
    setShowOnlyRecurring(false);
    setSelectedTag(null);
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
              showOnlyRecurring={showOnlyRecurring}
              onRecurringToggle={setShowOnlyRecurring}
              selectedTag={selectedTag}
              onTagChange={setSelectedTag}
              availableTags={availableTags}
            />
          </div>
        </CardHeader>

        <CardContent>
          <ActionPlanList
            failures={filteredFailures}
            isAdmin={isAdmin}
            isRecurring={isRecurring}
            getRecurrenceInfo={getRecurrenceInfo}
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
              {showOnlyRecurring && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span>{filteredFailures.length} Recorrentes</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}