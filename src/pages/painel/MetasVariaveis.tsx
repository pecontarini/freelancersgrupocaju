import { useNavigate } from "react-router-dom";
import { useUnidade } from "@/contexts/UnidadeContext";
import { AppGlassBackground } from "@/components/layout/AppGlassBackground";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { PayoutDashboard } from "@/components/indicadores/dashboards/PayoutDashboard";
import { PayoutBackground } from "@/components/indicadores/payout/PayoutBackground";
import "@/styles/cajupar-glass.css";

export default function MetasVariaveisPage() {
  const navigate = useNavigate();
  const { selectedUnidadeId, setSelectedUnidadeId } = useUnidade();

  return (
    <SidebarProvider>
      <AppGlassBackground />
      <div className="flex min-h-screen w-full">
        <AppSidebar activeTab="metas-variaveis" onTabChange={(tab) => navigate(`/?tab=${tab}`)} />
        <SidebarInset>
          <PortalHeader
            title="Metas Variáveis"
            subtitle="Payouts mensais por loja e cargo"
            selectedUnidadeId={selectedUnidadeId}
            onUnidadeChange={setSelectedUnidadeId}
          />
          <div className="cj-scope relative">
            <PayoutBackground />
            <main className="container mx-auto max-w-[1400px] px-3 py-4 md:px-6 md:py-6 relative z-10">
              <PayoutDashboard />
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
