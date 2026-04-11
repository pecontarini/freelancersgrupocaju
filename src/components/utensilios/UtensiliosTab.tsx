import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

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
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Módulo de contagem semanal de utensílios — em construção.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="budget">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Controle de budget de utensílios — em construção.
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="historico">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Histórico de contagens — em construção.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
