import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Users, ShieldCheck, Settings2, Briefcase, ClipboardList, BarChart3, Building2 } from "lucide-react";
import { ManualScheduleGrid } from "./ManualScheduleGrid";
import { OperationalDashboard } from "./OperationalDashboard";
import { D1ManagementPanel } from "./D1ManagementPanel";
import { TeamManagement } from "./TeamManagement";
import { SectorJobTitleMapping } from "./SectorJobTitleMapping";
import { StaffingMatrixConfig } from "./StaffingMatrixConfig";
import { PopComplianceDashboard } from "./PopComplianceDashboard";
import { PracasConfig } from "./PracasConfig";
import { MinimumStaffingTab } from "./MinimumStaffingTab";

import { usePendingConfirmations } from "@/hooks/usePendingConfirmations";
import { useUserProfile } from "@/hooks/useUserProfile";

interface EscalasTabProps {
  defaultTab?: string;
}

export function EscalasTab({ defaultTab }: EscalasTabProps) {
  
  const { data: confirmations } = usePendingConfirmations();
  const { isAdmin, isOperator } = useUserProfile();

  const hasRisk = (confirmations?.pending ?? 0) > 0 || (confirmations?.denied ?? 0) > 0;
  const [tab, setTab] = useState(defaultTab || "scheduler");
  const showPopDashboard = isAdmin || isOperator;

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="scheduler" className="gap-1.5">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">Editor de Escalas</span>
          <span className="sm:hidden">Escalas</span>
        </TabsTrigger>
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
        <TabsTrigger value="matrix" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Configurações</span>
          <span className="sm:hidden">Config</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="scheduler">
        <ManualScheduleGrid />
      </TabsContent>
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
      <TabsContent value="matrix">
        <StaffingMatrixConfig />
      </TabsContent>
    </Tabs>
  );
}
