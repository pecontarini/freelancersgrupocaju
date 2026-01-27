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
  ClipboardList,
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
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useSupervisionAudits, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { SectorBadgeCompact } from "@/components/dashboard/SectorResponsibilityBadges";
import { 
  SECTOR_POSITION_MAP, 
  categorizeItemToSector,
  POSITION_COLORS,
  type AuditSector,
} from "@/lib/sectorPositionMapping";

interface AuditDiagnosticDashboardProps {
  selectedUnidadeId: string | null;
  isAdmin?: boolean;
}

const BRAND_PATTERNS: Record<string, string[]> = {
  all: [],
  caminito: ["CAMINITO", "MULT"],
  nazo: ["NAZO", "NFE"],
  caju: ["CAJU"],
  fosters: ["FOSTER", "FB"],
};

// Visual sector config for charts (maps to the new sector system)
const SECTOR_DISPLAY: Record<string, { 
  icon: React.ElementType; 
  color: string;
  keywords: string[];
}> = {
  bar: { icon: Beer, color: "hsl(280, 70%, 50%)", keywords: [] },
  cozinha: { icon: ChefHat, color: "hsl(20, 80%, 50%)", keywords: [] },
  salao: { icon: UtensilsCrossed, color: "hsl(150, 60%, 45%)", keywords: [] },
  estoque: { icon: Warehouse, color: "hsl(var(--chart-4))", keywords: [] },
  delivery: { icon: Truck, color: "hsl(210, 80%, 50%)", keywords: [] },
  outros: { icon: Bath, color: "hsl(var(--muted-foreground))", keywords: [] },
};

// Get display name for a sector
function getSectorDisplayName(sector: AuditSector): string {
  return SECTOR_POSITION_MAP[sector]?.displayName || sector;
}

// Get color for a sector (use position color if chief exists)
function getSectorColor(sector: AuditSector): string {
  const config = SECTOR_POSITION_MAP[sector];
  if (config?.primaryChief) {
    return POSITION_COLORS[config.primaryChief];
  }
  return POSITION_COLORS[config?.responsibleManager || 'gerente_back'];
}

// Get icon for a sector
function getSectorIcon(sector: string): React.ElementType {
  return SECTOR_DISPLAY[sector]?.icon || Bath;
}

export function AuditDiagnosticDashboard({
  selectedUnidadeId,
  isAdmin = false,
}: AuditDiagnosticDashboardProps) {
  const { options: lojas } = useConfigLojas();
  const { audits, failures, isLoadingFailures, isLoadingAudits } = useSupervisionAudits();
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const currentMonth = format(new Date(), "yyyy-MM");
  const previousMonth = format(subMonths(new Date(), 1), "yyyy-MM");

  const filteredLojaIds = useMemo(() => {
    if (brandFilter === "all") return lojas.map((l) => l.id);
    const patterns = BRAND_PATTERNS[brandFilter] || [];
    return lojas
      .filter((loja) => patterns.some((p) => loja.nome.toUpperCase().includes(p)))
      .map((l) => l.id);
  }, [lojas, brandFilter]);

  const getLojaName = (lojaId: string) => {
    return lojas.find((l) => l.id === lojaId)?.nome || "Desconhecida";
  };

  const filteredFailures = useMemo(() => {
    let result = failures;
    if (selectedUnidadeId) {
      result = result.filter((f) => f.loja_id === selectedUnidadeId);
    } else if (brandFilter !== "all") {
      result = result.filter((f) => filteredLojaIds.includes(f.loja_id));
    }
    return result;
  }, [failures, selectedUnidadeId, brandFilter, filteredLojaIds]);

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

  const currentMonthFailures = useMemo(() => {
    return filteredFailures.filter((f) => currentMonthAuditIds.includes(f.audit_id));
  }, [filteredFailures, currentMonthAuditIds]);

  const previousMonthFailures = useMemo(() => {
    return filteredFailures.filter((f) => previousMonthAuditIds.includes(f.audit_id));
  }, [filteredFailures, previousMonthAuditIds]);

  const topOffenders = useMemo(() => {
    const counts: Record<string, number> = {};
    currentMonthFailures.forEach((f) => {
      counts[f.item_name] = (counts[f.item_name] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({
        name: name.length > 35 ? name.substring(0, 35) + "..." : name,
        fullName: name,
        count,
      }));
  }, [currentMonthFailures]);

  const recurringFailures = useMemo(() => {
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

  const sectorDistribution = useMemo(() => {
    const counts: Record<AuditSector, number> = {} as Record<AuditSector, number>;
    currentMonthFailures.forEach((f) => {
      const sector = categorizeItemToSector(f.item_name, f.category);
      counts[sector] = (counts[sector] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .map(([sector, count]) => ({
        sector: sector as AuditSector,
        displayName: getSectorDisplayName(sector as AuditSector),
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        color: getSectorColor(sector as AuditSector),
      }))
      .sort((a, b) => b.count - a.count);
  }, [currentMonthFailures]);

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

  const pendingCount = filteredFailures.filter((f) => f.status === "pending").length;
  const resolvedCount = filteredFailures.filter((f) => f.status === "resolved").length;
  const validatedCount = filteredFailures.filter((f) => f.status === "validated").length;

  if (isLoadingFailures || isLoadingAudits) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase">
              Diagnóstico de Auditoria
            </h2>
            <p className="text-muted-foreground">
              {format(new Date(), "MMMM yyyy", { locale: ptBR })} • Análise de não conformidades
            </p>
          </div>
        </div>

        {isAdmin && (
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
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
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">aguardando correção</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Aguardando
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resolvedCount}</div>
            <p className="text-xs text-muted-foreground">para validação</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Validados
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{validatedCount}</div>
            <p className="text-xs text-muted-foreground">concluídos</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-card bg-gradient-to-br from-destructive/10 to-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground">
              Recorrentes
            </CardTitle>
            <RotateCcw className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{recurringFailures.length}</div>
            <p className="text-xs text-muted-foreground">prioridade máxima</p>
          </CardContent>
        </Card>
      </div>

      {/* Worst Unit Alert (Admin Only) */}
      {isAdmin && worstUnit && (
        <Card className="rounded-2xl shadow-card border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <TrendingDown className="h-6 w-6 text-amber-600" />
              <div>
                <p className="text-sm text-muted-foreground uppercase">Unidade com Mais Falhas</p>
                <p className="font-bold text-lg">{worstUnit.nome}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-600">{worstUnit.failureCount}</p>
              <p className="text-xs text-muted-foreground">este mês</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Offenders Chart */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              <BarChart3 className="h-5 w-5 text-primary" />
              Top 10 Não Conformidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topOffenders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                <p className="text-muted-foreground">Nenhuma falha registrada</p>
              </div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topOffenders}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={180}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border rounded-lg p-3 shadow-lg">
                              <p className="font-medium text-sm">{data.fullName}</p>
                              <p className="text-primary font-bold">{data.count} ocorrências</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sector Distribution */}
        <Card className="rounded-2xl shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base uppercase">
              <PieChart className="h-5 w-5 text-primary" />
              Distribuição por Setor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sectorDistribution.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                <p className="text-muted-foreground">Nenhuma falha registrada</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={sectorDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
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
                              <div className="bg-popover border rounded-lg p-3 shadow-lg">
                                <p className="font-medium">{data.displayName}</p>
                                <p className="text-primary font-bold">
                                  {data.count} falhas ({data.percentage}%)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {sectorDistribution.slice(0, 5).map((sector) => {
                    const Icon = getSectorIcon(sector.sector);
                    return (
                      <div key={sector.sector} className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${sector.color}20` }}
                        >
                          <Icon className="h-4 w-4" style={{ color: sector.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{sector.displayName}</span>
                              <SectorBadgeCompact sector={sector.sector} />
                            </div>
                            <span className="text-muted-foreground">{sector.percentage}%</span>
                          </div>
                          <Progress value={sector.percentage} className="h-1.5 mt-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recurring Failures List */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <AlertOctagon className="h-5 w-5 text-destructive" />
            Falhas Recorrentes
          </CardTitle>
          {recurringFailures.length > 0 && (
            <Badge variant="destructive">{recurringFailures.length} itens</Badge>
          )}
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
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recurringFailures.map((failure) => (
                <div
                  key={failure.id}
                  className="flex items-center justify-between rounded-xl bg-destructive/5 border border-destructive/20 p-4 transition-colors hover:bg-destructive/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                      <RotateCcw className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{failure.item_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {getLojaName(failure.loja_id)}
                        {failure.category && <span>• {failure.category}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={
                        failure.status === "pending"
                          ? "secondary"
                          : failure.status === "resolved"
                          ? "outline"
                          : "default"
                      }
                    >
                      {failure.status === "pending" && "Pendente"}
                      {failure.status === "resolved" && "Aguardando"}
                      {failure.status === "validated" && "Validado"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
