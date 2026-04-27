import { Package, FileUp, ShoppingCart, History, BarChart3, Settings, ClipboardCheck, Calendar, Link2, Activity, FileText, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CMVItemForm, 
  CMVInventoryForm, 
  CMVSalesMappingHub,
  CMVNFeProcessor,
  CMVSalesProcessor,
  CMVPriceHistory,
  CMVAnalyticsDashboard,
  CMVPeriodOpening,
  CMVUnitHeader,
  CMVDailyCountForm,
  CMVPeriodAudit,
  CMVSalesImporter,
  CMVProductMappingHub,
  CMVSmartSalesImporter,
  CMVUnmappedAlert,
  CMVSalesDashboard,
  CMVKardexDashboard,
  CMVClosingReport,
  CMVLiveStockCard,
  CMVContagemCarnes,
} from "@/components/cmv";
import { CMVAIAssistant } from "@/components/cmv/CMVAIAssistant";
import { CMVResetZone } from "@/components/cmv/CMVResetZone";
import { useUnmappedSalesItems } from "@/hooks/useUnmappedSalesItems";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useCMVPendingItems } from "@/hooks/useCMVPendingItems";
import { Badge } from "@/components/ui/badge";

export function CMVTab() {
  const { isAdmin, isGerenteUnidade } = useUserProfile();
  const { effectiveUnidadeId } = useUnidade();
  const { pendingItems } = useCMVPendingItems();
  const { data: unmappedItems = [] } = useUnmappedSalesItems(effectiveUnidadeId || undefined);

  // Both admin and gerente can access operational features
  const canAccessOperational = isAdmin || isGerenteUnidade;
  
  // Function to switch to Vinculos tab (used by alert)
  const handleNavigateToMapping = () => {
    // This will be handled by the Tabs component's value
    const vinculosTab = document.querySelector('[data-state="inactive"][value="vinculos"]') as HTMLButtonElement;
    if (vinculosTab) vinculosTab.click();
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Package className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">
            CMV Carnes
          </h2>
          <p className="text-muted-foreground">
            Controle de estoque e custos de porcionados
          </p>
        </div>
      </div>

      {/* Unit Selection Header - Always Visible */}
      <CMVUnitHeader />

      {/* Main Content with Tabs */}
      <Tabs defaultValue="operacional" className="space-y-6">
        <TabsList className="grid w-full grid-cols-9 max-w-5xl">
          <TabsTrigger value="operacional" className="flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Operacional</span>
          </TabsTrigger>
          <TabsTrigger value="ia" className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">IA</span>
          </TabsTrigger>
          <TabsTrigger value="kardex" className="flex items-center gap-1.5">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Kardex</span>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
          <TabsTrigger value="fechamento" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Fechamento</span>
          </TabsTrigger>
          <TabsTrigger value="entradas" className="flex items-center gap-1.5">
            <FileUp className="h-4 w-4" />
            <span className="hidden sm:inline">Entradas</span>
          </TabsTrigger>
          <TabsTrigger value="saidas" className="flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Saídas</span>
          </TabsTrigger>
          <TabsTrigger value="vinculos" className="flex items-center gap-1.5 relative">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Vínculos</span>
            {unmappedItems.length > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 text-xs px-1">
                {unmappedItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
        </TabsList>

        {/* ====== ABA 1: OPERACIONAL (Abertura + Contagem) ====== */}
        <TabsContent value="operacional" className="space-y-6">
        {!effectiveUnidadeId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma unidade acima</p>
                <p className="text-sm">Para gerenciar estoque inicial e contagens</p>
              </CardContent>
            </Card>
          ) : canAccessOperational ? (
            <div className="space-y-6">
              {/* Alert for unmapped items */}
              {unmappedItems.length > 0 && (
                <CMVUnmappedAlert onNavigateToMapping={handleNavigateToMapping} />
              )}

              {/* Guide Card */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    Fluxo de Trabalho
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                    <p><strong>Contagem Diária:</strong> Registre a contagem física todos os dias (salva o custo vigente).</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                    <p><strong>Entradas (NFe):</strong> Faça upload das notas fiscais para registrar recebimentos.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                    <p><strong>Saídas (Vendas):</strong> Processe relatórios de vendas para baixa teórica do estoque.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                    <p><strong>Auditoria:</strong> Selecione um período para calcular divergências e prejuízos.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Contagem de Carnes por Turno */}
              <CMVContagemCarnes />

              {/* Live Stock Valuation */}
              <CMVLiveStockCard />

              {/* Daily Count Form */}
              <CMVDailyCountForm />

              {/* Period Opening / Initial Stock - Keep for backward compatibility */}
              <CMVPeriodOpening />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Acesso restrito</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====== ABA: IA CMV (Análise de desvio + plano de ação) ====== */}
        <TabsContent value="ia" className="space-y-6">
          <CMVAIAssistant />
        </TabsContent>

        {/* ====== ABA: KARDEX (Timeline de Movimentação) ====== */}
        <TabsContent value="kardex" className="space-y-6">
          {!effectiveUnidadeId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma unidade acima</p>
                <p className="text-sm">Para visualizar o kardex de movimentação</p>
              </CardContent>
            </Card>
          ) : (
            <CMVKardexDashboard />
          )}
        </TabsContent>

        {/* ====== ABA 2: AUDITORIA (Dashboard BI + Auditoria por Período) ====== */}
        <TabsContent value="auditoria" className="space-y-6">
          {/* Period Audit - Flexible Date Range */}
          <CMVPeriodAudit />
          
          {/* BI Dashboard */}
          <CMVAnalyticsDashboard />
        </TabsContent>

        {/* ====== ABA: FECHAMENTO CMV ====== */}
        <TabsContent value="fechamento" className="space-y-6">
          <CMVClosingReport />
        </TabsContent>

        {/* ====== ABA 3: ENTRADAS (NFe Scanner) ====== */}
        <TabsContent value="entradas" className="space-y-6">
          {!effectiveUnidadeId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma unidade acima</p>
                <p className="text-sm">Para registrar entradas de notas fiscais</p>
              </CardContent>
            </Card>
          ) : canAccessOperational ? (
            <div className="space-y-4">
              <Alert>
                <FileUp className="h-4 w-4" />
                <AlertTitle>Registrar Entrada de Mercadorias</AlertTitle>
                <AlertDescription>
                  Faça upload da NFe (foto ou PDF) para extrair automaticamente os itens e quantidades.
                  O sistema irá vincular à unidade selecionada e atualizar o estoque.
                </AlertDescription>
              </Alert>
              <CMVNFeProcessor />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Acesso restrito</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====== ABA 4: SAÍDAS (Vendas) ====== */}
        <TabsContent value="saidas" className="space-y-6">
          {!effectiveUnidadeId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma unidade acima</p>
                <p className="text-sm">Para processar baixa de vendas</p>
              </CardContent>
            </Card>
          ) : canAccessOperational ? (
            <div className="space-y-4">
              <Alert>
                <ShoppingCart className="h-4 w-4" />
                <AlertTitle>Processar Relatório de Vendas</AlertTitle>
                <AlertDescription>
                  Faça upload do relatório de vendas (CSV ou PDF) para dar baixa teórica no estoque.
                  O sistema usa UPSERT para evitar duplicidade de registros.
                </AlertDescription>
              </Alert>
              
              {/* Sales Dashboard */}
              <CMVSalesDashboard />
              
              {/* Smart Sales Importer with column mapping */}
              <CMVSmartSalesImporter />
              
              {/* Legacy PDF Processor (kept for compatibility) */}
              <CMVSalesProcessor />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Apenas administradores e gerentes podem processar relatórios de vendas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====== ABA 5: VÍNCULOS (Central de Mapeamentos De-Para) ====== */}
        <TabsContent value="vinculos" className="space-y-6">
          {canAccessOperational ? (
            <CMVProductMappingHub />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Apenas administradores e gerentes podem gerenciar vínculos</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====== ABA 6: CONFIGURAÇÕES (Cadastro + Preços) ====== */}
        <TabsContent value="configuracoes" className="space-y-6">
          {isAdmin ? (
            <div className="space-y-6">
              {/* Sub-tabs for configuration */}
              <Tabs defaultValue="cadastro" className="space-y-4">
                <TabsList className="w-full max-w-md">
                  <TabsTrigger value="cadastro" className="flex-1">
                    <Package className="h-4 w-4 mr-2" />
                    Cadastro de Itens
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="flex-1">
                    <History className="h-4 w-4 mr-2" />
                    Histórico de Preços
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="cadastro">
                  <CMVItemForm />
                </TabsContent>

                <TabsContent value="historico">
                  <CMVPriceHistory />
                </TabsContent>
              </Tabs>

              <CMVResetZone />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Apenas administradores podem gerenciar configurações</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
