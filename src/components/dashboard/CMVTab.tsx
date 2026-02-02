import { Package, FileUp, ShoppingCart, History, BarChart3, CalendarCheck, ClipboardCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CMVItemForm, 
  CMVInventoryForm, 
  CMVSalesMappingList,
  CMVNFeProcessor,
  CMVSalesProcessor,
  CMVPriceHistory,
  CMVAnalyticsDashboard,
  CMVPeriodOpening
} from "@/components/cmv";
import { useUserProfile } from "@/hooks/useUserProfile";

export function CMVTab() {
  const { isAdmin, isGerenteUnidade } = useUserProfile();

  // Both admin and gerente can access inventory
  const canAccessInventory = isAdmin || isGerenteUnidade;

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
      <Tabs defaultValue="abertura" className="space-y-6">
        <TabsList className="grid w-full grid-cols-8 max-w-5xl">
          <TabsTrigger value="abertura" className="flex items-center gap-1">
            <CalendarCheck className="h-3 w-3" />
            <span className="hidden sm:inline">Abertura</span>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
          <TabsTrigger value="nfe" className="flex items-center gap-1">
            <FileUp className="h-3 w-3" />
            <span className="hidden sm:inline">NFe</span>
          </TabsTrigger>
          <TabsTrigger value="vendas" className="flex items-center gap-1">
            <ShoppingCart className="h-3 w-3" />
            <span className="hidden sm:inline">Vendas</span>
          </TabsTrigger>
          <TabsTrigger value="inventario" className="flex items-center gap-1">
            <ClipboardCheck className="h-3 w-3" />
            <span className="hidden sm:inline">Contagem</span>
          </TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="mapeamentos">Mapeamentos</TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-1">
            <History className="h-3 w-3" />
            <span className="hidden sm:inline">Preços</span>
          </TabsTrigger>
        </TabsList>

        {/* Abertura de Período */}
        <TabsContent value="abertura" className="space-y-6">
          {canAccessInventory ? (
            <CMVPeriodOpening />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Acesso restrito</p>
            </div>
          )}
        </TabsContent>

        {/* Dashboard de Auditoria */}
        <TabsContent value="auditoria" className="space-y-6">
          <CMVAnalyticsDashboard />
        </TabsContent>

        {/* Scanner de NFe */}
        <TabsContent value="nfe" className="space-y-6">
          {isAdmin ? (
            <CMVNFeProcessor />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Apenas administradores podem processar notas fiscais</p>
            </div>
          )}
        </TabsContent>

        {/* Processador de Vendas */}
        <TabsContent value="vendas" className="space-y-6">
          {isAdmin ? (
            <CMVSalesProcessor />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Apenas administradores podem processar relatórios de vendas</p>
            </div>
          )}
        </TabsContent>

        {/* Inventário / Contagem */}
        <TabsContent value="inventario" className="space-y-6">
          {canAccessInventory ? (
            <CMVInventoryForm />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Acesso restrito</p>
            </div>
          )}
        </TabsContent>

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

        {/* Mapeamentos de Vendas */}
        <TabsContent value="mapeamentos" className="space-y-6">
          <CMVSalesMappingList />
        </TabsContent>

        {/* Histórico de Preços */}
        <TabsContent value="historico" className="space-y-6">
          <CMVPriceHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
