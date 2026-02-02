import { useState } from "react";
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package,
  BarChart3,
  Target,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useCMVAnalytics, useCMVEntriesReport, useCMVSalesReport } from "@/hooks/useCMVAnalytics";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCurrency } from "@/lib/formatters";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CMVAnalyticsDashboard() {
  const { isAdmin, unidades } = useUserProfile();
  const { options: lojas } = useConfigLojas();
  const [selectedLojaId, setSelectedLojaId] = useState<string>("");

  // Filter stores based on user role
  const availableStores = isAdmin ? lojas : unidades;

  const {
    reconciliationData,
    totalPrejuizo,
    divergenceRanking,
    weeklyAccuracy,
    summaryStats,
  } = useCMVAnalytics(selectedLojaId || undefined);

  const { data: entriesReport = [] } = useCMVEntriesReport(selectedLojaId || undefined);
  const { data: salesReport = [] } = useCMVSalesReport(selectedLojaId || undefined);

  // Colors for charts
  const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

  return (
    <div className="space-y-6">
      {/* Store Filter */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma unidade" />
                </SelectTrigger>
                <SelectContent>
                  {availableStores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedLojaId && (
              <Badge variant="outline" className="text-sm">
                {availableStores.find((s) => s.id === selectedLojaId)?.nome}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedLojaId ? (
        <Card className="rounded-2xl shadow-card">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              Selecione uma unidade para visualizar o dashboard de auditoria CMV
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Loss Card */}
            <Card className="rounded-2xl shadow-card border-l-4 border-l-red-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                  Prejuízo Total
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalPrejuizo)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Baseado em divergências detectadas
                </p>
              </CardContent>
            </Card>

            {/* Items with Divergence */}
            <Card className="rounded-2xl shadow-card border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                  Itens Divergentes
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {summaryStats.itemsWithDivergence}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  de {summaryStats.totalItems} itens monitorados
                </p>
              </CardContent>
            </Card>

            {/* Accuracy Rate */}
            <Card className="rounded-2xl shadow-card border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                  Taxa de Acuracidade
                </CardTitle>
                <Target className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {summaryStats.accuracyRate}%
                </div>
                <div className="flex items-center gap-1 text-xs mt-1">
                  {summaryStats.accuracyTrend >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  <span
                    className={
                      summaryStats.accuracyTrend >= 0 ? "text-green-600" : "text-red-600"
                    }
                  >
                    {summaryStats.accuracyTrend >= 0 ? "+" : ""}
                    {summaryStats.accuracyTrend}% vs semana anterior
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Total Stock Value */}
            <Card className="rounded-2xl shadow-card border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
                  Movimentações
                </CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {entriesReport.length + salesReport.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {entriesReport.length} entradas, {salesReport.length} saídas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Rankings */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Divergence Ranking */}
            <Card className="rounded-2xl shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold uppercase">
                  <BarChart3 className="h-5 w-5 text-red-500" />
                  Top Itens Divergentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {divergenceRanking.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma divergência detectada</p>
                    <p className="text-sm">Estoque está conciliado!</p>
                  </div>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={divergenceRanking}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" />
                        <YAxis
                          type="category"
                          dataKey="itemName"
                          width={100}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), "Prejuízo"]}
                          labelFormatter={(label) => `Item: ${label}`}
                        />
                        <Bar dataKey="prejuizoReais" radius={[0, 4, 4, 0]}>
                          {divergenceRanking.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[Math.min(index, 4)]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weekly Accuracy Chart */}
            <Card className="rounded-2xl shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold uppercase">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Evolução da Acuracidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={weeklyAccuracy}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, "Acuracidade"]}
                        labelFormatter={(label) => `Semana de ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reports Tabs */}
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold uppercase">
                <FileText className="h-5 w-5" />
                Relatórios Consolidados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="reconciliation" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 max-w-lg">
                  <TabsTrigger value="reconciliation">Conciliação</TabsTrigger>
                  <TabsTrigger value="entries">Entradas (NFe)</TabsTrigger>
                  <TabsTrigger value="sales">Vendas</TabsTrigger>
                  <TabsTrigger value="inventory">Posição</TabsTrigger>
                </TabsList>

                {/* Reconciliation Table */}
                <TabsContent value="reconciliation" className="space-y-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Est. Inicial</TableHead>
                          <TableHead className="text-right">Entradas</TableHead>
                          <TableHead className="text-right">Saídas</TableHead>
                          <TableHead className="text-right">Esperado</TableHead>
                          <TableHead className="text-right">Contagem</TableHead>
                          <TableHead className="text-right">Divergência</TableHead>
                          <TableHead className="text-right">Prejuízo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reconciliationData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              Nenhum dado de conciliação disponível
                            </TableCell>
                          </TableRow>
                        ) : (
                          reconciliationData.map((row) => (
                            <TableRow
                              key={row.itemId}
                              className={row.divergencia > 0 ? "bg-red-50 dark:bg-red-950/20" : ""}
                            >
                              <TableCell className="font-medium">
                                {row.itemName}
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {row.categoria}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{row.estoqueInicial}</TableCell>
                              <TableCell className="text-right text-green-600">
                                +{row.entradasNfe}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                -{row.saidasVendas}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {row.estoqueEsperado}
                              </TableCell>
                              <TableCell className="text-right">{row.contagemReal}</TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={
                                    row.divergencia > 0
                                      ? "text-red-600 font-semibold"
                                      : row.divergencia < 0
                                      ? "text-blue-600"
                                      : "text-green-600"
                                  }
                                >
                                  {row.divergencia > 0 ? "+" : ""}
                                  {row.divergencia}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-red-600">
                                {row.prejuizo > 0 ? formatCurrency(row.prejuizo) : "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Entries Report */}
                <TabsContent value="entries" className="space-y-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Preço Unit.</TableHead>
                          <TableHead>Referência NFe</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entriesReport.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Nenhuma entrada registrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          entriesReport.map((entry: any) => (
                            <TableRow key={entry.id}>
                              <TableCell>
                                {format(parseISO(entry.data_movimento), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </TableCell>
                              <TableCell className="font-medium">
                                {entry.cmv_item?.nome || "Item não encontrado"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{entry.cmv_item?.categoria}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-green-600 font-medium">
                                +{entry.quantidade} {entry.cmv_item?.unidade}
                              </TableCell>
                              <TableCell className="text-right">
                                {entry.preco_unitario
                                  ? formatCurrency(entry.preco_unitario)
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {entry.referencia ? (
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm">{entry.referencia}</span>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Sales Report */}
                <TabsContent value="sales" className="space-y-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Quantidade Baixa</TableHead>
                          <TableHead>Referência</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesReport.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Nenhuma saída registrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          salesReport.map((sale: any) => (
                            <TableRow key={sale.id}>
                              <TableCell>
                                {format(parseISO(sale.data_movimento), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </TableCell>
                              <TableCell className="font-medium">
                                {sale.cmv_item?.nome || "Item não encontrado"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{sale.cmv_item?.categoria}</Badge>
                              </TableCell>
                              <TableCell className="text-right text-red-600 font-medium">
                                -{sale.quantidade} {sale.cmv_item?.unidade}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {sale.referencia || "-"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                {/* Inventory Position */}
                <TabsContent value="inventory" className="space-y-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Estoque Esperado</TableHead>
                          <TableHead className="text-right">Contagem Real</TableHead>
                          <TableHead className="text-right">Preço Unitário</TableHead>
                          <TableHead className="text-right">Valor em Estoque</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reconciliationData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              Nenhum item no inventário
                            </TableCell>
                          </TableRow>
                        ) : (
                          reconciliationData.map((row) => (
                            <TableRow key={row.itemId}>
                              <TableCell className="font-medium">{row.itemName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{row.categoria}</Badge>
                              </TableCell>
                              <TableCell className="text-right">{row.estoqueEsperado}</TableCell>
                              <TableCell className="text-right font-medium">
                                {row.contagemReal}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(row.precoCusto)}
                              </TableCell>
                              <TableCell className="text-right font-medium text-blue-600">
                                {formatCurrency(row.contagemReal * row.precoCusto)}
                              </TableCell>
                              <TableCell>
                                {row.divergencia === 0 ? (
                                  <Badge className="bg-green-500">Conciliado</Badge>
                                ) : row.divergencia > 0 ? (
                                  <Badge variant="destructive">Furo ({row.divergencia})</Badge>
                                ) : (
                                  <Badge className="bg-blue-500">Sobra ({Math.abs(row.divergencia)})</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
