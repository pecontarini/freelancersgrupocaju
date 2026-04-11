import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisaoConsolidada } from "./VisaoConsolidada";
import { Movimentacao } from "./Movimentacao";
import { Inventarios } from "./Inventarios";
import { CatalogoItens } from "./CatalogoItens";
import { useIsMobile } from "@/hooks/use-mobile";

export function EstoqueTab() {
  const [activeTab, setActiveTab] = useState("consolidado");
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className={isMobile ? "overflow-x-auto -mx-2 px-2" : ""}>
          <TabsList className={isMobile ? "inline-flex w-auto min-w-full" : "grid w-full grid-cols-4"}>
            <TabsTrigger value="consolidado">{isMobile ? "Consolidado" : "Visão Consolidada"}</TabsTrigger>
            <TabsTrigger value="movimentacao">{isMobile ? "Moviment." : "Movimentação"}</TabsTrigger>
            <TabsTrigger value="inventarios">{isMobile ? "Inventário" : "Inventários"}</TabsTrigger>
            <TabsTrigger value="catalogo">{isMobile ? "Catálogo" : "Catálogo de Itens"}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="consolidado"><VisaoConsolidada /></TabsContent>
        <TabsContent value="movimentacao"><Movimentacao /></TabsContent>
        <TabsContent value="inventarios"><Inventarios /></TabsContent>
        <TabsContent value="catalogo"><CatalogoItens /></TabsContent>
      </Tabs>
    </div>
  );
}
