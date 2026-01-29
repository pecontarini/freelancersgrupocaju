import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Shield,
  Star,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Filter,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReclamacoes, Reclamacao } from "@/hooks/useReclamacoes";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { useActionPlans } from "@/hooks/useActionPlans";
import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// Brand grouping patterns
const BRAND_PATTERNS: Record<string, RegExp> = {
  "CAJU LIMÃO": /caju/i,
  "CAMINITO PARRILLA": /caminito/i,
  "NAZO JAPANESE": /nazo/i,
  "FOSTERS BURGUER": /foster|frango/i,
};

interface BrandGroup {
  brand: string;
  stores: { id: string; nome: string }[];
}

function getStoresByBrand(lojas: { id: string; nome: string }[]): BrandGroup[] {
  const groups: BrandGroup[] = [];
  const usedIds = new Set<string>();

  for (const [brand, pattern] of Object.entries(BRAND_PATTERNS)) {
    const stores = lojas.filter(
      (l) => pattern.test(l.nome) && !usedIds.has(l.id)
    );
    stores.forEach((s) => usedIds.add(s.id));
    if (stores.length > 0) {
      groups.push({ brand, stores });
    }
  }

  // Add remaining stores as "Outras"
  const remaining = lojas.filter((l) => !usedIds.has(l.id));
  if (remaining.length > 0) {
    groups.push({ brand: "OUTRAS", stores: remaining });
  }

  return groups;
}

// Color helpers for health status
function getHealthColor(percentage: number): string {
  if (percentage >= 90) return "text-emerald-600";
  if (percentage >= 70) return "text-amber-500";
  return "text-destructive";
}

function getHealthBg(percentage: number): string {
  if (percentage >= 90) return "bg-emerald-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-destructive";
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ExecutiveNetworkDashboard() {
  const isMobile = useIsMobile();
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const currentMonth = format(new Date(), "yyyy-MM");

  const { options: lojas } = useConfigLojas();
  const { reclamacoes, isLoading: isLoadingReclamacoes } = useReclamacoes(undefined, currentMonth);
  const { audits, isLoadingAudits } = useSupervisionAudits();
  const { actionPlans, isLoading: isLoadingPlans } = useActionPlans();
  const { entries: freelancerEntries } = useFreelancerEntries();
  const { budgets } = useStoreBudgets();

  // Group stores by brand
  const brandGroups = useMemo(() => getStoresByBrand(lojas), [lojas]);

  // Filter stores by selected brand
  const filteredLojaIds = useMemo(() => {
    if (selectedBrand === "all") {
      return lojas.map((l) => l.id);
    }
    const group = brandGroups.find((g) => g.brand === selectedBrand);
    return group ? group.stores.map((s) => s.id) : [];
  }, [selectedBrand, brandGroups, lojas]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    // Filter data by selected brand
    const filteredAudits = audits.filter((a) => filteredLojaIds.includes(a.loja_id));
    const filteredReclamacoes = reclamacoes.filter((r) =>
      filteredLojaIds.includes(r.loja_id)
    );
    const filteredPlans = actionPlans.filter((p) => filteredLojaIds.includes(p.loja_id));
    const filteredFreelancers = freelancerEntries.filter(
      (e) => e.loja_id && filteredLojaIds.includes(e.loja_id)
    );

    // Global Supervision Score (weighted average)
    const avgSupervision =
      filteredAudits.length > 0
        ? filteredAudits.reduce((sum, a) => sum + a.global_score, 0) / filteredAudits.length
        : 0;

    // Total Complaints
    const totalReclamacoes = filteredReclamacoes.length;
    const gravesCount = filteredReclamacoes.filter((r) => r.is_grave).length;

    // Action Plan Resolution Rate
    const resolvedPlans = filteredPlans.filter((p) => p.status === "resolved").length;
    const totalPlans = filteredPlans.length;
    const resolutionRate = totalPlans > 0 ? (resolvedPlans / totalPlans) * 100 : 0;

    // Pending action plans
    const pendingPlans = filteredPlans.filter((p) => p.status === "pending").length;

    // Freelancer spend vs budget
    const totalSpent = filteredFreelancers.reduce((sum, e) => sum + e.valor, 0);
    const totalBudget = budgets
      .filter((b) => filteredLojaIds.includes(b.store_id))
      .reduce((sum, b) => sum + b.freelancer_budget, 0);
    const budgetEfficiency = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      avgSupervision,
      totalReclamacoes,
      gravesCount,
      resolutionRate,
      resolvedPlans,
      totalPlans,
      pendingPlans,
      totalSpent,
      totalBudget,
      budgetEfficiency,
    };
  }, [audits, reclamacoes, actionPlans, freelancerEntries, budgets, filteredLojaIds]);

  // Rankings by store
  const rankings = useMemo(() => {
    // Supervision ranking
    const supervisionByStore: Record<string, { score: number; count: number }> = {};
    audits.forEach((a) => {
      if (!filteredLojaIds.includes(a.loja_id)) return;
      if (!supervisionByStore[a.loja_id]) {
        supervisionByStore[a.loja_id] = { score: 0, count: 0 };
      }
      supervisionByStore[a.loja_id].score += a.global_score;
      supervisionByStore[a.loja_id].count += 1;
    });

    const supervisionRanking = Object.entries(supervisionByStore)
      .map(([lojaId, data]) => ({
        lojaId,
        lojaNome: lojas.find((l) => l.id === lojaId)?.nome || "Desconhecida",
        avgScore: data.score / data.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const topSupervision = supervisionRanking.slice(0, 3);
    const bottomSupervision = supervisionRanking.slice(-3).reverse();

    // Complaints ranking
    const complaintsByStore: Record<string, number> = {};
    reclamacoes.forEach((r) => {
      if (!filteredLojaIds.includes(r.loja_id)) return;
      complaintsByStore[r.loja_id] = (complaintsByStore[r.loja_id] || 0) + 1;
    });

    const complaintRanking = Object.entries(complaintsByStore)
      .map(([lojaId, count]) => ({
        lojaId,
        lojaNome: lojas.find((l) => l.id === lojaId)?.nome || "Desconhecida",
        count,
      }))
      .sort((a, b) => a.count - b.count);

    const leastComplaints = complaintRanking.slice(0, 3);
    const mostComplaints = complaintRanking.slice(-3).reverse();

    return {
      topSupervision,
      bottomSupervision,
      leastComplaints,
      mostComplaints,
    };
  }, [audits, reclamacoes, lojas, filteredLojaIds]);

  // Global Pareto (top pain points across network)
  const globalPareto = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    reclamacoes
      .filter((r) => filteredLojaIds.includes(r.loja_id))
      .forEach((r) => {
        r.temas?.forEach((tema: string) => {
          tagCounts[tema] = (tagCounts[tema] || 0) + 1;
        });
      });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [reclamacoes, filteredLojaIds]);

  // Severity matrix (grave complaints by type)
  const severityMatrix = useMemo(() => {
    const matrix: Record<string, number> = {};
    reclamacoes
      .filter((r) => r.is_grave && filteredLojaIds.includes(r.loja_id))
      .forEach((r) => {
        r.temas?.forEach((tema: string) => {
          matrix[tema] = (matrix[tema] || 0) + 1;
        });
      });

    return Object.entries(matrix)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [reclamacoes, filteredLojaIds]);

  // Lead time calculation (average time to resolve action plans)
  const avgLeadTime = useMemo(() => {
    const resolvedWithTime = actionPlans.filter(
      (p) => p.status === "resolved" && p.resolved_at && filteredLojaIds.includes(p.loja_id)
    );

    if (resolvedWithTime.length === 0) return null;

    const totalHours = resolvedWithTime.reduce((sum, p) => {
      const created = new Date(p.created_at).getTime();
      const resolved = new Date(p.resolved_at!).getTime();
      return sum + (resolved - created) / (1000 * 60 * 60);
    }, 0);

    return Math.round(totalHours / resolvedWithTime.length);
  }, [actionPlans, filteredLojaIds]);

  const isLoading = isLoadingReclamacoes || isLoadingAudits || isLoadingPlans;

  return (
    <div className="space-y-6">
      {/* Brand Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Dashboard Executivo</h2>
          <p className="text-sm text-muted-foreground">
            Visão consolidada da rede - {format(new Date(), "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Marcas</SelectItem>
              {brandGroups.map((group) => (
                <SelectItem key={group.brand} value={group.brand}>
                  {group.brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Global KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Supervision Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Shield className="h-4 w-4" />
              Supervisão Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold", getHealthColor(kpis.avgSupervision))}>
                {kpis.avgSupervision.toFixed(0)}%
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  kpis.avgSupervision >= 80 ? "border-emerald-500 text-emerald-600" : "border-destructive text-destructive"
                )}
              >
                {kpis.avgSupervision >= 80 ? "✓ Meta" : "⚠ Abaixo"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Média ponderada de todas as unidades
            </p>
          </CardContent>
        </Card>

        {/* NPS / Complaints */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Star className="h-4 w-4" />
              Reclamações do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{kpis.totalReclamacoes}</span>
              {kpis.gravesCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {kpis.gravesCount} graves
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Total de feedbacks negativos na rede
            </p>
          </CardContent>
        </Card>

        {/* Action Plan Resolution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Planos de Ação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-bold", getHealthColor(kpis.resolutionRate))}>
                {kpis.resolutionRate.toFixed(0)}%
              </span>
              <span className="text-sm text-muted-foreground">resolvidos</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Badge variant="outline" className="text-xs">
                {kpis.resolvedPlans}/{kpis.totalPlans} concluídos
              </Badge>
              {kpis.pendingPlans > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {kpis.pendingPlans} pendentes
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial Efficiency */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Eficiência Financeira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-3xl font-bold",
                  kpis.budgetEfficiency <= 90 ? "text-emerald-600" : kpis.budgetEfficiency <= 100 ? "text-amber-500" : "text-destructive"
                )}
              >
                {kpis.budgetEfficiency.toFixed(0)}%
              </span>
              <span className="text-sm text-muted-foreground">do budget</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(kpis.totalSpent)} / {formatCurrency(kpis.totalBudget)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="rankings" className="space-y-4">
        <TabsList className={cn("grid w-full", isMobile ? "grid-cols-2" : "grid-cols-3")}>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="risks">Gestão de Riscos</TabsTrigger>
          {!isMobile && <TabsTrigger value="leadtime">Lead Time</TabsTrigger>}
        </TabsList>

        {/* Rankings Tab */}
        <TabsContent value="rankings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Supervision */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Top 3 Supervisão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.topSupervision.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados de auditoria</p>
                ) : (
                  rankings.topSupervision.map((store, idx) => (
                    <div
                      key={store.lojaId}
                      className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/20"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium truncate max-w-[150px]">{store.lojaNome}</span>
                      </div>
                      <Badge className="bg-emerald-600">{store.avgScore.toFixed(0)}%</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Bottom Supervision */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Bottom 3 Supervisão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.bottomSupervision.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados de auditoria</p>
                ) : (
                  rankings.bottomSupervision.map((store, idx) => (
                    <div
                      key={store.lojaId}
                      className="flex items-center justify-between rounded-lg bg-red-50 p-3 dark:bg-red-950/20"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                          {rankings.topSupervision.length - idx}
                        </span>
                        <span className="text-sm font-medium truncate max-w-[150px]">{store.lojaNome}</span>
                      </div>
                      <Badge variant="destructive">{store.avgScore.toFixed(0)}%</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Least Complaints */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 text-emerald-600" />
                  Menos Reclamações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.leastComplaints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem reclamações registradas</p>
                ) : (
                  rankings.leastComplaints.map((store, idx) => (
                    <div
                      key={store.lojaId}
                      className="flex items-center justify-between rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/20"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium truncate max-w-[150px]">{store.lojaNome}</span>
                      </div>
                      <Badge className="bg-emerald-600">{store.count} queixas</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Most Complaints */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Mais Reclamações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.mostComplaints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem reclamações registradas</p>
                ) : (
                  rankings.mostComplaints.map((store, idx) => (
                    <div
                      key={store.lojaId}
                      className="flex items-center justify-between rounded-lg bg-red-50 p-3 dark:bg-red-950/20"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium truncate max-w-[150px]">{store.lojaNome}</span>
                      </div>
                      <Badge variant="destructive">{store.count} queixas</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risks Tab */}
        <TabsContent value="risks" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Severity Matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Matriz de Gravidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {severityMatrix.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhuma reclamação grave registrada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {severityMatrix.map((item, idx) => (
                      <div
                        key={item.tag}
                        className="flex items-center justify-between rounded-lg bg-red-50 p-3 dark:bg-red-950/20"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">
                            #{item.tag}
                          </Badge>
                        </div>
                        <span className="text-sm font-bold text-destructive">{item.count}x</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Global Pareto Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  Pareto: Dores da Operação
                </CardTitle>
              </CardHeader>
              <CardContent>
                {globalPareto.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Sem dados de reclamações
                  </p>
                ) : (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={globalPareto} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                        <XAxis type="number" />
                        <YAxis
                          type="category"
                          dataKey="tag"
                          width={80}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => `#${v}`.substring(0, 12)}
                        />
                        <Tooltip
                          formatter={(value: number) => [value, "Ocorrências"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {globalPareto.map((entry, index) => (
                            <Cell key={entry.tag} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lead Time on Mobile within Risks tab */}
          {isMobile && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  Lead Time de Resolução
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-4">
                  <span className="text-4xl font-bold text-primary">
                    {avgLeadTime !== null ? `${avgLeadTime}h` : "—"}
                  </span>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tempo médio para resolver Planos de Ação
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Lead Time Tab (Desktop only) */}
        {!isMobile && (
          <TabsContent value="leadtime" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    Lead Time Médio de Resolução
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-8">
                    <span className="text-6xl font-bold text-primary">
                      {avgLeadTime !== null ? `${avgLeadTime}h` : "—"}
                    </span>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Tempo médio para os gerentes resolverem um Plano de Ação
                    </p>
                    {avgLeadTime !== null && avgLeadTime > 24 && (
                      <Badge variant="destructive" className="mt-4">
                        Acima da meta de 24h
                      </Badge>
                    )}
                    {avgLeadTime !== null && avgLeadTime <= 24 && (
                      <Badge className="mt-4 bg-emerald-600">
                        Dentro da meta de 24h
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Resumo de Planos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-[200px] items-center justify-center">
                    {kpis.totalPlans === 0 ? (
                      <p className="text-muted-foreground">Nenhum plano de ação criado</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Resolvidos", value: kpis.resolvedPlans, fill: "hsl(var(--chart-2))" },
                              { name: "Pendentes", value: kpis.pendingPlans, fill: "hsl(var(--chart-1))" },
                              {
                                name: "Em Análise",
                                value: kpis.totalPlans - kpis.resolvedPlans - kpis.pendingPlans,
                                fill: "hsl(var(--chart-3))",
                              },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
