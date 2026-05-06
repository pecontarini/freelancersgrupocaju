import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, ScanFace } from "lucide-react";
import { EscalasTab } from "@/components/escalas/EscalasTab";
import { CheckinManagerDashboard } from "@/components/checkin";
import { EscalasItaimSection } from "@/components/escalas/EscalasItaimSection";

interface GestaoPessoasTabProps {
  selectedUnidadeId: string;
}

export function GestaoPessoasTab({ selectedUnidadeId }: GestaoPessoasTabProps) {
  return (
    <div className="space-y-6">
    <Tabs defaultValue="escalas" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="escalas" className="gap-1.5">
          <CalendarClock className="h-4 w-4" />
          Escalas
        </TabsTrigger>
        <TabsTrigger value="presenca" className="gap-1.5">
          <ScanFace className="h-4 w-4" />
          Presença Freelancers
        </TabsTrigger>
      </TabsList>

      <TabsContent value="escalas">
        <EscalasTab />
      </TabsContent>
      <TabsContent value="presenca">
        <CheckinManagerDashboard selectedUnidadeId={selectedUnidadeId} />
      </TabsContent>
    </Tabs>
    <EscalasItaimSection />
    </div>
  );
}
