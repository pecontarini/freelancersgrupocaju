import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Package, UtensilsCrossed } from "lucide-react";
import { BudgetsGerenciaisTab } from "./BudgetsGerenciaisTab";
import { CMVTab } from "./CMVTab";
import { UtensiliosTab } from "@/components/utensilios";
import type { ComponentProps } from "react";

interface UnitariosGerentesTabProps {
  budgetsProps: ComponentProps<typeof BudgetsGerenciaisTab>;
}

export function UnitariosGerentesTab({ budgetsProps }: UnitariosGerentesTabProps) {
  return (
    <Tabs defaultValue="budgets" className="space-y-4">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="budgets" className="gap-1.5">
          <Wallet className="h-4 w-4" />
          Budgets Gerenciais
        </TabsTrigger>
        <TabsTrigger value="cmv" className="gap-1.5">
          <Package className="h-4 w-4" />
          CMV Unitário
        </TabsTrigger>
        <TabsTrigger value="utensilios" className="gap-1.5">
          <UtensilsCrossed className="h-4 w-4" />
          Utensílios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="budgets">
        <BudgetsGerenciaisTab {...budgetsProps} />
      </TabsContent>
      <TabsContent value="cmv">
        <CMVTab />
      </TabsContent>
      <TabsContent value="utensilios">
        <UtensiliosTab />
      </TabsContent>
    </Tabs>
  );
}
