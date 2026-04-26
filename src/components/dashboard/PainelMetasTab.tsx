import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  MessageSquare,
  ClipboardCheck,
  ListChecks,
} from "lucide-react";

interface PainelMetasTabProps {
  selectedUnidadeId: string | null;
}

const SUBTABS = [
  { value: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { value: "nps", label: "NPS", icon: MessageSquare },
  { value: "conformidade", label: "Conformidade", icon: ClipboardCheck },
  { value: "planos", label: "Planos de Ação", icon: ListChecks },
] as const;

function PlaceholderCard({ name }: { name: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="flex min-h-[280px] items-center justify-center p-10">
        <p className="text-center text-base font-medium text-muted-foreground">
          {name} — em construção
        </p>
      </CardContent>
    </Card>
  );
}

export function PainelMetasTab(_props: PainelMetasTabProps) {
  return (
    <Tabs defaultValue="visao-geral" className="space-y-4">
      <TabsList className="h-auto w-full justify-start gap-1 bg-muted/40 p-1 flex-wrap">
        {SUBTABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {SUBTABS.map(({ value, label }) => (
        <TabsContent key={value} value={value} className="mt-4">
          <PlaceholderCard name={label} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
