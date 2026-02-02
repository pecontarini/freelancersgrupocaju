import { Package, FileUp, ShoppingCart, History, BarChart3, Settings, ClipboardCheck, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CMVItemForm, 
  CMVInventoryForm, 
  CMVSalesMappingList,
  CMVNFeProcessor,
  CMVSalesProcessor,
  CMVPriceHistory,
  CMVAnalyticsDashboard,
  CMVPeriodOpening,
  CMVUnitHeader,
  CMVDailyCountForm,
  CMVPeriodAudit
} from "@/components/cmv";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUnidade } from "@/contexts/UnidadeContext";

export function CMVTab() {
  const { isAdmin, isGerenteUnidade } = useUserProfile();
  const { effectiveUnidadeId } = useUnidade();

  // Both admin and gerente can access operational features
  const canAccessOperational = isAdmin || isGerenteUnidade;

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
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="operacional" className="flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Operacional</span>
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
          <TabsTrigger value="entradas" className="flex items-center gap-1.5">
            <FileUp className="h-4 w-4" />
            <span className="hidden sm:inline">Entradas</span>
          </TabsTrigger>
          <TabsTrigger value="saidas" className="flex items-center gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Saídas</span>
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
              {/* Guide Card */}
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-blue-600" />
                    Fluxo de Trabalho
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
                    <p><strong>Contagem Diária:</strong> Registre a contagem física todos os dias (salva o custo vigente).</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">2</span>
                    <p><strong>Entradas (NFe):</strong> Faça upload das notas fiscais para registrar recebimentos.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">3</span>
                    <p><strong>Saídas (Vendas):</strong> Processe relatórios de vendas para baixa teórica do estoque.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">4</span>
                    <p><strong>Auditoria:</strong> Selecione um período para calcular divergências e prejuízos.</p>
                  </div>
                </CardContent>
              </Card>

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

        {/* ====== ABA 2: AUDITORIA (Dashboard BI + Auditoria por Período) ====== */}
        <TabsContent value="auditoria" className="space-y-6">
          {/* Period Audit - Flexible Date Range */}
          <CMVPeriodAudit />
          
          {/* BI Dashboard */}
          <CMVAnalyticsDashboard />
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
          ) : isAdmin ? (
            <div className="space-y-4">
              <Alert>
                <ShoppingCart className="h-4 w-4" />
                <AlertTitle>Processar Relatório de Vendas</AlertTitle>
                <AlertDescription>
                  Faça upload do relatório de vendas para dar baixa teórica no estoque.
                  Os itens serão mapeados automaticamente usando as configurações de mapeamento.
                </AlertDescription>
              </Alert>
              <CMVSalesProcessor />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Apenas administradores podem processar relatórios de vendas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====== ABA 5: CONFIGURAÇÕES (Cadastro + Mapeamentos + Preços) ====== */}
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
                  <TabsTrigger value="mapeamentos" className="flex-1">
                    Mapeamentos
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="flex-1">
                    <History className="h-4 w-4 mr-2" />
                    Preços
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="cadastro">
                  <CMVItemForm />
                </TabsContent>

                <TabsContent value="mapeamentos">
                  <CMVSalesMappingList />
                </TabsContent>

                <TabsContent value="historico">
                  <CMVPriceHistory />
                </TabsContent>
              </Tabs>
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
