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

const METRIC_KEYS: RankingMetric[] = ["nps", "cmv-salmao", "cmv-carnes", "kds", "conformidade"];

function isMetricKey(k: MetaKey): k is RankingMetric {
  return (METRIC_KEYS as MetaKey[]).includes(k);
}

export default function MetasPage() {
  const navigate = useNavigate();
  const { roles } = useUserProfile();
  const { selectedUnidadeId, setSelectedUnidadeId } = useUnidade();
  const [view, setView] = useState<MetaKey>("visao-geral");

  const showAdmin = roles.includes("admin") || roles.includes("operator");
  const showManagerPlus = showAdmin || roles.includes("gerente_unidade");

  // Compute red-flag badges per metric for the sidebar
  const { data: snapshots } = useMetasSnapshot();
  const badges = useMemo(() => {
    const lojas = snapshots.map(snapshotToLoja);
    const out: Partial<Record<MetaKey, number>> = {};
    METRIC_KEYS.forEach((m) => {
      const count = lojas.filter((l) => statusFor(m, l.values[m]) === "redflag").length;
      if (count > 0) out[m] = count;
    });
    return out;
  }, [snapshots]);

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
                  active={view}
                  onSelect={setView}
                  showAdmin={showAdmin}
                  showManagerPlus={showManagerPlus}
                  badges={badges}
                />
              </aside>

              {/* Conteúdo */}
              <div className="min-w-0 flex-1">
                {view === "visao-geral" && <VisaoGeralCompactView />}
                {isMetricKey(view) && <MetricDetailView metric={view} />}
                {view === "ranking" && <RankingView />}
                {view === "comparativo" && <ComparativoView />}
                {(view === "red-flag" || view === "planos" || view === "diario" || view === "holding") && (
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
