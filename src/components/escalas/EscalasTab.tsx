import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Users, ShieldCheck, Settings2, Briefcase, ClipboardList, BarChart3, Building2, Sparkles, Wand2 } from "lucide-react";
import { GeradorEscalaIA } from "./GeradorEscalaIA";
import { ManualScheduleGrid } from "./ManualScheduleGrid";
import { OperationalDashboard } from "./OperationalDashboard";
import { D1ManagementPanel } from "./D1ManagementPanel";
import { TeamManagement } from "./TeamManagement";
import { SectorJobTitleMapping } from "./SectorJobTitleMapping";
import { StaffingMatrixConfig } from "./StaffingMatrixConfig";
import { PopComplianceDashboard } from "./PopComplianceDashboard";
import { PracasConfig } from "./PracasConfig";
import { HoldingOperationalConfigTab } from "./HoldingOperationalConfigTab";
import { EscalasItaimSection } from "./EscalasItaimSection";

import { usePendingConfirmations } from "@/hooks/usePendingConfirmations";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";

const UNIDADE_ID_ITAIM = "87228077-03ab-445b-a409-237972ee6719";

interface EscalasTabProps {
  defaultTab?: string;
}

export function EscalasTab({ defaultTab }: EscalasTabProps) {
  
  const { data: confirmations } = usePendingConfirmations();
  const { isAdmin, isOperator } = useUserProfile();
  const { effectiveUnidadeId } = useUnidade();
  const isItaim = effectiveUnidadeId === UNIDADE_ID_ITAIM;

  const hasRisk = (confirmations?.pending ?? 0) > 0 || (confirmations?.denied ?? 0) > 0;
  const [tab, setTab] = useState(defaultTab || "scheduler");
  const showPopDashboard = isAdmin || isOperator;

  // Se sair de Itaim enquanto na aba MVP, volta para o editor padrão
  useEffect(() => {
    if (!isItaim && tab === "ia-mvp") setTab("scheduler");
  }, [isItaim, tab]);

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="scheduler" className="gap-1.5">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">Editor de Escalas</span>
          <span className="sm:hidden">Escalas</span>
        </TabsTrigger>
        {isItaim && (
          <TabsTrigger value="ia-mvp" className="gap-1.5 border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Gerador IA (MVP)</span>
            <span className="sm:hidden">IA MVP</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="d1" className="gap-1.5 relative">
          <ClipboardList className="h-4 w-4" />
          <span className="hidden sm:inline">Gestão D-1</span>
          <span className="sm:hidden">D-1</span>
          {hasRisk && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {confirmations!.pending + confirmations!.denied}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="quadro" className="gap-1.5">
          <ShieldCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Quadro Operacional</span>
          <span className="sm:hidden">Quadro</span>
        </TabsTrigger>
        {showPopDashboard && (
          <TabsTrigger value="pop-dashboard" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard POP</span>
            <span className="sm:hidden">POP</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="equipe" className="gap-1.5">
          <Users className="h-4 w-4" />
          Equipe
        </TabsTrigger>
        <TabsTrigger value="cargos-setores" className="gap-1.5">
          <Briefcase className="h-4 w-4" />
          <span className="hidden sm:inline">Cargos e Setores</span>
          <span className="sm:hidden">Cargos</span>
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="escalas-minimas" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Configuração Holding</span>
            <span className="sm:hidden">Holding</span>
          </TabsTrigger>
        )}
        <TabsTrigger value="matrix" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Configurações</span>
          <span className="sm:hidden">Config</span>
        </TabsTrigger>
        <TabsTrigger value="gerador-ia" className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Gerador IA</span>
          <span className="sm:hidden">IA</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="scheduler">
        <ManualScheduleGrid />
      </TabsContent>
      {isItaim && (
        <TabsContent value="ia-mvp">
          <EscalasItaimSection />
        </TabsContent>
      )}
      <TabsContent value="d1">
        <D1ManagementPanel />
      </TabsContent>
      <TabsContent value="quadro">
        <OperationalDashboard />
      </TabsContent>
      {showPopDashboard && (
        <TabsContent value="pop-dashboard">
          <PopComplianceDashboard />
        </TabsContent>
      )}
      <TabsContent value="equipe">
        <TeamManagement />
      </TabsContent>
      <TabsContent value="cargos-setores">
        <div className="space-y-4">
          <SectorJobTitleMapping />
          <PracasConfig />
        </div>
      </TabsContent>
      {isAdmin && (
        <TabsContent value="escalas-minimas">
          <HoldingOperationalConfigTab />
        </TabsContent>
      )}
      <TabsContent value="matrix">
        <StaffingMatrixConfig />
      </TabsContent>
      <TabsContent value="gerador-ia">
        <GeradorEscalaIA />
      </TabsContent>
    </Tabs>
  );
}
