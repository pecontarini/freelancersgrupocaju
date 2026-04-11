import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContagemSemanal } from "./ContagemSemanal";
import { ControleBudget } from "./ControleBudget";
import { HistoricoContagens } from "./HistoricoContagens";
import { useIsMobile } from "@/hooks/use-mobile";

export function UtensiliosTab() {
  const [activeTab, setActiveTab] = useState("contagem");
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className={isMobile ? "overflow-x-auto -mx-2 px-2" : ""}>
          <TabsList className={isMobile ? "inline-flex w-auto min-w-full" : "grid w-full grid-cols-3"}>
            <TabsTrigger value="contagem">{isMobile ? "Contagem" : "Contagem Semanal"}</TabsTrigger>
            <TabsTrigger value="budget">{isMobile ? "Budget" : "Controle de Budget"}</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="contagem"><ContagemSemanal /></TabsContent>
        <TabsContent value="budget"><ControleBudget /></TabsContent>
        <TabsContent value="historico"><HistoricoContagens /></TabsContent>
      </Tabs>
    </div>
  );
}
