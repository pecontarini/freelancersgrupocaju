import { Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CMVItemForm, CMVInventoryForm, CMVSalesMappingList } from "@/components/cmv";
import { useUserProfile } from "@/hooks/useUserProfile";

export function CMVTab() {
  const { isAdmin } = useUserProfile();

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">
            CMV (Unitários)
          </h2>
          <p className="text-muted-foreground">
            Controle de insumos e estoque de carnes
          </p>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="cadastro" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="inventario">Inventário</TabsTrigger>
          <TabsTrigger value="mapeamentos">Mapeamentos</TabsTrigger>
        </TabsList>

        {/* Cadastro de Itens */}
        <TabsContent value="cadastro" className="space-y-6">
          {isAdmin ? (
            <CMVItemForm />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Apenas administradores podem gerenciar o cadastro de itens</p>
            </div>
          )}
        </TabsContent>

        {/* Inventário */}
        <TabsContent value="inventario" className="space-y-6">
          {isAdmin ? (
            <CMVInventoryForm />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Apenas administradores podem gerenciar o inventário</p>
            </div>
          )}
        </TabsContent>

        {/* Mapeamentos de Vendas */}
        <TabsContent value="mapeamentos" className="space-y-6">
          <CMVSalesMappingList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
