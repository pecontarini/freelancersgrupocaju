import { useState, useMemo, useEffect } from "react";
import { Loader2, Users } from "lucide-react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { BudgetsGerenciaisTab } from "@/components/dashboard/BudgetsGerenciaisTab";
import { RemuneracaoVariavelTab } from "@/components/dashboard/RemuneracaoVariavelTab";
import { AuditDiagnosticDashboard } from "@/components/dashboard/AuditDiagnosticDashboard";
import { CMVTab } from "@/components/dashboard/CMVTab";
import { ConfiguracoesTabWrapper } from "@/components/dashboard/ConfiguracoesTab";
import { RedeTab } from "@/components/dashboard/RedeTab";
import { AdminCXDashboard } from "@/components/dashboard/AdminCXDashboard";

import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";
import { useOperationalExpenses } from "@/hooks/useOperationalExpenses";
import { useUserProfile } from "@/hooks/useUserProfile";

const tabConfig: Record<string, { title: string; subtitle: string }> = {
  budgets: {
    title: "Budgets Gerenciais",
    subtitle: "Controle diário de gastos operacionais",
  },
  remuneracao: {
    title: "Remuneração Variável",
    subtitle: "Performance mensal e metas de bônus",
  },
  diagnostico: {
    title: "Diagnóstico de Auditoria",
    subtitle: "Análise de não conformidades e plano de ação",
  },
  cx: {
    title: "Dores da Operação",
    subtitle: "Gestão centralizada de reclamações por unidade",
  },
  cmv: {
    title: "CMV (Unitários)",
    subtitle: "Controle de insumos e estoque",
  },
  configuracoes: {
    title: "Configurações",
    subtitle: "Gerenciar sistema e usuários",
  },
  rede: {
    title: "Visão Rede",
    subtitle: "Consolidado de todas as unidades",
  },
};

const Index = () => {
  const {
    entries,
    isLoading,
    uniqueFuncoes,
    uniqueGerencias,
    uniqueLojas,
  } = useFreelancerEntries();

  const { entries: maintenanceEntries, isLoading: isLoadingMaintenance } =
    useMaintenanceEntries();
  const { expenses: operationalExpenses, isLoading: isLoadingOperational } =
    useOperationalExpenses();
  const {
    isAdmin,
    isGerenteUnidade,
    unidades,
    isLoading: isLoadingProfile,
    hasNoRole,
  } = useUserProfile();
  const isMobile = useIsMobile();
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string>("budgets");
  const [isInitialized, setIsInitialized] = useState(false);

  // Auto-select first store for gerentes when they have stores assigned
  useEffect(() => {
    if (!isLoadingProfile && !isInitialized) {
      if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
        setSelectedUnidadeId(unidades[0].id);
      }
      setIsInitialized(true);
    }
  }, [isLoadingProfile, isInitialized, isGerenteUnidade, isAdmin, unidades]);

  // Filter entries based on selected unidade
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
        if (selectedUnidadeId) {
          if (entry.loja_id !== selectedUnidadeId) return false;
        } else {
          const unidadeIds = unidades.map((u) => u.id);
          if (!unidadeIds.includes(entry.loja_id || "")) return false;
        }
      } else if (isAdmin && selectedUnidadeId) {
        if (entry.loja_id !== selectedUnidadeId) return false;
      }
      return true;
    });
  }, [entries, isAdmin, isGerenteUnidade, unidades, selectedUnidadeId]);

  // Filter operational expenses based on selected unidade
  const filteredOperationalExpenses = useMemo(() => {
    return operationalExpenses.filter((expense) => {
      if (selectedUnidadeId) {
        return expense.store_id === selectedUnidadeId;
      }
      if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
        const unidadeIds = unidades.map((u) => u.id);
        return unidadeIds.includes(expense.store_id);
      }
      return true;
    });
  }, [operationalExpenses, selectedUnidadeId, isAdmin, isGerenteUnidade, unidades]);

  // Filter maintenance entries based on selected unidade
  const filteredMaintenanceEntries = useMemo(() => {
    return maintenanceEntries.filter((entry) => {
      if (selectedUnidadeId) {
        return entry.loja_id === selectedUnidadeId;
      }
      if (isGerenteUnidade && !isAdmin && unidades.length > 0) {
        const unidadeIds = unidades.map((u) => u.id);
        return unidadeIds.includes(entry.loja_id || "");
      }
      return true;
    });
  }, [maintenanceEntries, selectedUnidadeId, isAdmin, isGerenteUnidade, unidades]);

  if (
    isLoading ||
    isLoadingProfile ||
    isLoadingMaintenance ||
    isLoadingOperational
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasNoRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <Users className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="font-display text-2xl font-bold uppercase mb-2">
          Aguardando Permissão
        </h2>
        <p className="text-muted-foreground max-w-md">
          Sua conta foi criada, mas você ainda não tem permissão de acesso.
          Entre em contato com o administrador para receber acesso ao sistema.
        </p>
      </div>
    );
  }

  const currentTabConfig = tabConfig[activeTab] || tabConfig.budgets;

  const renderTabContent = () => {
    switch (activeTab) {
      case "budgets":
        return (
          <BudgetsGerenciaisTab
            freelancerEntries={filteredEntries}
            operationalExpenses={filteredOperationalExpenses}
            maintenanceEntries={filteredMaintenanceEntries}
            selectedUnidadeId={selectedUnidadeId || (isGerenteUnidade && unidades.length > 0 ? unidades[0].id : "")}
          />
        );
      case "remuneracao":
        return (
          <RemuneracaoVariavelTab selectedUnidadeId={selectedUnidadeId} />
        );
      case "diagnostico":
        return (
          <AuditDiagnosticDashboard 
            selectedUnidadeId={selectedUnidadeId} 
            isAdmin={isAdmin} 
          />
        );
      case "cx":
        return isAdmin ? <AdminCXDashboard /> : null;
      case "cmv":
        return <CMVTab />;
      case "configuracoes":
        return isAdmin ? <ConfiguracoesTabWrapper /> : null;
      case "rede":
        return isAdmin ? <RedeTab /> : null;
      default:
        return (
          <BudgetsGerenciaisTab
            freelancerEntries={filteredEntries}
            operationalExpenses={filteredOperationalExpenses}
            maintenanceEntries={filteredMaintenanceEntries}
            selectedUnidadeId={selectedUnidadeId || (isGerenteUnidade && unidades.length > 0 ? unidades[0].id : "")}
          />
        );
    }
  };

  // Mobile layout
  if (isMobile) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen flex-col pb-20 pt-14 w-full">
          <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="px-4 py-4">
            <PortalHeader
              title={currentTabConfig.title}
              subtitle={currentTabConfig.subtitle}
              selectedUnidadeId={selectedUnidadeId}
              onUnidadeChange={setSelectedUnidadeId}
            />
          </div>
          <main className="flex-1 px-4 pb-4">{renderTabContent()}</main>
        </div>
      </SidebarProvider>
    );
  }

  // Desktop layout with sidebar
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <SidebarInset>
          <PortalHeader
            title={currentTabConfig.title}
            subtitle={currentTabConfig.subtitle}
            selectedUnidadeId={selectedUnidadeId}
            onUnidadeChange={setSelectedUnidadeId}
          />
          <main className="flex-1 p-6">{renderTabContent()}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Index;
