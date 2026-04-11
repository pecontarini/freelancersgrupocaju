import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisaoConsolidada } from "./VisaoConsolidada";
import { Movimentacao } from "./Movimentacao";
import { Inventarios } from "./Inventarios";
import { CatalogoItens } from "./CatalogoItens";

export function EstoqueTab() {
  const [activeTab, setActiveTab] = useState("consolidado");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="consolidado">Visão Consolidada</TabsTrigger>
          <TabsTrigger value="movimentacao">Movimentação</TabsTrigger>
          <TabsTrigger value="inventarios">Inventários</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo de Itens</TabsTrigger>
        </TabsList>

        <TabsContent value="consolidado">
          <VisaoConsolidada />
        </TabsContent>
        <TabsContent value="movimentacao">
          <Movimentacao />
        </TabsContent>
        <TabsContent value="inventarios">
          <Inventarios />
        </TabsContent>
        <TabsContent value="catalogo">
          <CatalogoItens />
        </TabsContent>
      </Tabs>
    </div>
  );
}
