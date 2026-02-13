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
  Calendar,
  Eye,
  ShieldAlert,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
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
import { Separator } from "@/components/ui/separator";
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
  type AuditSector,
} from "@/lib/sectorPositionMapping";
import { POSITION_LABELS, getTierForScore } from "@/lib/audit/auditTypes";
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

// Generate month options for filter
function getMonthOptions() {
  const options = [];
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i);
    options.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return options;
}

export function AuditDiagnosticDashboard({
  selectedUnidadeId,
  isAdmin = false,
}: AuditDiagnosticDashboardProps) {
  const { options: lojas } = useConfigLojas();
  const { audits, failures, isLoadingFailures, isLoadingAudits } = useSupervisionAudits();
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const previousMonth = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return format(d, "yyyy-MM");
  }, [selectedMonth]);

  // Leadership performance
  const {
    positionResults,
    frontPositions,
    backPositions,
    generalScore,
    generalTier,
    isLoading: isLoadingPerformance,
  } = useLeadershipPerformance({
    lojaId: selectedUnidadeId,
    monthYear: selectedMonth,
    usePersistedScores: true,
  });

  const { calculate, isCalculating } = useCalculateLeadershipPerformance();

  // Filter lojas by brand
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

  // Audit IDs for selected and previous month
  const selectedMonthAuditIds = useMemo(() => {
    return audits
      .filter((a) => a.audit_date.startsWith(selectedMonth))
      .map((a) => a.id);
  }, [audits, selectedMonth]);

  const previousMonthAuditIds = useMemo(() => {
    return audits
      .filter((a) => a.audit_date.startsWith(previousMonth))
      .map((a) => a.id);
  }, [audits, previousMonth]);

  // All failures filtered by unit and brand
  const unitFilteredFailures = useMemo(() => {
    let result = failures;
    if (selectedUnidadeId) {
      result = result.filter((f) => f.loja_id === selectedUnidadeId);
    } else if (brandFilter !== "all") {
      result = result.filter((f) => filteredLojaIds.includes(f.loja_id));
    }
    return result;
  }, [failures, selectedUnidadeId, brandFilter, filteredLojaIds]);

  // Current month failures
  const currentMonthFailures = useMemo(() => {
    let result = unitFilteredFailures.filter((f) => selectedMonthAuditIds.includes(f.audit_id));
    if (statusFilter !== "all") {
      result = result.filter((f) => f.status === statusFilter);
    }
    return result;
  }, [unitFilteredFailures, selectedMonthAuditIds, statusFilter]);

  // Previous month failures for recurrence detection
  const previousMonthFailures = useMemo(() => {
    return unitFilteredFailures.filter((f) => previousMonthAuditIds.includes(f.audit_id));
  }, [unitFilteredFailures, previousMonthAuditIds]);

  // All failures for the month (without status filter) for KPI counts
  const allCurrentMonthFailures = useMemo(() => {
    return unitFilteredFailures.filter((f) => selectedMonthAuditIds.includes(f.audit_id));
  }, [unitFilteredFailures, selectedMonthAuditIds]);

  // KPI counts
  const pendingCount = allCurrentMonthFailures.filter((f) => f.status === "pending").length;
  const resolvedCount = allCurrentMonthFailures.filter((f) => f.status === "resolved").length;
  const validatedCount = allCurrentMonthFailures.filter((f) => f.status === "validated").length;
  const totalFailures = allCurrentMonthFailures.length;

  // Audits this month
  const currentMonthAudits = useMemo(() => {
    let result = audits.filter((a) => a.audit_date.startsWith(selectedMonth));
    if (selectedUnidadeId) {
      result = result.filter((a) => a.loja_id === selectedUnidadeId);
    } else if (brandFilter !== "all") {
      result = result.filter((a) => filteredLojaIds.includes(a.loja_id));
    }
    return result;
  }, [audits, selectedMonth, selectedUnidadeId, brandFilter, filteredLojaIds]);

  const avgGlobalScore = useMemo(() => {
    if (currentMonthAudits.length === 0) return null;
    return currentMonthAudits.reduce((sum, a) => sum + a.global_score, 0) / currentMonthAudits.length;
  }, [currentMonthAudits]);

  // Previous month avg for comparison
  const prevMonthAudits = useMemo(() => {
    let result = audits.filter((a) => a.audit_date.startsWith(previousMonth));
    if (selectedUnidadeId) {
      result = result.filter((a) => a.loja_id === selectedUnidadeId);
    } else if (brandFilter !== "all") {
      result = result.filter((a) => filteredLojaIds.includes(a.loja_id));
    }
    return result;
  }, [audits, previousMonth, selectedUnidadeId, brandFilter, filteredLojaIds]);

  const prevAvgScore = useMemo(() => {
    if (prevMonthAudits.length === 0) return null;
    return prevMonthAudits.reduce((sum, a) => sum + a.global_score, 0) / prevMonthAudits.length;
  }, [prevMonthAudits]);

  const scoreVariation = useMemo(() => {
    if (avgGlobalScore === null || prevAvgScore === null) return null;
    return avgGlobalScore - prevAvgScore;
  }, [avgGlobalScore, prevAvgScore]);

  // Top offenders
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

  // Recurring failures
  const recurringFailures = useMemo(() => {
    const previousItems = new Set(previousMonthFailures.map((f) => `${f.loja_id}|${f.item_name}`));
    const recurring: SupervisionFailure[] = [];
    const seen = new Set<string>();
    allCurrentMonthFailures.forEach((f) => {
      const key = `${f.loja_id}|${f.item_name}`;
      if (previousItems.has(key) && !seen.has(key)) {
        seen.add(key);
        recurring.push(f);
      }
    });
    return recurring;
  }, [allCurrentMonthFailures, previousMonthFailures]);

  // Sector distribution
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

  // Worst unit (admin)
  const worstUnit = useMemo(() => {
    if (!isAdmin || selectedUnidadeId) return null;
    const unitCounts: Record<string, { count: number; lojaId: string }> = {};
    allCurrentMonthFailures.forEach((f) => {
      if (!unitCounts[f.loja_id]) {
        unitCounts[f.loja_id] = { count: 0, lojaId: f.loja_id };
      }
      unitCounts[f.loja_id].count++;
    });
    const sorted = Object.values(unitCounts).sort((a, b) => b.count - a.count);
    if (sorted.length === 0) return null;
    return {
      lojaId: sorted[0].lojaId,
      nome: getLojaName(sorted[0].lojaId),
      failureCount: sorted[0].count,
    };
  }, [allCurrentMonthFailures, isAdmin, selectedUnidadeId]);

  // Observations
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

  // Evolution data (6 months)
  const evolutionData = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      months.push(format(d, "yyyy-MM"));
    }

    return months.map((m) => {
      const monthAudits = audits.filter((a) => {
        const auditMonth = a.audit_date.substring(0, 7);
        if (auditMonth !== m) return false;
        if (selectedUnidadeId) return a.loja_id === selectedUnidadeId;
        if (brandFilter !== "all") return filteredLojaIds.includes(a.loja_id);
        return true;
      });
      const avgScore = monthAudits.length > 0
        ? monthAudits.reduce((sum, a) => sum + a.global_score, 0) / monthAudits.length
        : null;

      const monthFailures = unitFilteredFailures.filter((f) => {
        const fAuditIds = monthAudits.map((a) => a.id);
        return fAuditIds.includes(f.audit_id);
      });

      return {
        month: format(new Date(m + "-01"), "MMM", { locale: ptBR }),
        monthFull: format(new Date(m + "-01"), "MMMM yyyy", { locale: ptBR }),
        score: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
        audits: monthAudits.length,
        failures: monthFailures.length,
      };
    });
  }, [audits, selectedUnidadeId, brandFilter, filteredLojaIds, unitFilteredFailures]);

  // Failure trend by unit (for admin network view)
  const unitRanking = useMemo(() => {
    if (!isAdmin || selectedUnidadeId) return [];
    const unitData: Record<string, { lojaId: string; failures: number; audits: number; score: number }> = {};
    currentMonthAudits.forEach((a) => {
      if (!unitData[a.loja_id]) {
        unitData[a.loja_id] = { lojaId: a.loja_id, failures: 0, audits: 0, score: 0 };
      }
      unitData[a.loja_id].audits++;
      unitData[a.loja_id].score += a.global_score;
    });
    allCurrentMonthFailures.forEach((f) => {
      if (unitData[f.loja_id]) {
        unitData[f.loja_id].failures++;
      }
    });
    return Object.values(unitData)
      .map((u) => ({
        ...u,
        nome: getLojaName(u.lojaId),
        avgScore: u.audits > 0 ? u.score / u.audits : 0,
      }))
      .sort((a, b) => a.avgScore - b.avgScore);
  }, [isAdmin, selectedUnidadeId, currentMonthAudits, allCurrentMonthFailures]);

  if (isLoadingFailures || isLoadingAudits) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold uppercase">
                Diagnóstico de Auditoria
              </h2>
              <p className="text-sm text-muted-foreground">
                Visão consolidada de conformidade e não conformidades
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload</span>
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

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
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
                <span className="hidden sm:inline">Recalcular</span>
              </Button>
            )}
          </div>
        </div>

        {/* ===== FILTER BAR ===== */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filtros:
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px] h-9 bg-background">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9 bg-background">
              <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="resolved">Corrigidos</SelectItem>
              <SelectItem value="validated">Validados</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[160px] h-9 bg-background">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Marcas</SelectItem>
                <SelectItem value="caminito">Caminito</SelectItem>
                <SelectItem value="nazo">Nazo</SelectItem>
                <SelectItem value="caju">Caju</SelectItem>
                <SelectItem value="fosters">Fosters</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {/* Nota Global */}
        <Card className="rounded-2xl shadow-card col-span-2 lg:col-span-1 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Nota Global</p>
              {scoreVariation !== null && (
                <div className={`flex items-center gap-0.5 text-xs font-medium ${scoreVariation >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {scoreVariation >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(scoreVariation).toFixed(1)}%
                </div>
              )}
            </div>
            <p className={`text-3xl font-bold ${getScoreColor(avgGlobalScore)}`}>
              {avgGlobalScore !== null ? `${avgGlobalScore.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {currentMonthAudits.length} auditorias
            </p>
          </CardContent>
        </Card>

        {/* Total Falhas */}
        <Card className="rounded-2xl shadow-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Total Falhas</p>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold">{totalFailures}</p>
            <p className="text-xs text-muted-foreground mt-1">neste período</p>
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card className="rounded-2xl shadow-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Pendentes</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-1">sem correção</p>
          </CardContent>
        </Card>

        {/* Validados */}
        <Card className="rounded-2xl shadow-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Validados</p>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-emerald-600">{validatedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">concluídos</p>
          </CardContent>
        </Card>

        {/* Recorrentes */}
        <Card className="rounded-2xl shadow-card border-l-4 border-l-destructive">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Recorrentes</p>
              <Flame className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-3xl font-bold text-destructive">{recurringFailures.length}</p>
            <p className="text-xs text-muted-foreground mt-1">prioridade alta</p>
          </CardContent>
        </Card>
      </div>

      {/* ===== WORST UNIT ALERT (Admin) ===== */}
      {worstUnit && (
        <Card className="rounded-2xl shadow-card border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <TrendingDown className="h-6 w-6 text-amber-600" />
              <div>
                <p className="text-xs text-muted-foreground uppercase">Unidade com Mais Falhas</p>
                <p className="font-bold text-lg">{worstUnit.nome}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-600">{worstUnit.failureCount}</p>
              <p className="text-xs text-muted-foreground">falhas</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== MAIN TABBED CONTENT ===== */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-4 h-auto gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <LayoutDashboard className="h-4 w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="recurring" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <Flame className="h-4 w-4" />
            <span>Recorrências</span>
            {recurringFailures.length > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {recurringFailures.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scores" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <TrendingUp className="h-4 w-4" />
            <span>Notas</span>
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <BarChart3 className="h-4 w-4" />
            <span>Conformidade</span>
          </TabsTrigger>
          <TabsTrigger value="radar" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
            <Users className="h-4 w-4" />
            <span>Competências</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB: VISÃO GERAL ===== */}
        <TabsContent value="overview" className="space-y-6 animate-fade-in">
          {/* Row: Evolution + Sector Pie */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Evolution Chart (3 cols) */}
            <Card className="rounded-2xl shadow-card lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm uppercase">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Evolução da Nota Global
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis domain={[60, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover border rounded-lg p-3 shadow-lg">
                                <p className="font-medium capitalize">{data.monthFull}</p>
                                <p className="text-primary font-bold text-lg">
                                  {data.score !== null ? `${data.score}%` : "Sem dados"}
                                </p>
                                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                                  <span>{data.audits} auditorias</span>
                                  <span>{data.failures} falhas</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={95} stroke="hsl(45, 93%, 47%)" strokeDasharray="3 3" />
                      <ReferenceLine y={85} stroke="hsl(30, 67%, 55%)" strokeDasharray="3 3" />
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

            {/* Sector Distribution (2 cols) */}
            <Card className="rounded-2xl shadow-card lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm uppercase">
                  <PieChart className="h-4 w-4 text-primary" />
                  Falhas por Setor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sectorDistribution.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-10 w-10 text-emerald-500 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma falha registrada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="h-[140px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={sectorDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
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
                                  <div className="bg-popover border rounded-lg p-2 shadow-lg text-sm">
                                    <p className="font-medium">{data.displayName}</p>
                                    <p className="text-primary font-bold">{data.count} ({data.percentage}%)</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {sectorDistribution.slice(0, 5).map((sector) => {
                        const Icon = getSectorIcon(sector.sector);
                        return (
                          <div key={sector.sector} className="flex items-center gap-2">
                            <div
                              className="flex h-6 w-6 items-center justify-center rounded"
                              style={{ backgroundColor: `${sector.color}20` }}
                            >
                              <Icon className="h-3 w-3" style={{ color: sector.color }} />
                            </div>
                            <div className="flex-1 flex items-center justify-between text-xs">
                              <span className="font-medium">{sector.displayName}</span>
                              <span className="text-muted-foreground">{sector.count} ({sector.percentage}%)</span>
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

          {/* Row: Top Offenders + Observations */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top 10 Non-conformities */}
            <Card className="rounded-2xl shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm uppercase">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Top 10 Não Conformidades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topOffenders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-10 w-10 text-emerald-500 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma falha registrada</p>
                  </div>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topOffenders}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={160}
                          tick={{ fontSize: 10 }}
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

            {/* Observations */}
            <Card className="rounded-2xl shadow-card">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm uppercase">
                  <FileText className="h-4 w-4 text-primary" />
                  Observações do Auditor
                </CardTitle>
                {observations.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{observations.length}</Badge>
                )}
              </CardHeader>
              <CardContent>
                {observations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle className="h-10 w-10 text-emerald-500 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma observação registrada</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {observations.map((obs) => (
                        <div
                          key={obs.id}
                          className="rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <p className="font-medium text-xs truncate">{obs.itemName}</p>
                                <SectorBadgeCompact sector={obs.sector} />
                                <Badge
                                  variant={
                                    obs.status === "pending" ? "secondary" :
                                    obs.status === "resolved" ? "outline" : "default"
                                  }
                                  className="text-[10px] h-4"
                                >
                                  {obs.status === "pending" && "Pendente"}
                                  {obs.status === "resolved" && "Corrigido"}
                                  {obs.status === "validated" && "Validado"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{obs.details}</p>
                              {obs.evidenceUrl && (
                                <a
                                  href={obs.evidenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-primary hover:underline mt-0.5 inline-block"
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
          </div>

          {/* Unit Ranking (Admin only, no unit selected) */}
          {isAdmin && unitRanking.length > 0 && (
            <Card className="rounded-2xl shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm uppercase">
                  <Building2 className="h-4 w-4 text-primary" />
                  Ranking de Unidades por Nota
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {unitRanking.map((unit, idx) => {
                    const tier = getTierForScore(unit.avgScore);
                    return (
                      <div key={unit.lojaId} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors">
                        <span className="text-xs font-bold text-muted-foreground w-6 text-center">
                          {idx + 1}º
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">{unit.nome}</p>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-[10px] ${getTierBadgeClass(tier.tier)}`}>
                                {tier.label}
                              </Badge>
                              <span className={`text-sm font-bold ${getScoreColor(unit.avgScore)}`}>
                                {unit.avgScore.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-muted-foreground mt-0.5">
                            <span>{unit.audits} auditorias</span>
                            <span>{unit.failures} falhas</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== TAB: RECORRÊNCIAS ===== */}
        <TabsContent value="recurring" className="space-y-6 animate-fade-in">
          <Card className="rounded-2xl shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base uppercase">
                    <Flame className="h-5 w-5 text-destructive" />
                    Falhas Recorrentes
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Itens que falharam tanto no mês anterior quanto no período selecionado. Requerem ação prioritária.
                  </CardDescription>
                </div>
                {recurringFailures.length > 0 && (
                  <Badge variant="destructive" className="text-sm px-3 py-1">
                    {recurringFailures.length} itens
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recurringFailures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CheckCircle className="h-14 w-14 text-emerald-500 mb-4" />
                  <h3 className="font-semibold text-lg">Nenhuma recorrência detectada</h3>
                  <p className="text-muted-foreground text-sm max-w-md mt-1">
                    Não há itens que falharam em auditorias consecutivas entre {format(new Date(previousMonth + "-01"), "MMMM", { locale: ptBR })} e {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: ptBR })}.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recurringFailures.map((failure) => {
                    const sector = categorizeItemToSector(failure.item_name, failure.category);
                    return (
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
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {getLojaName(failure.loja_id)}
                              </p>
                              <SectorBadgeCompact sector={sector} />
                            </div>
                            {failure.detalhes_falha && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {failure.detalhes_falha}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={
                            failure.status === "pending" ? "secondary" :
                            failure.status === "resolved" ? "outline" : "default"
                          }
                          className="flex-shrink-0"
                        >
                          {failure.status === "pending" && "Pendente"}
                          {failure.status === "resolved" && "Aguardando"}
                          {failure.status === "validated" && "Validado"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Recurring Items Chart */}
          {recurringFailures.length > 0 && (
            <Card className="rounded-2xl shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm uppercase">
                  <AlertOctagon className="h-4 w-4 text-destructive" />
                  Distribuição de Recorrências por Setor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const sectorCounts: Record<string, number> = {};
                  recurringFailures.forEach((f) => {
                    const s = getSectorDisplayName(categorizeItemToSector(f.item_name, f.category));
                    sectorCounts[s] = (sectorCounts[s] || 0) + 1;
                  });
                  const chartData = Object.entries(sectorCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count]) => ({ name, count }));

                  return (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Recorrências" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===== TAB: NOTAS POR CARGO ===== */}
        <TabsContent value="scores" className="space-y-6 animate-fade-in">
          {/* General Score */}
          {selectedUnidadeId && (
            <Card className="rounded-2xl shadow-card bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-muted-foreground uppercase">Nota Geral da Unidade (Regra Mãe)</p>
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
          )}

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
                    <p className="text-xs text-muted-foreground mt-2">{pos.totalAudits} auditorias</p>
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
                    <p className="text-xs text-muted-foreground mt-2">{pos.totalAudits} auditorias</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Evolution */}
          <Card className="rounded-2xl shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm uppercase">
                <TrendingUp className="h-4 w-4 text-primary" />
                Evolução (6 meses)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" />
                    <YAxis domain={[60, 100]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border rounded-lg p-3 shadow-lg">
                              <p className="font-medium capitalize">{data.monthFull}</p>
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
        </TabsContent>

        {/* ===== TAB: CONFORMIDADE ===== */}
        <TabsContent value="heatmap" className="animate-fade-in">
          <ComplianceHeatmap lojaId={selectedUnidadeId} />
        </TabsContent>

        {/* ===== TAB: COMPETÊNCIAS ===== */}
        <TabsContent value="radar" className="animate-fade-in">
          <LeadershipRadar lojaId={selectedUnidadeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
