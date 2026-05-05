import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";
import { AppGlassBackground } from "@/components/layout/AppGlassBackground";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { PainelSidebar } from "@/components/dashboard/painel-metas/shared/PainelSidebar";
import { ExecutiveOverviewView } from "@/components/dashboard/painel-metas/views/ExecutiveOverviewView";

import { RankingView } from "@/components/dashboard/painel-metas/views/RankingView";
import { ComparativoView } from "@/components/dashboard/painel-metas/views/ComparativoView";
import { NpsReclamacoesView } from "@/components/dashboard/painel-metas/views/NpsReclamacoesView";
import { CmvDetailView } from "@/components/dashboard/painel-metas/views/CmvDetailView";
import { KdsConformidadeView } from "@/components/dashboard/painel-metas/views/KdsConformidadeView";
import { ConformidadeDetailView } from "@/components/dashboard/painel-metas/views/ConformidadeDetailView";
import type { MetaKey } from "@/components/dashboard/painel-metas/shared/types";
import type { RankingMetric } from "@/components/dashboard/painel-metas/shared/mockLojas";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import { snapshotToLoja, statusFor } from "@/components/dashboard/painel-metas/shared/mockLojas";
import { lojaCodigoFromNome } from "@/components/dashboard/painel-metas/shared/lojaMapping";
import { useSyncNpsSheets } from "@/hooks/useSyncNpsSheets";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";

const METRIC_KEYS: RankingMetric[] = ["nps", "cmv-salmao", "cmv-carnes", "kds", "conformidade"];
void METRIC_KEYS;

export default function MetasPage() {
  const navigate = useNavigate();
  const { roles, isAdmin, isOperator, isGerenteUnidade, unidades } = useUserProfile();
  const { selectedUnidadeId, setSelectedUnidadeId } = useUnidade();
  const [view, setView] = useState<MetaKey>("visao-geral");

  // ── Controle de acesso por role ─────────────────────────────────────
  // admin/operator: acesso total
  // operator (proprietário): vê Ranking/Comparativo mas sem abas de cargo
  // gerente_unidade: vê apenas a própria loja, sem Ranking/Comparativo
  const showFullAccess = isAdmin || isOperator;
  const showManagerPlus = showFullAccess; // gerente_unidade NÃO vê Ranking/Comparativo
  void (isOperator && !isAdmin); // hideCargoTabs reserved for future use
  const restrictToLojaCodigo = useMemo(() => {
    if (isAdmin || isOperator) return null;
    if (!isGerenteUnidade) return null;
    // Mapeia a primeira loja do gerente para o código de metas_snapshot
    const lojaNome = unidades[0]?.nome ?? null;
    return lojaCodigoFromNome(lojaNome);
  }, [isAdmin, isOperator, isGerenteUnidade, unidades]);

  // Compute red-flag badges per metric for the sidebar
  const { data: snapshots } = useMetasSnapshot();
  const badges = useMemo(() => {
    const filtered = restrictToLojaCodigo
      ? snapshots.filter((s) => s.loja_codigo === restrictToLojaCodigo)
      : snapshots;
    const lojas = filtered.map(snapshotToLoja);
    const out: Partial<Record<MetaKey, number>> = {};
    METRIC_KEYS.forEach((m) => {
      const count = lojas.filter((l) => statusFor(m, l.values[m]) === "redflag").length;
      if (count > 0) out[m] = count;
    });
    return out;
  }, [snapshots, restrictToLojaCodigo]);

  // Se gerente tenta abrir uma view bloqueada, força volta para visão geral
  const safeView: MetaKey =
    !showManagerPlus && (view === "ranking" || view === "comparativo") ? "visao-geral" : view;

  return (
    <SidebarProvider>
      <AppGlassBackground />
      <div className="flex min-h-screen w-full">
        <AppSidebar activeTab="painel" onTabChange={(tab) => navigate(`/?tab=${tab}`)} />
        <SidebarInset>
          <PortalHeader
            title="Painel de Metas"
            subtitle="Acompanhamento de indicadores estratégicos"
            selectedUnidadeId={selectedUnidadeId}
            onUnidadeChange={setSelectedUnidadeId}
          />

          <main className="container mx-auto max-w-[1400px] px-3 py-6 md:px-6 md:py-8">
            {showFullAccess && <NpsSyncBar />}
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              {/* Sidebar de métricas */}
              <aside className="md:sticky md:top-6 md:self-start">
                <PainelSidebar
                  active={safeView}
                  onSelect={setView}
                  showAdmin={showFullAccess}
                  showManagerPlus={showManagerPlus}
                  badges={badges}
                />
              </aside>

              {/* Conteúdo */}
              <div className="min-w-0 flex-1">
                {safeView === "visao-geral" && (
                  <ExecutiveOverviewView restrictToLojaCodigo={restrictToLojaCodigo} onNavigate={setView} />
                )}
                {safeView === "nps" && (
                  <NpsReclamacoesView restrictToLojaCodigo={restrictToLojaCodigo} />
                )}
                {safeView === "cmv-salmao" && (
                  <CmvDetailView variant="salmao" restrictToLojaCodigo={restrictToLojaCodigo} />
                )}
                {safeView === "cmv-carnes" && (
                  <CmvDetailView variant="carnes" restrictToLojaCodigo={restrictToLojaCodigo} />
                )}
                {safeView === "kds" && (
                  <KdsConformidadeView metric="kds" restrictToLojaCodigo={restrictToLojaCodigo} />
                )}
                {safeView === "conformidade" && (
                  <ConformidadeDetailView restrictToLojaCodigo={restrictToLojaCodigo} />
                )}
                {safeView === "ranking" && showManagerPlus && <RankingView />}
                {safeView === "comparativo" && showManagerPlus && <ComparativoView />}
                {(safeView === "red-flag" ||
                  safeView === "planos" ||
                  safeView === "diario" ||
                  safeView === "holding") && (
                  <div className="glass-card p-12 text-center text-sm text-white/60">
                    Esta seção está disponível na aba "Painel" do dashboard principal.
                  </div>
                )}
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function NpsSyncBar() {
  const { syncing, lastSync, error, triggerSync } = useSyncNpsSheets();

  useEffect(() => {
    if (error) toast({ title: "Erro ao sincronizar NPS", description: error, variant: "destructive" });
  }, [error]);

  useEffect(() => {
    if (lastSync) toast({ title: "NPS sincronizado", description: "Snapshots atualizados com sucesso." });
  }, [lastSync]);

  return (
    <div className="vision-glass-pill mb-4 flex flex-wrap items-center justify-between gap-2 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {error ? (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-destructive">Falha: {error}</span>
          </>
        ) : lastSync ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-foreground/80">Última sincronização: {lastSync.toLocaleString("pt-BR")}</span>
          </>
        ) : (
          <span className="text-muted-foreground">NPS ainda não sincronizado nesta sessão</span>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={triggerSync}
        disabled={syncing}
        className="vision-glass-pill h-8 gap-1.5 border-0 text-xs"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando…" : "Sincronizar NPS"}
      </Button>
    </div>
  );
}
