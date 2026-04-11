import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContagemSemanal } from "./ContagemSemanal";
import { ControleBudget } from "./ControleBudget";
import { HistoricoContagens } from "./HistoricoContagens";

export function UtensiliosTab() {
  const [activeTab, setActiveTab] = useState("contagem");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contagem">Contagem Semanal</TabsTrigger>
          <TabsTrigger value="budget">Controle de Budget</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="contagem">
          <ContagemSemanal />
        </TabsContent>
        <TabsContent value="budget">
          <ControleBudget />
        </TabsContent>
        <TabsContent value="historico">
          <HistoricoContagens />
        </TabsContent>
      </Tabs>
    </div>
  );
}
