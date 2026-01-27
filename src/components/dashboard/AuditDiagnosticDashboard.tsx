import { useState, useMemo } from "react";
import {
  AlertOctagon,
  RotateCcw,
  BarChart3,
  PieChart,
  TrendingDown,
  Filter,
  Building2,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChefHat,
  UtensilsCrossed,
  Warehouse,
  Bath,
  Truck,
  Beer,
  Loader2,
} from "lucide-react";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useSupervisionAudits, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { formatCurrency } from "@/lib/formatters";

interface AuditDiagnosticDashboardProps {
  selectedUnidadeId: string | null;
  isAdmin?: boolean;
}

// Brand patterns for filtering
const BRAND_PATTERNS: Record<string, string[]> = {
  all: [],
  caminito: ["CAMINITO", "MULT"],
  nazo: ["NAZO", "NFE"],
  caju: ["CAJU"],
  fosters: ["FOSTER", "FB"],
};

// Sector categorization based on item keywords
const SECTOR_KEYWORDS: Record<string, string[]> = {
  Cozinha: ["cozinha", "preparo", "alimento", "temperatura", "geladeira", "freezer", "estoque alimentos", "higienização equipamentos", "manipulação"],
  Salão: ["salão", "mesa", "cadeira", "atendimento", "cardápio", "cliente", "ambiente", "decoração"],
  Banheiros: ["banheiro", "sanitário", "wc", "higiene pessoal", "papel", "sabonete", "limpeza sanitária"],
  Estoque: ["estoque", "armazenamento", "validade", "etiqueta", "organização", "fifo", "peps", "depósito"],
  Bar: ["bar", "bebida", "drink", "coquetel", "cerveja", "vinho", "gelo"],
  Delivery: ["delivery", "embalagem", "entrega", "ifood", "aplicativo", "motoboy"],
};

// Sector colors
const SECTOR_COLORS: Record<string, string> = {
  Cozinha: "hsl(var(--chart-1))",
  Salão: "hsl(var(--chart-2))",
  Banheiros: "hsl(var(--chart-3))",
  Estoque: "hsl(var(--chart-4))",
  Bar: "hsl(var(--chart-5))",
  Delivery: "hsl(210, 80%, 50%)",
  Outros: "hsl(var(--muted-foreground))",
};

// Sector icons
const SECTOR_ICONS: Record<string, React.ElementType> = {
  Cozinha: ChefHat,
  Salão: UtensilsCrossed,
  Banheiros: Bath,
  Estoque: Warehouse,
  Bar: Beer,
  Delivery: Truck,
};

// Helper to categorize failure into sector
function categorizeSector(itemName: string): string {
  const lowerName = itemName.toLowerCase();
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some((kw) => lowerName.includes(kw))) {
      return sector;
    }
  }
  return "Outros";
}

export function AuditDiagnosticDashboard({
  selectedUnidadeId,
  isAdmin = false,
}: AuditDiagnosticDashboardProps) {
  const { options: lojas } = useConfigLojas();
  const { audits, failures, isLoadingFailures, isLoadingAudits } = useSupervisionAudits();

  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState<string>("overview");

  const currentMonth = format(new Date(), "yyyy-MM");
  const previousMonth = format(subMonths(new Date(), 1), "yyyy-MM");

  // Filter lojas by brand
  const filteredLojaIds = useMemo(() => {
    if (brandFilter === "all") return lojas.map((l) => l.id);
    const patterns = BRAND_PATTERNS[brandFilter] || [];
    return lojas
      .filter((loja) => patterns.some((p) => loja.nome.toUpperCase().includes(p)))
      .map((l) => l.id);
  }, [lojas, brandFilter]);

  // Get loja name by id
  const getLojaName = (lojaId: string) => {
    return lojas.find((l) => l.id === lojaId)?.nome || "Desconhecida";
  };

  // Filter failures based on brand/unit selection
  const filteredFailures = useMemo(() => {
    let result = failures;
    
    if (selectedUnidadeId) {
      result = result.filter((f) => f.loja_id === selectedUnidadeId);
    } else if (brandFilter !== "all") {
      result = result.filter((f) => filteredLojaIds.includes(f.loja_id));
    }
    
    return result;
  }, [failures, selectedUnidadeId, brandFilter, filteredLojaIds]);

  // Get audit IDs for current and previous month
  const currentMonthAuditIds = useMemo(() => {
    return audits
      .filter((a) => a.audit_date.startsWith(currentMonth.substring(0, 7)))
      .map((a) => a.id);
  }, [audits, currentMonth]);

  const previousMonthAuditIds = useMemo(() => {
    return audits
      .filter((a) => a.audit_date.startsWith(previousMonth.substring(0, 7)))
      .map((a) => a.id);
  }, [audits, previousMonth]);

  // Current month failures
  const currentMonthFailures = useMemo(() => {
    return filteredFailures.filter((f) => currentMonthAuditIds.includes(f.audit_id));
  }, [filteredFailures, currentMonthAuditIds]);

  // Previous month failures
  const previousMonthFailures = useMemo(() => {
    return filteredFailures.filter((f) => previousMonthAuditIds.includes(f.audit_id));
  }, [filteredFailures, previousMonthAuditIds]);

  // Top 10 Offenders (most frequent failures in current month)
  const topOffenders = useMemo(() => {
    const counts: Record<string, number> = {};
    currentMonthFailures.forEach((f) => {
      counts[f.item_name] = (counts[f.item_name] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({
        name: name.length > 40 ? name.substring(0, 40) + "..." : name,
        fullName: name,
        count,
      }));
  }, [currentMonthFailures]);

  // Recurring failures (appeared in both current and previous month)
  const recurringFailures = useMemo(() => {
    const currentItems = new Set(currentMonthFailures.map((f) => `${f.loja_id}|${f.item_name}`));
    const previousItems = new Set(previousMonthFailures.map((f) => `${f.loja_id}|${f.item_name}`));
    
    const recurring: SupervisionFailure[] = [];
    const seen = new Set<string>();
    
    currentMonthFailures.forEach((f) => {
      const key = `${f.loja_id}|${f.item_name}`;
      if (previousItems.has(key) && !seen.has(key)) {
        seen.add(key);
        recurring.push(f);
      }
    });
    
    return recurring;
  }, [currentMonthFailures, previousMonthFailures]);

  // Sector distribution
  const sectorDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    currentMonthFailures.forEach((f) => {
      const sector = categorizeSector(f.item_name);
      counts[sector] = (counts[sector] || 0) + 1;
    });
    
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    
    return Object.entries(counts)
      .map(([sector, count]) => ({
        sector,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: SECTOR_COLORS[sector] || SECTOR_COLORS["Outros"],
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentMonthFailures]);

  // Worst performing unit
  const worstUnit = useMemo(() => {
    if (!isAdmin) return null;
    
    const unitCounts: Record<string, { count: number; lojaId: string }> = {};
    currentMonthFailures.forEach((f) => {
      if (!unitCounts[f.loja_id]) {
        unitCounts[f.loja_id] = { count: 0, lojaId: f.loja_id };
      }
      unitCounts[f.loja_id].count++;
    });
    
    const sorted = Object.values(unitCounts).sort((a, b) => b.count - a.count);
    if (sorted.length === 0) return null;
    
    const worst = sorted[0];
    return {
      lojaId: worst.lojaId,
      nome: getLojaName(worst.lojaId),
      failureCount: worst.count,
    };
  }, [currentMonthFailures, isAdmin, getLojaName]);

  // Pending actions count
  const pendingCount = useMemo(() => {
    return filteredFailures.filter((f) => f.status === "pending").length;
  }, [filteredFailures]);

  const resolvedCount = useMemo(() => {
    return filteredFailures.filter((f) => f.status === "resolved").length;
  }, [filteredFailures]);

  const validatedCount = useMemo(() => {
    return filteredFailures.filter((f) => f.status === "validated").length;
  }, [filteredFailures]);

  if (isLoadingFailures || isLoadingAudits) {
    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <AlertOctagon className="h-6 w-6 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">
              Diagnóstico de Auditoria
            </h2>
            <p className="text-muted-foreground">
              Análise de não conformidades • {format(new Date(), "MMMM yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filtrar marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Marcas</SelectItem>
                <SelectItem value="caminito">Caminito</SelectItem>
                <SelectItem value="nazo">Nazo</SelectItem>
                <SelectItem value="caju">Caju</SelectItem>
                <SelectItem value="fosters">Foster's / FB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-card border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground uppercase">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl shadow-card border-l-4 border-l-sky-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-sky-500" />
              <div>
                <p className="text-2xl font-bold">{resolvedCount}</p>
                <p className="text-xs text-muted-foreground uppercase">Aguardando</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl shadow-card border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold">{validatedCount}</p>
                <p className="text-xs text-muted-foreground uppercase">Validados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl shadow-card border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RotateCcw className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{recurringFailures.length}</p>
                <p className="text-xs text-muted-foreground uppercase">Recorrentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Worst Unit Card (Admin Only) */}
      {isAdmin && worstUnit && (
        <Card className="rounded-2xl shadow-card bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20">
                  <TrendingDown className="h-7 w-7 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400 uppercase">Unidade com Mais Não Conformidades</p>
                  <p className="text-xl font-bold">{worstUnit.nome}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-amber-400">{worstUnit.failureCount}</p>
                <p className="text-xs text-slate-400">falhas este mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Top Ofensores</span>
          </TabsTrigger>
          <TabsTrigger value="sectors" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            <span className="hidden sm:inline">Por Setor</span>
          </TabsTrigger>
          <TabsTrigger value="recurring" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Recorrentes</span>
          </TabsTrigger>
        </TabsList>

        {/* Top Offenders Tab */}
        <TabsContent value="overview" className="animate-fade-in">
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-base uppercase flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Top 10 Itens Não Conformes
              </CardTitle>
              <CardDescription>
                Itens com maior frequência de falhas no mês atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topOffenders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                  <p className="text-muted-foreground">Nenhuma não conformidade registrada.</p>
                </div>
              ) : (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topOffenders}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={200}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-sm">{data.fullName}</p>
                                <p className="text-primary font-bold">{data.count} ocorrências</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--primary))" 
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sector Distribution Tab */}
        <TabsContent value="sectors" className="animate-fade-in">
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-base uppercase flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Distribuição por Setor
              </CardTitle>
              <CardDescription>
                Análise de onde estão concentradas as falhas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sectorDistribution.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                  <p className="text-muted-foreground">Nenhuma não conformidade registrada.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Donut Chart */}
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={sectorDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="count"
                          nameKey="sector"
                        >
                          {sectorDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-background border rounded-lg p-3 shadow-lg">
                                  <p className="font-medium">{data.sector}</p>
                                  <p className="text-primary font-bold">{data.count} falhas ({data.percentage}%)</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Sector List */}
                  <div className="space-y-4">
                    {sectorDistribution.map((sector) => {
                      const Icon = SECTOR_ICONS[sector.sector] || Building2;
                      return (
                        <div key={sector.sector} className="flex items-center gap-4">
                          <div 
                            className="flex h-10 w-10 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${sector.color}20` }}
                          >
                            <Icon className="h-5 w-5" style={{ color: sector.color }} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{sector.sector}</span>
                              <span className="text-sm text-muted-foreground">
                                {sector.count} ({sector.percentage}%)
                              </span>
                            </div>
                            <Progress 
                              value={sector.percentage} 
                              className="h-2"
                              style={{ 
                                '--progress-color': sector.color 
                              } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recurring Failures Tab */}
        <TabsContent value="recurring" className="animate-fade-in">
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="text-base uppercase flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-destructive" />
                Falhas Recorrentes (Alerta Vermelho)
              </CardTitle>
              <CardDescription>
                Itens que falharam em auditorias consecutivas — Prioridade máxima
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recurringFailures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                  <h3 className="font-medium text-lg">Nenhuma recorrência detectada</h3>
                  <p className="text-muted-foreground text-sm">
                    Não há itens que falharam em auditorias consecutivas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recurringFailures.map((failure) => (
                    <div
                      key={failure.id}
                      className="flex items-start gap-4 p-4 rounded-xl border-2 border-destructive/30 bg-destructive/5"
                    >
                      <div className="flex-shrink-0 mt-1">
                        <AlertOctagon className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <p className="font-medium text-sm leading-tight">
                            {failure.item_name}
                          </p>
                          <Badge variant="destructive" className="text-xs">
                            <RotateCcw className="h-3 w-3 mr-1" />
                            RECORRENTE
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {getLojaName(failure.loja_id)}
                          </span>
                          {failure.category && (
                            <span>• {failure.category}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge 
                            variant={
                              failure.status === "pending" 
                                ? "secondary" 
                                : failure.status === "resolved" 
                                ? "outline" 
                                : "default"
                            }
                            className="text-xs"
                          >
                            {failure.status === "pending" && "Pendente"}
                            {failure.status === "resolved" && "Aguardando Validação"}
                            {failure.status === "validated" && "Validado"}
                          </Badge>
                          <span className="text-xs text-amber-600">
                            Prazo: 48h para correção
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
