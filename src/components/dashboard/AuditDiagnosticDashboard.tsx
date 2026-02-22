import { useState, useMemo, useCallback } from "react";
import {
  ClipboardList,
  Upload,
  RefreshCcw,
  Loader2,
  Filter,
  Calendar,
  Store,
  Building2,
  LayoutDashboard,
  History,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  useCalculateLeadershipPerformance,
} from "@/hooks/useLeadershipPerformance";
import { ChecklistImportSection } from "@/components/ChecklistImportSection";
import { categorizeItemToSector, SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";

import {
  AuditKPICards,
  AuditEvolutionChart,
  RecurrenceRanking,
  AuditHistoryTable,
  AuditReportGenerator,
  SectorReportGenerator,
  AIAnalysisButton,
  AlertsFeed,
} from "@/components/audit-diagnostic";
import {
  ChecklistTemplateManager,
  ChecklistLinksPanel,
  ChecklistResponsesDashboard,
} from "@/components/checklist-daily";

interface AuditDiagnosticDashboardProps {
  selectedUnidadeId: string | null;
  isAdmin?: boolean;
}

const BRAND_PATTERNS: Record<string, string[]> = {
  all: [],
  caminito: ["CAMINITO", "MULT"],
  nazo: ["NAZO", "NFE"],
  caju: ["CAJU"],
  fosters: ["FOSTER", "FB"],
};

const PERIOD_OPTIONS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "15d", label: "Últimos 15 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "this_month", label: "Este Mês" },
  { value: "last_month", label: "Mês Passado" },
  { value: "90d", label: "Últimos 90 dias" },
];

function getDateRange(periodKey: string): { from: Date; to: Date } {
  const now = new Date();
  switch (periodKey) {
    case "7d":
      return { from: subDays(now, 7), to: now };
    case "15d":
      return { from: subDays(now, 15), to: now };
    case "30d":
      return { from: subDays(now, 30), to: now };
    case "this_month":
      return { from: startOfMonth(now), to: now };
    case "last_month": {
      const lastM = subMonths(now, 1);
      return { from: startOfMonth(lastM), to: endOfMonth(lastM) };
    }
    case "90d":
      return { from: subDays(now, 90), to: now };
    default:
      return { from: subDays(now, 30), to: now };
  }
}

export function AuditDiagnosticDashboard({
  selectedUnidadeId,
  isAdmin = false,
}: AuditDiagnosticDashboardProps) {
  const { options: lojas } = useConfigLojas();
  const { unidades, isAdmin: userIsAdmin } = useUserProfile();
  const [brandFilter, setBrandFilter] = useState("all");
  const [lojaFilter, setLojaFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("30d");

  const dateRange = useMemo(() => getDateRange(periodFilter), [periodFilter]);

  const effectiveLojaId = selectedUnidadeId || (lojaFilter !== "all" ? lojaFilter : null);

  const { audits, failures, isLoadingAudits, isLoadingFailures, auditChecklistTypes, deleteAudit, isDeletingAudit } = useSupervisionAudits(
    effectiveLojaId,
    undefined,
    dateRange
  );

  const { calculate, isCalculating } = useCalculateLeadershipPerformance();

  // Available stores
  const availableStores = useMemo(() => {
    if (isAdmin || userIsAdmin) return lojas;
    return unidades;
  }, [isAdmin, userIsAdmin, lojas, unidades]);

  // Group stores by brand
  const groupedStores = useMemo(() => {
    const groups: Record<string, typeof availableStores> = {};
    availableStores.forEach((loja) => {
      let brand = "Outras";
      for (const [key, patterns] of Object.entries(BRAND_PATTERNS)) {
        if (key === "all") continue;
        if (patterns.some((p) => loja.nome.toUpperCase().includes(p))) {
          brand = key.charAt(0).toUpperCase() + key.slice(1);
          break;
        }
      }
      if (!groups[brand]) groups[brand] = [];
      groups[brand].push(loja);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [availableStores]);

  const getLojaName = useCallback(
    (id: string) => lojas.find((l) => l.id === id)?.nome || "Desconhecida",
    [lojas]
  );

  // Filter failures by brand if needed
  const filteredFailures = useMemo(() => {
    let result = failures;
    if (!isAdmin && !userIsAdmin) {
      const myIds = unidades.map((u) => u.id);
      result = result.filter((f) => myIds.includes(f.loja_id));
    }
    if (brandFilter !== "all" && !effectiveLojaId) {
      const patterns = BRAND_PATTERNS[brandFilter] || [];
      const brandLojaIds = lojas
        .filter((l) => patterns.some((p) => l.nome.toUpperCase().includes(p)))
        .map((l) => l.id);
      result = result.filter((f) => brandLojaIds.includes(f.loja_id));
    }
    return result;
  }, [failures, isAdmin, userIsAdmin, unidades, brandFilter, effectiveLojaId, lojas]);

  // Filter audits by brand
  const filteredAudits = useMemo(() => {
    let result = audits;
    if (!isAdmin && !userIsAdmin) {
      const myIds = unidades.map((u) => u.id);
      result = result.filter((a) => myIds.includes(a.loja_id));
    }
    if (brandFilter !== "all" && !effectiveLojaId) {
      const patterns = BRAND_PATTERNS[brandFilter] || [];
      const brandLojaIds = lojas
        .filter((l) => patterns.some((p) => l.nome.toUpperCase().includes(p)))
        .map((l) => l.id);
      result = result.filter((a) => brandLojaIds.includes(a.loja_id));
    }
    return result;
  }, [audits, isAdmin, userIsAdmin, unidades, brandFilter, effectiveLojaId, lojas]);

  // KPIs
  const avgScore = useMemo(() => {
    if (filteredAudits.length === 0) return null;
    return filteredAudits.reduce((sum, a) => sum + a.global_score, 0) / filteredAudits.length;
  }, [filteredAudits]);

  const criticalSector = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    filteredFailures.forEach((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      const name = SECTOR_POSITION_MAP[sector]?.displayName || sector;
      if (!counts[name]) counts[name] = { name, count: 0 };
      counts[name].count++;
    });
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    return sorted.length > 0 ? { name: sorted[0].name, lostPoints: sorted[0].count } : null;
  }, [filteredFailures]);

  // Recurrence count (items appearing 3+ times)
  const recurringCount = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredFailures.forEach((f) => {
      counts[f.item_name] = (counts[f.item_name] || 0) + 1;
    });
    return Object.values(counts).filter((c) => c >= 3).length;
  }, [filteredFailures]);

  // Period label for report
  const periodLabel = useMemo(() => {
    return `${format(dateRange.from, "dd/MM/yyyy")} a ${format(dateRange.to, "dd/MM/yyyy")}`;
  }, [dateRange]);

  const unitDisplayName = effectiveLojaId
    ? getLojaName(effectiveLojaId)
    : brandFilter !== "all"
    ? `Marca: ${brandFilter.charAt(0).toUpperCase() + brandFilter.slice(1)}`
    : "Todas as Unidades";

  // Handle drill-down from chart click
  const handleAuditChartClick = useCallback(
    (auditId: string) => {
      // The Sheet in history tab handles this — we switch tab and let user click
      // For now this is a no-op; clicking the dot gives visual feedback
    },
    []
  );

  if (isLoadingAudits || isLoadingFailures) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold uppercase">
                Diagnóstico de Auditoria
              </h2>
              <p className="text-sm text-muted-foreground">
                Análise de dados, recorrências e relatórios gerenciais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Report Generator */}
            <AuditReportGenerator
              audits={filteredAudits}
              failures={filteredFailures}
              unitName={unitDisplayName}
              periodLabel={periodLabel}
              avgScore={avgScore}
            />

            {/* Sector Report */}
            <SectorReportGenerator
              failures={filteredFailures}
              unitName={unitDisplayName}
              periodLabel={periodLabel}
            />

            {/* AI Analysis */}
            <AIAnalysisButton
              failures={filteredFailures}
              unitName={unitDisplayName}
              periodLabel={periodLabel}
              avgScore={avgScore}
            />

            {/* Upload */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg uppercase">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    Importar Checklist de Supervisão
                  </DialogTitle>
                </DialogHeader>
                <ChecklistImportSection />
              </DialogContent>
            </Dialog>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  calculate({
                    action: "backfill",
                    loja_id: selectedUnidadeId || undefined,
                    trigger_type: "manual_backfill",
                  })
                }
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Recalcular</span>
              </Button>
            )}
          </div>
        </div>

        {/* ===== FILTER BAR ===== */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros:
          </div>

          {/* Period */}
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-[180px] h-9 bg-background">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Store */}
          {!selectedUnidadeId && (
            <Select value={lojaFilter} onValueChange={setLojaFilter}>
              <SelectTrigger className="w-[220px] h-9 bg-background">
                <Store className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Todas as unidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Store className="h-3.5 w-3.5" />
                    Todas as unidades
                  </span>
                </SelectItem>
                {groupedStores.map(([brand, stores]) => (
                  <SelectGroup key={brand}>
                    <SelectLabel className="text-xs uppercase text-primary font-semibold">
                      {brand}
                    </SelectLabel>
                    {stores.map((loja) => (
                      <SelectItem key={loja.id} value={loja.id}>
                        {loja.nome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Brand */}
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Marcas</SelectItem>
              <SelectItem value="caminito">Caminito</SelectItem>
              <SelectItem value="nazo">Nazo</SelectItem>
              <SelectItem value="caju">Caju</SelectItem>
              <SelectItem value="fosters">Fosters</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===== ALERTS ===== */}
      <AlertsFeed lojaId={effectiveLojaId} isAdmin={isAdmin || userIsAdmin} />

      {/* ===== KPI CARDS ===== */}
      <AuditKPICards
        avgScore={avgScore}
        scoreVariation={null}
        totalAudits={filteredAudits.length}
        totalFailures={filteredFailures.length}
        criticalSector={criticalSector}
        recurringCount={recurringCount}
      />

      {/* ===== TABS ===== */}
      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 h-auto gap-1">
          <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-sm py-2.5">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
            <span className="sm:hidden">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5 text-sm py-2.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
            <span className="sm:hidden">Hist.</span>
          </TabsTrigger>
          <TabsTrigger value="daily-checklist" className="flex items-center gap-1.5 text-sm py-2.5">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Checklist Diário</span>
            <span className="sm:hidden">Check.</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: Analytics ===== */}
        <TabsContent value="analytics" className="space-y-6 animate-fade-in">
          <AuditEvolutionChart
            audits={filteredAudits}
            onAuditClick={handleAuditChartClick}
          />
          <RecurrenceRanking failures={filteredFailures} />
        </TabsContent>

        {/* ===== TAB 2: History ===== */}
        <TabsContent value="history" className="animate-fade-in">
          <AuditHistoryTable
            audits={filteredAudits}
            failures={filteredFailures}
            getLojaName={getLojaName}
            auditChecklistTypes={auditChecklistTypes}
            onDeleteAudit={deleteAudit}
            isDeletingAudit={isDeletingAudit}
            isAdmin={isAdmin || userIsAdmin}
          />
        </TabsContent>

        {/* ===== TAB 3: Daily Checklist ===== */}
        <TabsContent value="daily-checklist" className="animate-fade-in space-y-6">
          {effectiveLojaId ? (
            <>
              {(isAdmin || userIsAdmin) && (
                <ChecklistTemplateManager
                  lojaId={effectiveLojaId}
                  lojaName={getLojaName(effectiveLojaId)}
                />
              )}
              <ChecklistLinksPanel lojaId={effectiveLojaId} />
              <ChecklistResponsesDashboard lojaId={effectiveLojaId} />
            </>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Selecione uma unidade no filtro acima para gerenciar o Checklist Diário.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
