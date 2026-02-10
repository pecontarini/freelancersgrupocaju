import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, CalendarDays } from "lucide-react";
import { StaffingMatrixConfig } from "./StaffingMatrixConfig";
import { WeeklyScheduler } from "./WeeklyScheduler";
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
        <TabsTrigger value="matrix" className="gap-1.5">
          <Settings2 className="h-4 w-4" />
          Matriz POP
        </TabsTrigger>
      </TabsList>
      <TabsContent value="scheduler">
        <WeeklyScheduler />
      </TabsContent>
      <TabsContent value="matrix">
        <StaffingMatrixConfig />
      </TabsContent>
    </Tabs>
  );
}
