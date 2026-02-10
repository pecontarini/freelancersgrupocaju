import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, CalendarDays, ClipboardCheck, Users, ShieldCheck, Briefcase } from "lucide-react";
import { StaffingMatrixConfig } from "./StaffingMatrixConfig";
import { WeeklyScheduler } from "./WeeklyScheduler";
import { OperationalDashboard } from "./OperationalDashboard";
import { TeamManagement } from "./TeamManagement";
import { SectorJobTitleMapping } from "./SectorJobTitleMapping";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePendingConfirmations } from "@/hooks/usePendingConfirmations";

interface EscalasTabProps {
  defaultTab?: string;
}

export function EscalasTab({ defaultTab }: EscalasTabProps) {
  const { isAdmin } = useUserProfile();
  const { data: confirmations } = usePendingConfirmations();

  // Auto-select D-1 tab if there are pending confirmations
  const hasRisk = (confirmations?.pending ?? 0) > 0 || (confirmations?.denied ?? 0) > 0;
  const [tab, setTab] = useState(defaultTab || (hasRisk ? "quadro" : "scheduler"));

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="quadro" className="gap-1.5 relative">
          <ShieldCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Painel D-1</span>
          <span className="sm:hidden">D-1</span>
          {hasRisk && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {confirmations!.pending + confirmations!.denied}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="scheduler" className="gap-1.5">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">Planejamento</span>
          <span className="sm:hidden">Planejar</span>
        </TabsTrigger>
        <TabsTrigger value="equipe" className="gap-1.5">
          <Users className="h-4 w-4" />
          Equipe
        </TabsTrigger>
        {(isAdmin) && (
          <TabsTrigger value="cargos-setores" className="gap-1.5">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Cargos e Setores</span>
            <span className="sm:hidden">Cargos</span>
          </TabsTrigger>
        )}
        {(isAdmin) && (
          <TabsTrigger value="matrix" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações (Matriz)</span>
            <span className="sm:hidden">Matriz</span>
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="quadro">
        <OperationalDashboard />
      </TabsContent>
      <TabsContent value="scheduler">
        <WeeklyScheduler />
      </TabsContent>
      <TabsContent value="equipe">
        <TeamManagement />
      </TabsContent>
      {(isAdmin) && (
        <TabsContent value="cargos-setores">
          <SectorJobTitleMapping />
        </TabsContent>
      )}
      {(isAdmin) && (
        <TabsContent value="matrix">
          <StaffingMatrixConfig />
        </TabsContent>
      )}
    </Tabs>
  );
}
