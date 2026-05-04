import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";
import { AppGlassBackground } from "@/components/layout/AppGlassBackground";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { PainelSidebar } from "@/components/dashboard/painel-metas/shared/PainelSidebar";
import { VisaoGeralCompactView } from "@/components/dashboard/painel-metas/views/VisaoGeralCompactView";
import { MetricDetailView } from "@/components/dashboard/painel-metas/views/MetricDetailView";
import { RankingView } from "@/components/dashboard/painel-metas/views/RankingView";
import { ComparativoView } from "@/components/dashboard/painel-metas/views/ComparativoView";
import type { MetaKey } from "@/components/dashboard/painel-metas/shared/types";
import type { RankingMetric } from "@/components/dashboard/painel-metas/shared/mockLojas";
import { useMetasSnapshot } from "@/hooks/useMetasSnapshot";
import { snapshotToLoja, statusFor } from "@/components/dashboard/painel-metas/shared/mockLojas";
import { lojaCodigoFromNome } from "@/components/dashboard/painel-metas/shared/lojaMapping";

const METRIC_KEYS: RankingMetric[] = ["nps", "cmv-salmao", "cmv-carnes", "kds", "conformidade"];

function isMetricKey(k: MetaKey): k is RankingMetric {
  return (METRIC_KEYS as MetaKey[]).includes(k);
}

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
  const hideCargoTabs = isOperator && !isAdmin; // operator vê valores agregados sem tabs de cargo
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
                  <VisaoGeralCompactView restrictToLojaCodigo={restrictToLojaCodigo} />
                )}
                {isMetricKey(safeView) && (
                  <MetricDetailView
                    metric={safeView}
                    restrictToLojaCodigo={restrictToLojaCodigo}
                    hideCargoTabs={hideCargoTabs}
                  />
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
