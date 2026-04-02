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
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "@/lib/logoBase64";

export function CMVAnalyticsDashboard() {
  const { isAdmin, unidades } = useUserProfile();
  const { options: lojas } = useConfigLojas();
  const [selectedLojaId, setSelectedLojaId] = useState<string>("");

  // Filter stores based on user role
  const availableStores = isAdmin ? lojas : unidades;
  const selectedStoreName = availableStores.find((s) => s.id === selectedLojaId)?.nome || "";

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

  // Export to CSV
  const exportToCSV = (type: "reconciliation" | "entries" | "inventory") => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = "";

    const today = format(new Date(), "yyyy-MM-dd");

    switch (type) {
      case "reconciliation":
        headers = ["Item", "Categoria", "Est. Inicial", "Entradas", "Saídas", "Esperado", "Contagem", "Divergência", "Prejuízo (R$)"];
        rows = reconciliationData.map((r) => [
          r.itemName,
          r.categoria,
          r.estoqueInicial,
          r.entradasNfe,
          r.saidasVendas,
          r.estoqueEsperado,
          r.contagemReal,
          r.divergencia,
          r.prejuizo.toFixed(2),
        ]);
        filename = `CMV_Conciliacao_${selectedStoreName}_${today}.csv`;
        break;
      case "entries":
        headers = ["Data", "Item", "Categoria", "Quantidade", "Preço Unit.", "Referência NFe"];
        rows = entriesReport.map((e: any) => [
          format(parseISO(e.data_movimento), "dd/MM/yyyy"),
          e.cmv_item?.nome || "",
          e.cmv_item?.categoria || "",
          e.quantidade,
          e.preco_unitario?.toFixed(2) || "",
          e.referencia || "",
        ]);
        filename = `CMV_Entradas_${selectedStoreName}_${today}.csv`;
        break;
      case "inventory":
        headers = ["Item", "Categoria", "Esperado", "Contagem", "Preço Unit.", "Valor Estoque", "Status"];
        rows = reconciliationData.map((r) => [
          r.itemName,
          r.categoria,
          r.estoqueEsperado,
          r.contagemReal,
          r.precoCusto.toFixed(2),
          (r.contagemReal * r.precoCusto).toFixed(2),
          r.divergencia === 0 ? "Conciliado" : r.divergencia > 0 ? `Furo (${r.divergencia})` : `Sobra (${Math.abs(r.divergencia)})`,
        ]);
        filename = `CMV_Inventario_${selectedStoreName}_${today}.csv`;
        break;
    }

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast.success("CSV exportado com sucesso!");
  };

  // Export to PDF
  const exportToPDF = (type: "reconciliation" | "entries" | "inventory") => {
    const doc = new jsPDF();
    const today = format(new Date(), "dd/MM/yyyy");
    let filename = "";

    // Add logo
    try {
      doc.addImage(LOGO_BASE64, "PNG", 14, 10, 30, 30);
    } catch {
      // Continue without logo
    }

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");

    let title = "";
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    switch (type) {
      case "reconciliation":
        title = `RELATÓRIO DE CONCILIAÇÃO CMV - ${selectedStoreName.toUpperCase()}`;
        headers = ["Item", "Inicial", "Entradas", "Saídas", "Esperado", "Contagem", "Diverg.", "Prejuízo"];
        rows = reconciliationData.map((r) => [
          r.itemName.slice(0, 20),
          r.estoqueInicial,
          r.entradasNfe,
          r.saidasVendas,
          r.estoqueEsperado,
          r.contagemReal,
          r.divergencia,
          formatCurrency(r.prejuizo),
        ]);
        filename = `CMV_Conciliacao_${selectedStoreName}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
        break;
      case "entries":
        title = `RELATÓRIO DE ENTRADAS (NFe) - ${selectedStoreName.toUpperCase()}`;
        headers = ["Data", "Item", "Categoria", "Qtd", "Preço", "NFe"];
        rows = entriesReport.map((e: any) => [
          format(parseISO(e.data_movimento), "dd/MM"),
          (e.cmv_item?.nome || "").slice(0, 20),
          e.cmv_item?.categoria || "",
          e.quantidade,
          e.preco_unitario ? formatCurrency(e.preco_unitario) : "-",
          e.referencia?.slice(0, 15) || "-",
        ]);
        filename = `CMV_Entradas_${selectedStoreName}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
        break;
      case "inventory":
        title = `POSIÇÃO DE ESTOQUE CMV - ${selectedStoreName.toUpperCase()}`;
        headers = ["Item", "Esperado", "Contagem", "Preço", "Valor Est.", "Status"];
        rows = reconciliationData.map((r) => [
          r.itemName.slice(0, 20),
          r.estoqueEsperado,
          r.contagemReal,
          formatCurrency(r.precoCusto),
          formatCurrency(r.contagemReal * r.precoCusto),
          r.divergencia === 0 ? "OK" : r.divergencia > 0 ? `Furo (${r.divergencia})` : `Sobra`,
        ]);
        filename = `CMV_Inventario_${selectedStoreName}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
        break;
    }

    doc.text(title, 50, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${today}`, 50, 32);

    // Summary box for reconciliation
    if (type === "reconciliation") {
      doc.setFillColor(254, 226, 226); // Light red
      doc.rect(14, 45, 80, 20, "F");
      doc.setFontSize(9);
      doc.text("PREJUÍZO TOTAL", 18, 52);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text(formatCurrency(totalPrejuizo), 18, 60);
      doc.setTextColor(0, 0, 0);

      doc.setFillColor(220, 252, 231); // Light green
      doc.rect(100, 45, 80, 20, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("ACURACIDADE", 104, 52);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 163, 74);
      doc.text(`${summaryStats.accuracyRate}%`, 104, 60);
      doc.setTextColor(0, 0, 0);
    }

    // Table
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: type === "reconciliation" ? 72 : 45,
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: type === "reconciliation" ? {
        6: { halign: "center" },
        7: { halign: "right" },
      } : {},
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Página ${i} de ${pageCount} | CajuPAR - CMV Carnes`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    }

    doc.save(filename);
    toast.success("PDF exportado com sucesso!");
  };

  return (
    <div className="space-y-6">
      {/* Store Filter */}
      <Card className="rounded-2xl shadow-card">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px] max-w-xs">
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
                Caminito
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
                  (Divergência × Custo Atualizado)
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
                  Valor em Estoque
                </CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(
                    reconciliationData.reduce(
                      (sum, r) => sum + r.contagemReal * r.precoCusto,
                      0
                    )
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {reconciliationData.reduce((sum, r) => sum + r.contagemReal, 0)} unidades
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
                  Top Furos (Prejuízo)
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
                        <XAxis type="number" tickFormatter={(v) => `R$${v}`} />
                        <YAxis
                          type="category"
                          dataKey="itemName"
                          width={100}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            formatCurrency(value),
                            "Prejuízo",
                          ]}
                          labelFormatter={(label) => `${label}`}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-background border rounded-lg p-3 shadow-lg">
                                  <p className="font-semibold">{label}</p>
                                  <p className="text-red-600">
                                    Prejuízo: {formatCurrency(data.prejuizoReais)}
                                  </p>
                                  <p className="text-muted-foreground text-sm">
                                    Divergência: {data.divergenciaUnidades} unidades
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
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
                  Evolução Semanal (8 semanas)
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
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-bold uppercase">
                <FileText className="h-5 w-5" />
                Relatórios Consolidados
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportToPDF("reconciliation")}>
                    <FileText className="h-4 w-4 mr-2" />
                    Conciliação (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToCSV("reconciliation")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Conciliação (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToPDF("entries")}>
                    <FileText className="h-4 w-4 mr-2" />
                    Entradas (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToCSV("entries")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Entradas (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToPDF("inventory")}>
                    <FileText className="h-4 w-4 mr-2" />
                    Inventário (PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToCSV("inventory")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Inventário (CSV)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="reconciliation" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 max-w-lg">
                  <TabsTrigger value="reconciliation">Conciliação</TabsTrigger>
                  <TabsTrigger value="entries">Entradas</TabsTrigger>
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
