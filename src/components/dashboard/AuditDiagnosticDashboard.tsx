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
  Upload,
  RefreshCcw,
  Users,
  LayoutDashboard,
  FileText,
  TrendingUp,
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
  LineChart,
  Line,
  ReferenceLine,
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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSupervisionAudits, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import {
  useLeadershipPerformance,
  useCalculateLeadershipPerformance,
} from "@/hooks/useLeadershipPerformance";
import { SectorBadgeCompact } from "@/components/dashboard/SectorResponsibilityBadges";
import { ChecklistImportSection } from "@/components/ChecklistImportSection";
import { ComplianceHeatmap } from "@/components/dashboard/ComplianceHeatmap";
import { LeadershipRadar } from "@/components/dashboard/LeadershipRadar";
import {
  SECTOR_POSITION_MAP,
  categorizeItemToSector,
  POSITION_COLORS,
  POSITION_LABELS as MAPPING_POSITION_LABELS,
  type AuditSector,
  type LeadershipPosition,
} from "@/lib/sectorPositionMapping";
import { POSITION_LABELS, POSITION_COLORS as AUDIT_POSITION_COLORS, getTierForScore } from "@/lib/audit/auditTypes";
import type { LeadershipPositionCode } from "@/lib/audit/auditTypes";

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

const SECTOR_DISPLAY: Record<string, {
  icon: React.ElementType;
  color: string;
}> = {
  bar: { icon: Beer, color: "hsl(280, 70%, 50%)" },
  cozinha: { icon: ChefHat, color: "hsl(20, 80%, 50%)" },
  salao: { icon: UtensilsCrossed, color: "hsl(150, 60%, 45%)" },
  estoque: { icon: Warehouse, color: "hsl(var(--chart-4))" },
  delivery: { icon: Truck, color: "hsl(210, 80%, 50%)" },
  outros: { icon: Bath, color: "hsl(var(--muted-foreground))" },
};

function getSectorDisplayName(sector: AuditSector): string {
  return SECTOR_POSITION_MAP[sector]?.displayName || sector;
}

function getSectorColor(sector: AuditSector): string {
  const config = SECTOR_POSITION_MAP[sector];
  if (config?.primaryChief) {
    return POSITION_COLORS[config.primaryChief];
  }
  return POSITION_COLORS[config?.responsibleManager || 'gerente_back'];
}

function getSectorIcon(sector: string): React.ElementType {
  return SECTOR_DISPLAY[sector]?.icon || Bath;
}

function getTierBadgeClass(tier: string | null): string {
  switch (tier) {
    case 'ouro': return 'bg-amber-500 text-white';
    case 'prata': return 'bg-slate-400 text-white';
    case 'bronze': return 'bg-amber-700 text-white';
    case 'red_flag': return 'bg-destructive text-destructive-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getTierLabel(tier: string | null): string {
  switch (tier) {
    case 'ouro': return 'Ouro';
    case 'prata': return 'Prata';
    case 'bronze': return 'Bronze';
    case 'red_flag': return 'Red Flag';
    default: return 'N/A';
  }
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 95) return 'text-amber-500';
  if (score >= 90) return 'text-slate-500';
  if (score >= 85) return 'text-amber-700';
  return 'text-destructive';
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

  // Leadership performance for the selected unit
  const {
    positionResults,
    frontPositions,
    backPositions,
    managers,
    chiefs,
    generalScore,
    generalTier,
    isLoading: isLoadingPerformance,
  } = useLeadershipPerformance({
    lojaId: selectedUnidadeId,
    monthYear: currentMonth,
    usePersistedScores: true,
  });

  // Recalculate hook
  const { calculate, isCalculating } = useCalculateLeadershipPerformance();

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

  // Observations (detalhes_falha) from auditors
  const observations = useMemo(() => {
    return currentMonthFailures
      .filter((f) => f.detalhes_falha && f.detalhes_falha.trim().length > 0)
      .map((f) => ({
        id: f.id,
        itemName: f.item_name,
        category: f.category,
        details: f.detalhes_falha!,
        status: f.status,
        sector: categorizeItemToSector(f.item_name, f.category),
        evidenceUrl: f.url_foto_evidencia,
        lojaId: f.loja_id,
      }));
  }, [currentMonthFailures]);

  // Evolution data - scores per month from audits
  const evolutionData = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      months.push(format(d, "yyyy-MM"));
    }

    return months.map((m) => {
      const monthAudits = audits.filter((a) => {
        const auditMonth = a.audit_date.substring(0, 7);
        return auditMonth === m && (selectedUnidadeId ? a.loja_id === selectedUnidadeId : true);
      });
      const avgScore = monthAudits.length > 0
        ? monthAudits.reduce((sum, a) => sum + a.global_score, 0) / monthAudits.length
        : null;

      return {
        month: format(new Date(m + "-01"), "MMM", { locale: ptBR }),
        score: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
        audits: monthAudits.length,
      };
    });
  }, [audits, selectedUnidadeId]);

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

        <div className="flex items-center gap-3">
          {/* Upload Button */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" className="gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Upload Auditoria</span>
                <span className="sm:hidden">Upload</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg uppercase">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Importar Checklist de Supervisão
                </DialogTitle>
              </DialogHeader>
              <ChecklistImportSection />
            </DialogContent>
          </Dialog>

          {/* Recalculate Button (Admin) */}
          {isAdmin && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                calculate({
                  action: "backfill",
                  loja_id: selectedUnidadeId || undefined,
                  trigger_type: "manual_backfill",
                })
              }
              disabled={isCalculating}
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Recalcular Histórico</span>
            </Button>
          )}

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
                <SelectItem value="fosters">FOSTERS BURGUER</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Tabbed View */}
      <Tabs defaultValue="scores" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="scores" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Notas</span>
          </TabsTrigger>
          <TabsTrigger value="failures" className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4" />
            <span className="hidden sm:inline">Falhas</span>
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Conformidade</span>
          </TabsTrigger>
          <TabsTrigger value="radar" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Competências</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: SCORES (Regra Mãe) ===== */}
        <TabsContent value="scores" className="space-y-6 animate-fade-in">
          {/* General Score Card */}
          <Card className="rounded-2xl shadow-card bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground uppercase">Nota Geral da Unidade</p>
                <p className={`text-4xl font-bold ${getScoreColor(generalScore)}`}>
                  {generalScore !== null ? `${generalScore.toFixed(1)}%` : "—"}
                </p>
              </div>
              {generalTier && (
                <Badge className={`text-sm px-4 py-2 ${getTierBadgeClass(generalTier.tier)}`}>
                  {generalTier.label}
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Position Scores Grid */}
          <div className="space-y-4">
            {/* Front Section */}
            <div>
              <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                Família Front
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                {frontPositions.map((pos) => (
                  <Card key={pos.position} className="rounded-2xl shadow-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{pos.label}</p>
                        {pos.tier && (
                          <Badge className={`text-xs ${getTierBadgeClass(pos.tier.tier)}`}>
                            {pos.tier.label}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-2xl font-bold ${getScoreColor(pos.finalScore)}`}>
                        {pos.finalScore !== null ? `${pos.finalScore.toFixed(1)}%` : "—"}
                      </p>
                      {pos.breakdown.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {pos.breakdown.map((b) => (
                            <div key={b.checklistType} className="flex justify-between text-xs text-muted-foreground">
                              <span>{b.label} (×{b.weight})</span>
                              <span className="font-medium">{b.averageScore.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {pos.totalAudits} auditorias
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Back Section */}
            <div>
              <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <ChefHat className="h-4 w-4" />
                Família Back
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                {backPositions.map((pos) => (
                  <Card key={pos.position} className="rounded-2xl shadow-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{pos.label}</p>
                        {pos.tier && (
                          <Badge className={`text-xs ${getTierBadgeClass(pos.tier.tier)}`}>
                            {pos.tier.label}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-2xl font-bold ${getScoreColor(pos.finalScore)}`}>
                        {pos.finalScore !== null ? `${pos.finalScore.toFixed(1)}%` : "—"}
                      </p>
                      {pos.breakdown.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {pos.breakdown.map((b) => (
                            <div key={b.checklistType} className="flex justify-between text-xs text-muted-foreground">
                              <span>{b.label} (×{b.weight})</span>
                              <span className="font-medium">{b.averageScore.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {pos.totalAudits} auditorias
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Evolution Chart */}
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base uppercase">
                <TrendingUp className="h-5 w-5 text-primary" />
                Evolução da Nota Global (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[60, 100]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{data.month}</p>
                              <p className="text-primary font-bold">
                                {data.score !== null ? `${data.score}%` : "Sem dados"}
                              </p>
                              <p className="text-xs text-muted-foreground">{data.audits} auditorias</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={95} stroke="hsl(45, 93%, 47%)" strokeDasharray="3 3" label="Ouro" />
                    <ReferenceLine y={85} stroke="hsl(30, 67%, 55%)" strokeDasharray="3 3" label="Bronze" />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ r: 5, fill: "hsl(var(--primary))" }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Observations / Notes from Auditors */}
          <Card className="rounded-2xl shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base uppercase">
                <FileText className="h-5 w-5 text-primary" />
                Observações do Auditor
              </CardTitle>
              {observations.length > 0 && (
                <Badge variant="secondary">{observations.length} observações</Badge>
              )}
            </CardHeader>
            <CardContent>
              {observations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                  <h3 className="font-medium text-lg">Nenhuma observação registrada</h3>
                  <p className="text-muted-foreground text-sm">
                    As observações dos auditores aparecerão aqui quando disponíveis.
                  </p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {observations.map((obs) => (
                      <div
                        key={obs.id}
                        className="rounded-xl border p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-sm truncate">{obs.itemName}</p>
                              <SectorBadgeCompact sector={obs.sector} />
                              <Badge
                                variant={
                                  obs.status === "pending"
                                    ? "secondary"
                                    : obs.status === "resolved"
                                    ? "outline"
                                    : "default"
                                }
                                className="text-xs"
                              >
                                {obs.status === "pending" && "Pendente"}
                                {obs.status === "resolved" && "Corrigido"}
                                {obs.status === "validated" && "Validado"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{obs.details}</p>
                            {obs.category && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Categoria: {obs.category}
                              </p>
                            )}
                            {obs.evidenceUrl && (
                              <a
                                href={obs.evidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline mt-1 inline-block"
                              >
                                📷 Ver evidência
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB 2: FAILURES (existing charts) ===== */}
        <TabsContent value="failures" className="space-y-6 animate-fade-in">
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
        </TabsContent>

        {/* ===== TAB 3: COMPLIANCE HEATMAP ===== */}
        <TabsContent value="heatmap" className="animate-fade-in">
          <ComplianceHeatmap lojaId={selectedUnidadeId} />
        </TabsContent>

        {/* ===== TAB 4: LEADERSHIP RADAR ===== */}
        <TabsContent value="radar" className="animate-fade-in">
          <LeadershipRadar lojaId={selectedUnidadeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
