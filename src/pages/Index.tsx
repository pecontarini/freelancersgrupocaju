import { useState, useMemo, useEffect, useCallback } from "react";
import { Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { RedFlagBanner } from "@/components/metas/RedFlagBanner";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { BudgetsGerenciaisTab } from "@/components/dashboard/BudgetsGerenciaisTab";

import { AuditDiagnosticDashboard } from "@/components/dashboard/AuditDiagnosticDashboard";

import { CMVTab } from "@/components/dashboard/CMVTab";
import { ConfiguracoesTabWrapper } from "@/components/dashboard/ConfiguracoesTab";
import { RedeTab } from "@/components/dashboard/RedeTab";

import { EscalasTab } from "@/components/escalas/EscalasTab";
import { UtensiliosTab } from "@/components/utensilios";
import { EstoqueTab } from "@/components/estoque";
import { PainelMetasTab } from "@/components/dashboard/PainelMetasTab";
import { TeamReadinessCard } from "@/components/escalas/TeamReadinessCard";
import { CheckinManagerDashboard } from "@/components/checkin";
import { AgendaLiderTab } from "@/components/agenda-lider/AgendaLiderTab";
import { UnitariosGerentesTab } from "@/components/dashboard/UnitariosGerentesTab";
import { GestaoPessoasTab } from "@/components/dashboard/GestaoPessoasTab";

import { AppGlassBackground } from "@/components/layout/AppGlassBackground";
import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";
import { useOperationalExpenses } from "@/hooks/useOperationalExpenses";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";

const tabConfig: Record<string, { title: string; subtitle: string }> = {
  "unitarios-gerentes": {
    title: "Unitários Gerentes",
    subtitle: "Budgets Gerenciais, CMV Unitário e Utensílios em um só lugar",
  },
  "gestao-pessoas": {
    title: "Gestão de Pessoas",
    subtitle: "Escalas e presença de freelancers",
  },
  budgets: {
    title: "Budgets Gerenciais",
    subtitle: "Controle diário de gastos operacionais",
  },
  diagnostico: {
    title: "Diagnóstico de Auditoria",
    subtitle: "Análise de não conformidades e plano de ação",
  },
  cmv: {
    title: "CMV (Unitários)",
    subtitle: "Controle de insumos e estoque",
  },
  presenca: {
    title: "Presença Freelancers",
    subtitle: "Check-in/check-out e validação de presença",
  },
  configuracoes: {
    title: "Configurações",
    subtitle: "Gerenciar sistema e usuários",
  },
  rede: {
    title: "Visão Rede",
    subtitle: "Consolidado de todas as unidades",
  },
  escalas: {
    title: "Escalas",
    subtitle: "Construtor de escalas com validação CLT e compliance POP",
  },
  utensilios: {
    title: "Utensílios",
    subtitle: "Controle de utensílios, contagem e budget mensal",
  },
  estoque: {
    title: "Estoque Geral",
    subtitle: "Gestão de estoque por setor com inventários e movimentações",
  },
  painel: {
    title: "Painel de Indicadores",
    subtitle: "Resultados e indicadores operacionais da rede",
  },
  "agenda-lider": {
    title: "Agenda do Líder",
    subtitle: "Chat IA, missões e planos de ação para a liderança",
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
    isOperator,
    isGerenteUnidade,
    isChefeSetor,
    unidades,
    isLoading: isLoadingProfile,
    hasNoRole,
  } = useUserProfile();
  const isMobile = useIsMobile();

  // Use global context as single source of truth
  const { selectedUnidadeId, setSelectedUnidadeId, effectiveUnidadeId } = useUnidade();

  const [activeTab, setActiveTab] = useState<string>(isChefeSetor ? "gestao-pessoas" : "unitarios-gerentes");
  const [isInitialized, setIsInitialized] = useState(false);
  const navigate = useNavigate();

  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab === "agenda") {
        navigate("/agenda");
        return;
      }
      if (tab === "painel") {
        navigate("/painel/metas");
        return;
      }
      setActiveTab(tab);
    },
    [navigate]
  );

  // Set default tab for chefe_setor
  useEffect(() => {
    if (!isLoadingProfile && !isInitialized) {
      if (isChefeSetor) {
        setActiveTab("gestao-pessoas");
      }
      setIsInitialized(true);
    }
  }, [isLoadingProfile, isInitialized, isChefeSetor]);

  // Filter entries based on selected unidade
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if ((isGerenteUnidade || isOperator) && !isAdmin && unidades.length > 0) {
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
  }, [entries, isAdmin, isOperator, isGerenteUnidade, unidades, selectedUnidadeId]);

  // Filter operational expenses based on selected unidade
  const filteredOperationalExpenses = useMemo(() => {
    return operationalExpenses.filter((expense) => {
      if (selectedUnidadeId) {
        return expense.store_id === selectedUnidadeId;
      }
      if ((isGerenteUnidade || isOperator) && !isAdmin && unidades.length > 0) {
        const unidadeIds = unidades.map((u) => u.id);
        return unidadeIds.includes(expense.store_id);
      }
      return true;
    });
  }, [operationalExpenses, selectedUnidadeId, isAdmin, isOperator, isGerenteUnidade, unidades]);

  // Filter maintenance entries based on selected unidade
  const filteredMaintenanceEntries = useMemo(() => {
    return maintenanceEntries.filter((entry) => {
      if (selectedUnidadeId) {
        return entry.loja_id === selectedUnidadeId;
      }
      if ((isGerenteUnidade || isOperator) && !isAdmin && unidades.length > 0) {
        const unidadeIds = unidades.map((u) => u.id);
        return unidadeIds.includes(entry.loja_id || "");
      }
      return true;
    });
  }, [maintenanceEntries, selectedUnidadeId, isAdmin, isOperator, isGerenteUnidade, unidades]);

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
    const budgetsProps = {
      freelancerEntries: filteredEntries,
      operationalExpenses: filteredOperationalExpenses,
      maintenanceEntries: filteredMaintenanceEntries,
      selectedUnidadeId:
        effectiveUnidadeId ||
        ((isGerenteUnidade || isOperator) && unidades.length > 0 ? unidades[0].id : ""),
    };

    // Chefe de setor only sees Gestão de Pessoas (Escalas + Presença)
    if (isChefeSetor && activeTab !== "gestao-pessoas") {
      return <GestaoPessoasTab selectedUnidadeId={selectedUnidadeId} />;
    }

    switch (activeTab) {
      case "unitarios-gerentes":
        return (
          <div className="space-y-4">
            <TeamReadinessCard onNavigate={() => setActiveTab("gestao-pessoas")} />
            <UnitariosGerentesTab budgetsProps={budgetsProps} />
          </div>
        );
      case "gestao-pessoas":
        return <GestaoPessoasTab selectedUnidadeId={selectedUnidadeId} />;
      case "budgets":
        return (
          <div className="space-y-4">
            <TeamReadinessCard onNavigate={() => setActiveTab("gestao-pessoas")} />
            <BudgetsGerenciaisTab {...budgetsProps} />
          </div>
        );
      case "diagnostico":
        return (
          <AuditDiagnosticDashboard
            selectedUnidadeId={selectedUnidadeId}
            isAdmin={isAdmin}
          />
        );
      case "cmv":
        return <CMVTab />;
      case "escalas":
        return <EscalasTab />;
      case "presenca":
        return <CheckinManagerDashboard selectedUnidadeId={selectedUnidadeId} />;
      case "utensilios":
        return <UtensiliosTab />;
      case "estoque":
        return <EstoqueTab />;
      case "configuracoes":
        return isAdmin ? <ConfiguracoesTabWrapper /> : null;
      case "rede":
        return isAdmin ? <RedeTab /> : null;
      case "agenda-lider":
        return <AgendaLiderTab />;
      default:
        return <UnitariosGerentesTab budgetsProps={budgetsProps} />;
    }
  };

  // Mobile layout
  if (isMobile) {
    return (
      <SidebarProvider>
        <AppGlassBackground />
        <div
          className="flex min-h-screen flex-col pt-14 w-full"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
        >
          <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          <RedFlagBanner />
          <div className="px-3 py-3">
            <PortalHeader
              title={currentTabConfig.title}
              subtitle={currentTabConfig.subtitle}
              selectedUnidadeId={selectedUnidadeId}
              onUnidadeChange={setSelectedUnidadeId}
            />
          </div>
          <main className="flex-1 px-3 pb-4">{renderTabContent()}</main>
        </div>
      </SidebarProvider>
    );
  }

  // Desktop layout with sidebar
  return (
    <SidebarProvider>
      <AppGlassBackground />
      <div className="flex min-h-screen w-full">
        <AppSidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <SidebarInset>
          <RedFlagBanner />
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
