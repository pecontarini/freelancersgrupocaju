import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, CalendarDays, ClipboardCheck, Users } from "lucide-react";
import { StaffingMatrixConfig } from "./StaffingMatrixConfig";
import { WeeklyScheduler } from "./WeeklyScheduler";
import { OperationalDashboard } from "./OperationalDashboard";
import { TeamManagement } from "./TeamManagement";
import { useUserProfile } from "@/hooks/useUserProfile";

export function EscalasTab() {
  const { isAdmin } = useUserProfile();
  const [tab, setTab] = useState("scheduler");

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="scheduler" className="gap-1.5">
          <CalendarDays className="h-4 w-4" />
          Montar Escala
        </TabsTrigger>
        <TabsTrigger value="quadro" className="gap-1.5">
          <ClipboardCheck className="h-4 w-4" />
          Quadro Digital
        </TabsTrigger>
        <TabsTrigger value="equipe" className="gap-1.5">
          <Users className="h-4 w-4" />
          Equipe
        </TabsTrigger>
        <TabsTrigger value="matrix" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          Matriz POP
        </TabsTrigger>
      </TabsList>
      <TabsContent value="scheduler">
        <WeeklyScheduler />
      </TabsContent>
      <TabsContent value="quadro">
        <OperationalDashboard />
      </TabsContent>
      <TabsContent value="equipe">
        <TeamManagement />
      </TabsContent>
      <TabsContent value="matrix">
        <StaffingMatrixConfig />
      </TabsContent>
    </Tabs>
  );
}
