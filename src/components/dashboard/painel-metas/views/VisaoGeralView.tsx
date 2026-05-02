import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Trophy,
  Building2,
  Check,
  X,
  Star,
  DollarSign,
  ChevronDown,
  Plus,
  Sparkles,
  Copy,
  MessageSquare,
  BarChart3,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { MetaPageHeader } from "../shared/MetaPageHeader";
import { currentMonth, formatNumberPt, monthRange } from "../shared/dateUtils";
import { useSheetData } from "@/hooks/useSheetData";
import {
  parseChecklistCSV,
  parseNpsCSV,
  parseFaturamentoCSV,
  parseBaseAvaliacoesCSV,
} from "@/utils/parseSheetData";

interface VisaoGeralViewProps {
  defaultMes?: string;
  selectedUnidadeId?: string | null;
}

// ── helpers ────────────────────────────────────────────────────
function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function tierClasses(tier: string | null | undefined): string {
  switch (tier) {
    case "ouro":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
    case "prata":
      return "bg-zinc-200 text-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-200";
    case "bronze":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
    case "aceitavel":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}
function tierLabel(t: string | null | undefined): string {
  if (!t) return "—";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Score → cor (sistema novo)
function scoreColor(score: number | null | undefined): { bg: string; fg: string; dot: string } {
  if (score === null || score === undefined || isNaN(score)) {
    return { bg: "rgba(255,255,255,0.04)", fg: "rgba(255,255,255,0.55)", dot: "rgba(255,255,255,0.35)" };
  }
  if (score >= 85) return { bg: "rgba(16,185,129,0.12)", fg: "#10B981", dot: "#10B981" };
  if (score >= 70) return { bg: "rgba(234,179,8,0.12)", fg: "#EAB308", dot: "#EAB308" };
  if (score >= 60) return { bg: "rgba(249,115,22,0.12)", fg: "#F97316", dot: "#F97316" };
  return { bg: "rgba(239,68,68,0.12)", fg: "#EF4444", dot: "#EF4444" };
}

// Tier S/A/B/C/D
function tierSABCD(score: number | null | undefined): { letter: string; color: string; bg: string } | null {
  if (score === null || score === undefined || isNaN(score)) return null;
  if (score >= 88) return { letter: "S", color: "#10B981", bg: "rgba(16,185,129,0.15)" };
  if (score >= 82) return { letter: "A", color: "#EAB308", bg: "rgba(234,179,8,0.15)" };
  if (score >= 76) return { letter: "B", color: "#3B82F6", bg: "rgba(59,130,246,0.15)" };
  if (score >= 70) return { letter: "C", color: "#F97316", bg: "rgba(249,115,22,0.15)" };
  return { letter: "D", color: "#EF4444", bg: "rgba(239,68,68,0.15)" };
}

// Cores para gráfico comparativo
const COMPARE_COLORS = ["#10B981", "#3B82F6", "#F97316", "#A855F7", "#EAB308", "#EF4444", "#14B8A6", "#F472B6"];

// ──────────────────────────────────────────────────────────────
// Card base style (substitui visual liquid glass para o novo padrão)
// ──────────────────────────────────────────────────────────────
const NEW_CARD =
  "rounded-[14px] bg-[#111111] border-[0.5px] border-white/[0.06] text-card-foreground";

// ──────────────────────────────────────────────────────────────
// Score Pill (novo padrão) – ponto + número
// ──────────────────────────────────────────────────────────────
function ScorePill({ score }: { score: number | null | undefined }) {
  const c = scoreColor(score);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {score !== null && score !== undefined && !isNaN(score) ? score.toFixed(0) : "—"}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// KPI Card (novo) – clicável + badge tendência
// ──────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  score?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  trendBadge?: { text: string; tone: "up" | "down" | "neutral" } | null;
  onClick?: () => void;
}
function KpiCard({ label, value, score, icon: Icon, loading, trendBadge, onClick }: KpiCardProps) {
  const c = scoreColor(typeof score === "number" ? score : null);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        NEW_CARD,
        "relative flex w-full flex-col items-start gap-3 p-4 text-left transition-all",
        onClick && "hover:border-white/20 hover:bg-[#161616] active:scale-[0.99] cursor-pointer",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/55">
          {label}
        </span>
        <span
          className="grid h-7 w-7 place-items-center rounded-full"
          style={{ backgroundColor: c.bg, color: c.fg }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <span className="text-2xl font-bold tabular-nums text-white">{value}</span>
      )}

      {trendBadge && !loading && (
        <span
          className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor:
              trendBadge.tone === "up"
                ? "rgba(16,185,129,0.12)"
                : trendBadge.tone === "down"
                ? "rgba(239,68,68,0.12)"
                : "rgba(255,255,255,0.06)",
            color:
              trendBadge.tone === "up"
                ? "#10B981"
                : trendBadge.tone === "down"
                ? "#EF4444"
                : "rgba(255,255,255,0.6)",
          }}
        >
          {trendBadge.text}
        </span>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────
export function VisaoGeralView({ defaultMes, selectedUnidadeId }: VisaoGeralViewProps) {
  const [mes, setMes] = useState(defaultMes ?? currentMonth());

  // ── Sheets ─────────────────────────────────────────
  const { raw: rawGeral, loading: loadingGeral } = useSheetData("checklist_geral");
  const { raw: rawChefias, loading: loadingChefias } = useSheetData("checklist_chefias");
  const { raw: rawNps } = useSheetData("nps_dashboard");
  const { raw: rawFat } = useSheetData("avaliacoes_fat");
  const { raw: rawBase } = useSheetData("base_avaliacoes");

  const npsData = useMemo(() => (rawNps ? parseNpsCSV(rawNps) : []), [rawNps]);
  const fatData = useMemo(() => (rawFat ? parseFaturamentoCSV(rawFat) : null), [rawFat]);
  const baseData = useMemo(() => (rawBase ? parseBaseAvaliacoesCSV(rawBase) : []), [rawBase]);

  const rankingGeral = useMemo(() => (rawGeral ? parseChecklistCSV(rawGeral) : []), [rawGeral]);
  // rankingChefias mantido para futuras seções (usar para evitar warning)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const rankingChefias = useMemo(() => (rawChefias ? parseChecklistCSV(rawChefias) : []), [rawChefias]);

  const rkGeral = useMemo(
    () => rankingGeral.find((r) => r.titulo.toUpperCase().includes("- GERAL"))?.rows ?? [],
    [rankingGeral],
  );
  const rkGerenteFront = useMemo(
    () => rankingGeral.find((r) => r.titulo.toUpperCase().includes("FRONT"))?.rows ?? [],
    [rankingGeral],
  );
  const rkGerenteBack = useMemo(
    () => rankingGeral.find((r) => r.titulo.toUpperCase().includes("BACK"))?.rows ?? [],
    [rankingGeral],
  );

  const sheetAvgFront = useMemo(() => avg(rkGerenteFront.map((r) => r.media)), [rkGerenteFront]);
  const sheetAvgBack = useMemo(() => avg(rkGerenteBack.map((r) => r.media)), [rkGerenteBack]);

  // ── Supabase ──────────────────────────────────────
  const overview = useQuery({
    queryKey: ["painel-overview", mes],
    queryFn: async () => {
      const { start, end } = monthRange(mes);
      const [scoresRes, reclamRes, supRes] = await Promise.all([
        supabase.from("leadership_store_scores").select("front_score, back_score, general_score").eq("month_year", mes),
        supabase.from("reclamacoes").select("id", { count: "exact", head: true }).eq("referencia_mes", mes),
        supabase.from("supervision_audits").select("global_score").gte("audit_date", start).lte("audit_date", end),
      ]);
      if (scoresRes.error) throw scoresRes.error;
      if (reclamRes.error) throw reclamRes.error;
      if (supRes.error) throw supRes.error;
      return {
        avgFront: avg(scoresRes.data?.map((r: any) => r.front_score) ?? []),
        avgBack: avg(scoresRes.data?.map((r: any) => r.back_score) ?? []),
        reclamCount: reclamRes.count ?? 0,
        avgSupervision: avg(supRes.data?.map((r: any) => r.global_score) ?? []),
      };
    },
  });

  const heatmap = useQuery({
    queryKey: ["painel-heatmap", mes],
    queryFn: async () => {
      const [lojasRes, scoresRes, reclamRes] = await Promise.all([
        supabase.from("config_lojas").select("id, nome").order("nome"),
        supabase
          .from("leadership_store_scores")
          .select("loja_id, front_score, back_score, general_score, general_tier, front_tier, back_tier")
          .eq("month_year", mes),
        supabase.from("reclamacoes").select("loja_id").eq("referencia_mes", mes),
      ]);
      if (lojasRes.error) throw lojasRes.error;
      if (scoresRes.error) throw scoresRes.error;
      if (reclamRes.error) throw reclamRes.error;

      const scoreMap = new Map<string, any>();
      (scoresRes.data ?? []).forEach((s: any) => scoreMap.set(s.loja_id, s));
      const reclamMap = new Map<string, number>();
      (reclamRes.data ?? []).forEach((r: any) => reclamMap.set(r.loja_id, (reclamMap.get(r.loja_id) ?? 0) + 1));

      return (lojasRes.data ?? []).map((loja: any) => {
        const s = scoreMap.get(loja.id);
        return {
          id: loja.id,
          nome: loja.nome,
          front_score: s?.front_score ?? null,
          back_score: s?.back_score ?? null,
          general_score: s?.general_score ?? null,
          front_tier: s?.front_tier ?? null,
          back_tier: s?.back_tier ?? null,
          general_tier: s?.general_tier ?? null,
          reclamacoes: reclamMap.get(loja.id) ?? 0,
        };
      });
    },
  });

  const unidades = useQuery({
    queryKey: ["painel-unidades-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config_lojas").select("id, nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const selectedUnidadeNome = useMemo(() => {
    if (!selectedUnidadeId || selectedUnidadeId === "all") return null;
    const found = (unidades.data ?? []).find((u: any) => u.id === selectedUnidadeId);
    return found?.nome ?? null;
  }, [selectedUnidadeId, unidades.data]);

  // ── Heatmap rows: Sheets + nps merge ──────────────
  const heatmapFromSheet = useMemo(() => {
    return rkGeral.map((row) => {
      const front = rkGerenteFront.find((r) => r.unidade === row.unidade);
      const back = rkGerenteBack.find((r) => r.unidade === row.unidade);
      const npsRow = npsData.find(
        (n) => n.loja.toUpperCase().trim() === row.unidade.toUpperCase().trim(),
      );
      return {
        id: row.unidade,
        nome: row.unidade,
        general_score: row.media,
        front_score: front?.media ?? null,
        back_score: back?.media ?? null,
        nps: npsRow?.media ?? null,
        front_tier: null as string | null,
        back_tier: null as string | null,
        general_tier: null as string | null,
        reclamacoes: 0,
      };
    });
  }, [rkGeral, rkGerenteFront, rkGerenteBack, npsData]);

  const heatmapRowsBase: any[] = heatmapFromSheet.length > 0 ? heatmapFromSheet : (heatmap.data ?? []);

  const heatmapRows = useMemo(() => {
    if (!selectedUnidadeNome) return heatmapRowsBase;
    const target = selectedUnidadeNome.toUpperCase().trim();
    return heatmapRowsBase.filter((r: any) => (r.nome ?? "").toUpperCase().trim() === target);
  }, [heatmapRowsBase, selectedUnidadeNome]);

  // ── Critical units (geral < 70) ───────────────────
  const criticalUnits = useMemo(
    () => heatmapRows.filter((r: any) => typeof r.general_score === "number" && r.general_score < 70),
    [heatmapRows],
  );

  // ── KPIs ──────────────────────────────────────────
  const displayAvgFront = sheetAvgFront ?? overview.data?.avgFront ?? null;
  const displayAvgBack = sheetAvgBack ?? overview.data?.avgBack ?? null;
  const isLoadingKpis = overview.isLoading || loadingGeral || loadingChefias;

  const frontTrend =
    typeof displayAvgFront === "number"
      ? displayAvgFront >= 85
        ? { text: "↑ acima da meta", tone: "up" as const }
        : { text: "↓ abaixo", tone: "down" as const }
      : null;

  const backTrend = useMemo(() => {
    if (typeof displayAvgBack !== "number") return null;
    if (typeof displayAvgFront === "number" && displayAvgBack < displayAvgFront - 10) {
      return { text: "↓ gap alto", tone: "down" as const };
    }
    if (displayAvgBack >= 85) return { text: "↑ acima da meta", tone: "up" as const };
    return { text: "↓ abaixo", tone: "down" as const };
  }, [displayAvgFront, displayAvgBack]);

  // ── State: alert sheet, KPI breakdown sheet, expanded row, comparison, IA sheet ──
  const [alertOpen, setAlertOpen] = useState(false);
  const [kpiBreakdown, setKpiBreakdown] = useState<{ kind: "front" | "back" | "general"; label: string } | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("mapa");
  const [iaSheet, setIaSheet] = useState<{ unidade: string; front: number | null; back: number | null; geral: number | null } | null>(null);

  const toggleCompare = (id: string, nome: string) => {
    setComparisonIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (next.length < 2 && activeTab === "comparativo") setActiveTab("mapa");
        return next;
      }
      toast.success(`${nome} adicionado à comparação`);
      return [...prev, id];
    });
  };

  const comparisonRows = useMemo(
    () => heatmapRowsBase.filter((r: any) => comparisonIds.includes(r.id)),
    [heatmapRowsBase, comparisonIds],
  );

  return (
    <div className="space-y-4">
      <MetaPageHeader metaKey="visao-geral" mes={mes} onMesChange={setMes} />

      {/* ── ALERT BANNER ── */}
      {criticalUnits.length > 0 && (
        <button
          type="button"
          onClick={() => setAlertOpen(true)}
          className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left transition-colors hover:bg-[rgba(239,68,68,0.12)]"
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            border: "0.5px solid rgba(239,68,68,0.25)",
          }}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
          </span>
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#EF4444]" />
          <span className="flex-1 text-sm">
            <strong className="text-[#EF4444]">
              {criticalUnits.length} unidade{criticalUnits.length > 1 ? "s" : ""} em alerta
            </strong>{" "}
            <span className="text-white/70">
              ({criticalUnits.map((u: any) => u.nome).join(", ")}) — clique para abrir plano de ação
            </span>
          </span>
        </button>
      )}

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Front Score Médio"
          value={typeof displayAvgFront === "number" ? `${formatNumberPt(displayAvgFront, 2)}%` : "—"}
          score={displayAvgFront}
          icon={TrendingUp}
          loading={isLoadingKpis}
          trendBadge={frontTrend}
          onClick={() => setKpiBreakdown({ kind: "front", label: "Front Score" })}
        />
        <KpiCard
          label="Back Score Médio"
          value={typeof displayAvgBack === "number" ? `${formatNumberPt(displayAvgBack, 2)}%` : "—"}
          score={displayAvgBack}
          icon={TrendingDown}
          loading={isLoadingKpis}
          trendBadge={backTrend}
          onClick={() => setKpiBreakdown({ kind: "back", label: "Back Score" })}
        />
        <KpiCard
          label="Reclamações no Mês"
          value={overview.data?.reclamCount?.toString() ?? "—"}
          score={null}
          icon={MessageCircle}
          loading={overview.isLoading}
          trendBadge={
            (overview.data?.reclamCount ?? 0) > 10
              ? { text: "↑ alto", tone: "down" }
              : { text: "estável", tone: "neutral" }
          }
        />
        <KpiCard
          label="Auditoria Supervisão"
          value={
            typeof overview.data?.avgSupervision === "number"
              ? `${formatNumberPt(overview.data.avgSupervision, 1)}`
              : "—"
          }
          score={overview.data?.avgSupervision ?? null}
          icon={Trophy}
          loading={overview.isLoading}
          trendBadge={null}
        />
      </div>

      {/* ── COMPARATIVO BANNER ── */}
      {comparisonIds.length >= 2 && (
        <div
          className="flex flex-col gap-2 rounded-[14px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{
            backgroundColor: "rgba(16,185,129,0.08)",
            border: "0.5px solid rgba(16,185,129,0.25)",
          }}
        >
          <div className="flex items-center gap-3 text-sm">
            <BarChart3 className="h-4 w-4 text-[#10B981]" />
            <span className="text-white/85">
              <strong className="text-[#10B981]">Comparando {comparisonIds.length} unidades:</strong>{" "}
              {comparisonRows.map((r: any) => r.nome).join(", ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-white/60 hover:text-white"
              onClick={() => setComparisonIds([])}
            >
              Limpar
            </Button>
            <Button
              size="sm"
              className="h-8 bg-[#10B981] text-black hover:bg-[#10B981]/90"
              onClick={() => setActiveTab("comparativo")}
            >
              Ver gráfico comparativo
            </Button>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#111111] border-[0.5px] border-white/[0.06] rounded-[14px] p-1 h-auto">
          <TabsTrigger value="mapa" className="text-xs rounded-[10px] data-[state=active]:bg-white/10">
            Mapa de Calor
          </TabsTrigger>
          <TabsTrigger value="nps" className="text-xs rounded-[10px] data-[state=active]:bg-white/10">
            NPS por Loja
          </TabsTrigger>
          <TabsTrigger value="faturamento" className="text-xs rounded-[10px] data-[state=active]:bg-white/10">
            Faturamento
          </TabsTrigger>
          {comparisonIds.length >= 2 && (
            <TabsTrigger value="comparativo" className="text-xs rounded-[10px] data-[state=active]:bg-white/10">
              Comparativo ({comparisonIds.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─ TAB: MAPA ─ */}
        <TabsContent value="mapa" className="mt-3 space-y-4">
          <div className={cn(NEW_CARD)}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <Building2 className="h-4 w-4 text-white/70" />
              <span className="text-xs font-bold uppercase tracking-widest text-white/85">
                Mapa de Calor — Metas por Unidade
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-white/55 text-[11px] uppercase tracking-wider">Unidade</TableHead>
                    <TableHead className="text-center text-white/55 text-[11px] uppercase tracking-wider">Front</TableHead>
                    <TableHead className="text-center text-white/55 text-[11px] uppercase tracking-wider">Back</TableHead>
                    <TableHead className="text-center text-white/55 text-[11px] uppercase tracking-wider">Geral</TableHead>
                    <TableHead className="text-center text-white/55 text-[11px] uppercase tracking-wider">Reclam.</TableHead>
                    <TableHead className="text-center text-white/55 text-[11px] uppercase tracking-wider">Tier</TableHead>
                    <TableHead className="text-center text-white/55 text-[11px] uppercase tracking-wider">Class.</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(heatmap.isLoading || loadingGeral) && heatmapRows.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-white/[0.06]">
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : heatmapRows.length === 0 ? (
                    <TableRow className="border-white/[0.06]">
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-white/55">
                        Nenhuma unidade disponível para este mês
                      </TableCell>
                    </TableRow>
                  ) : (
                    heatmapRows.map((row: any) => {
                      const isCritical = typeof row.general_score === "number" && row.general_score < 70;
                      const isExpanded = expandedRow === row.id;
                      const isComparing = comparisonIds.includes(row.id);
                      const tierC = tierSABCD(row.general_score);
                      return (
                        <>
                          <TableRow
                            key={row.id}
                            className={cn(
                              "group cursor-pointer border-white/[0.06] transition-colors hover:bg-white/[0.03]",
                              isExpanded && "bg-white/[0.04]",
                              isComparing && "bg-[rgba(16,185,129,0.04)]",
                            )}
                            style={isCritical ? { borderLeft: "2px solid #EF4444" } : undefined}
                            onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                          >
                            <TableCell className="font-medium text-white/90">{row.nome}</TableCell>
                            <TableCell className="text-center"><ScorePill score={row.front_score} /></TableCell>
                            <TableCell className="text-center"><ScorePill score={row.back_score} /></TableCell>
                            <TableCell className="text-center"><ScorePill score={row.general_score} /></TableCell>
                            <TableCell className="text-center tabular-nums">
                              <span
                                className={cn(
                                  "inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md px-2 text-xs font-semibold",
                                  row.reclamacoes >= 5
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-white/[0.06] text-white/70",
                                )}
                              >
                                {row.reclamacoes}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "uppercase tracking-wide text-[10px] font-bold border-0",
                                  tierClasses(row.general_tier),
                                )}
                              >
                                {tierLabel(row.general_tier)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {tierC ? (
                                <span
                                  className="inline-grid h-7 w-7 place-items-center rounded-md text-xs font-bold tabular-nums"
                                  style={{ backgroundColor: tierC.bg, color: tierC.color }}
                                >
                                  {tierC.letter}
                                </span>
                              ) : (
                                <span className="text-white/40">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCompare(row.id, row.nome);
                                  }}
                                  className={cn(
                                    "rounded-md px-2 py-1 text-[10px] font-bold uppercase transition-all",
                                    isComparing
                                      ? "bg-[#10B981]/20 text-[#10B981]"
                                      : "opacity-0 group-hover:opacity-100 bg-white/[0.06] text-white/70 hover:bg-white/[0.12]",
                                  )}
                                  title={isComparing ? "Remover da comparação" : "Adicionar à comparação"}
                                >
                                  <Plus className={cn("h-3 w-3 inline", isComparing && "rotate-45")} />
                                  <span className="ml-1">{isComparing ? "Sel." : "Comp."}</span>
                                </button>
                                <ChevronDown
                                  className={cn(
                                    "h-4 w-4 text-white/40 transition-transform",
                                    isExpanded && "rotate-180 text-white/80",
                                  )}
                                />
                              </div>
                            </TableCell>
                          </TableRow>

                          {isExpanded && (
                            <TableRow key={`${row.id}-exp`} className="border-white/[0.06] hover:bg-transparent">
                              <TableCell colSpan={8} className="bg-[#0A0A0A] p-4">
                                <ExpandedDetail
                                  row={row}
                                  onGeneratePlan={() =>
                                    setIaSheet({
                                      unidade: row.nome,
                                      front: row.front_score,
                                      back: row.back_score,
                                      geral: row.general_score,
                                    })
                                  }
                                  onCompare={() => toggleCompare(row.id, row.nome)}
                                  isComparing={isComparing}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ─ TAB: NPS ─ */}
        <TabsContent value="nps" className="mt-3">
          <NpsCard data={npsData} loading={!rawNps} />
          <div className="mt-4">
            <DistribuicaoCard data={baseData} loading={!rawBase} />
          </div>
        </TabsContent>

        {/* ─ TAB: FATURAMENTO ─ */}
        <TabsContent value="faturamento" className="mt-3">
          <FatVsAvalCard data={fatData} loading={!rawFat} />
        </TabsContent>

        {/* ─ TAB: COMPARATIVO ─ */}
        {comparisonIds.length >= 2 && (
          <TabsContent value="comparativo" className="mt-3">
            <ComparisonChart rows={comparisonRows} />
          </TabsContent>
        )}
      </Tabs>

      {/* ── ALERT SHEET (unidades críticas) ── */}
      <Sheet open={alertOpen} onOpenChange={setAlertOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#0A0A0A] border-white/[0.06] text-white">
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#EF4444]" />
              Unidades em alerta
            </SheetTitle>
            <SheetDescription className="text-white/55">
              {criticalUnits.length} unidade{criticalUnits.length > 1 ? "s" : ""} com Geral abaixo de 70%.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {criticalUnits.map((u: any) => (
              <div
                key={u.id}
                className={cn(NEW_CARD, "flex items-center justify-between gap-3 p-3")}
              >
                <div>
                  <div className="text-sm font-semibold text-white">{u.nome}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] uppercase text-white/50">Geral</span>
                    <ScorePill score={u.general_score} />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-[#D05937] text-white hover:bg-[#D05937]/90"
                  onClick={() => {
                    setAlertOpen(false);
                    setIaSheet({
                      unidade: u.nome,
                      front: u.front_score,
                      back: u.back_score,
                      geral: u.general_score,
                    });
                  }}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Plano IA
                </Button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── KPI BREAKDOWN SHEET ── */}
      <Sheet open={!!kpiBreakdown} onOpenChange={(v) => !v && setKpiBreakdown(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#0A0A0A] border-white/[0.06] text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Breakdown — {kpiBreakdown?.label}</SheetTitle>
            <SheetDescription className="text-white/55">
              Desempenho por unidade no mês {mes}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {heatmapRowsBase
              .map((r: any) => ({
                nome: r.nome,
                value:
                  kpiBreakdown?.kind === "front"
                    ? r.front_score
                    : kpiBreakdown?.kind === "back"
                    ? r.back_score
                    : r.general_score,
              }))
              .filter((r) => typeof r.value === "number")
              .sort((a, b) => (b.value as number) - (a.value as number))
              .map((r) => (
                <div
                  key={r.nome}
                  className={cn(NEW_CARD, "flex items-center justify-between p-3")}
                >
                  <span className="text-sm text-white/85">{r.nome}</span>
                  <ScorePill score={r.value as number} />
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── IA PLANO DE AÇÃO SHEET ── */}
      <PlanoAcaoSheet data={iaSheet} onClose={() => setIaSheet(null)} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Expanded row detail — métricas + barras + ações
// ──────────────────────────────────────────────────────────────
function ExpandedDetail({
  row,
  onGeneratePlan,
  onCompare,
  isComparing,
}: {
  row: any;
  onGeneratePlan: () => void;
  onCompare: () => void;
  isComparing: boolean;
}) {
  const metrics = [
    { label: "Geral", value: row.general_score },
    { label: "Front", value: row.front_score },
    { label: "Back", value: row.back_score },
  ];
  const bars = [
    { label: "Front", value: row.front_score, max: 100 },
    { label: "Back", value: row.back_score, max: 100 },
    { label: "Geral", value: row.general_score, max: 100 },
    { label: "NPS", value: row.nps !== null && row.nps !== undefined ? (row.nps / 5) * 100 : null, max: 100, raw: row.nps },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="grid grid-cols-3 gap-2">
        {metrics.map((m) => {
          const c = scoreColor(m.value);
          return (
            <div
              key={m.label}
              className="rounded-[10px] p-3"
              style={{ backgroundColor: c.bg, border: `0.5px solid ${c.fg}33` }}
            >
              <div className="text-[10px] uppercase tracking-widest text-white/55">{m.label}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: c.fg }}>
                {typeof m.value === "number" ? `${m.value.toFixed(0)}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {bars.map((b) => {
          const c = scoreColor(b.value);
          const pct = typeof b.value === "number" ? Math.min(100, Math.max(0, b.value)) : 0;
          return (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-[11px] font-semibold uppercase text-white/55">{b.label}</span>
              <div className="relative flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: c.fg }}
                />
              </div>
              <span className="w-12 text-right text-[11px] font-bold tabular-nums" style={{ color: c.fg }}>
                {b.label === "NPS" && typeof (b as any).raw === "number"
                  ? (b as any).raw.toFixed(2)
                  : typeof b.value === "number"
                  ? `${b.value.toFixed(0)}%`
                  : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-[#D05937] text-white hover:bg-[#D05937]/90"
          onClick={onGeneratePlan}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Gerar plano de ação
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "border-white/15 text-white/85 hover:bg-white/10 hover:text-white",
            isComparing && "border-[#10B981]/40 text-[#10B981]",
          )}
          onClick={onCompare}
        >
          <Plus className={cn("mr-1.5 h-3.5 w-3.5", isComparing && "rotate-45")} />
          {isComparing ? "Remover da comparação" : "Comparar"}
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Comparison chart
// ──────────────────────────────────────────────────────────────
function ComparisonChart({ rows }: { rows: any[] }) {
  const chartData = useMemo(
    () => [
      { metric: "Front", ...Object.fromEntries(rows.map((r) => [r.nome, r.front_score ?? 0])) },
      { metric: "Back", ...Object.fromEntries(rows.map((r) => [r.nome, r.back_score ?? 0])) },
      { metric: "Geral", ...Object.fromEntries(rows.map((r) => [r.nome, r.general_score ?? 0])) },
    ],
    [rows],
  );

  const unitNames = rows.map((r) => r.nome).join(" · ");

  return (
    <div className={cn(NEW_CARD, "p-4")}>
      <div className="mb-3">
        <div
          className="text-[11px] font-semibold text-[#666] uppercase"
          style={{ letterSpacing: "0.06em" }}
        >
          Comparativo de performance
        </div>
        <div className="mt-1 text-xs text-amber-400/90">{unitNames}</div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: "#666" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[50, 100]}
            tick={{ fontSize: 11, fill: "#555" }}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine
            y={85}
            stroke="rgba(16,185,129,0.2)"
            strokeDasharray="4 4"
            label={{
              value: "meta 85%",
              fill: "#10B981",
              fontSize: 10,
              position: "right",
            }}
          />
          <RTooltip
            contentStyle={{
              background: "#161616",
              border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#888", marginBottom: "6px" }}
            formatter={(value: any, name: any) => [`${Number(value).toFixed(1)}%`, name]}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#666", marginTop: "12px" }}
            iconType="circle"
            iconSize={6}
          />
          {rows.map((r, i) => {
            const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
            return (
              <Line
                key={r.id}
                type="monotone"
                dataKey={r.nome}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 4, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={600}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Plano de Ação IA Sheet
// ──────────────────────────────────────────────────────────────
function PlanoAcaoSheet({
  data,
  onClose,
}: {
  data: { unidade: string; front: number | null; back: number | null; geral: number | null } | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = async () => {
    if (!data) return;
    setContent("");
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plano-acao-ia`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unidade: data.unidade,
          frontScore: data.front,
          backScore: data.back,
          geralScore: data.geral,
        }),
        signal: ctrl.signal,
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          toast.error("Muitas requisições. Tente em alguns instantes.");
        } else if (resp.status === 402) {
          toast.error("Créditos de IA esgotados.");
        } else {
          toast.error("Erro ao gerar plano de ação.");
        }
        setLoading(false);
        return;
      }
      if (!resp.body) {
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(json);
            const c = p.choices?.[0]?.delta?.content;
            if (c) {
              acc += c;
              setContent(acc);
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error(e);
        toast.error("Falha de rede ao gerar plano.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Quando abre, dispara stream
  const open = !!data;
  const prevUnidade = useRef<string | null>(null);
  if (open && data && prevUnidade.current !== data.unidade) {
    prevUnidade.current = data.unidade;
    setTimeout(startStream, 50);
  }
  if (!open) prevUnidade.current = null;

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    toast.success("Plano copiado para a área de transferência");
  };

  const handleWhats = () => {
    if (!content || !data) return;
    const txt = `*Plano de Ação — ${data.unidade}*\n\n${content}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] bg-[#0A0A0A] border-white/[0.06] text-white overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D05937]" />
            Plano de ação — {data?.unidade}
          </SheetTitle>
          <SheetDescription className="text-white/55">
            Gerado por IA com base nos indicadores de Front, Back e Geral.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 text-white/85 hover:bg-white/10 hover:text-white"
            onClick={handleCopy}
            disabled={!content || loading}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copiar
          </Button>
          <Button
            size="sm"
            className="bg-[#25D366] text-black hover:bg-[#25D366]/90"
            onClick={handleWhats}
            disabled={!content || loading}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            WhatsApp
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-white/60 hover:text-white"
            onClick={startStream}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Regenerar"}
          </Button>
        </div>

        <div className="mt-4 rounded-[12px] border-[0.5px] border-white/[0.06] bg-[#111] p-4">
          {loading && !content ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : content ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/85">
              {content}
              {loading && <span className="ml-1 inline-block h-4 w-1.5 animate-pulse bg-[#D05937]" />}
            </pre>
          ) : (
            <p className="text-sm text-white/50">Nenhum conteúdo gerado.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ──────────────────────────────────────────────────────────────
// SEÇÃO A — NPS
// ──────────────────────────────────────────────────────────────
function NpsCard({ data, loading }: { data: { loja: string; media: number }[]; loading: boolean }) {
  const META = 4.8;
  const barColor = (v: number) => {
    if (v >= 4.8) return "#10B981";
    if (v >= 4.5) return "#84cc16";
    return "rgba(255,255,255,0.3)";
  };
  return (
    <div className={cn(NEW_CARD)}>
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-white/70" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/85">
            NPS — Média de Notas
          </span>
        </div>
        <p className="mt-1 text-[11px] text-white/50">Google + TripAdvisor · meta ≥ 4,80</p>
      </div>
      <div className="space-y-2.5 p-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full animate-pulse" />)
        ) : data.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/50">Sem dados disponíveis</p>
        ) : (
          data.map((row) => {
            const pct = Math.min(100, Math.max(0, (row.media / 5) * 100));
            const passed = row.media >= META;
            return (
              <div key={row.loja} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-right text-[11px] font-medium text-white/55">
                  {row.loja}
                </span>
                <div className="relative flex-1 h-5 rounded-md bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all"
                    style={{ width: `${pct}%`, backgroundColor: barColor(row.media) }}
                  />
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-bold text-white/90 tabular-nums">
                    {row.media.toFixed(3).replace(".", ",")}
                  </span>
                </div>
                {passed ? (
                  <Check className="h-4 w-4 shrink-0" style={{ color: "#10B981" }} />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-[#EF4444]" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SEÇÃO B — Distribuição
// ──────────────────────────────────────────────────────────────
function DistribuicaoCard({
  data,
  loading,
}: {
  data: { nota: number; total: number; pct: number }[];
  loading: boolean;
}) {
  const total5 = data.find((d) => d.nota === 5);
  const totalAll = data.reduce((s, d) => s + (d.total || 0), 0);
  const colorByNota = (n: number) => {
    if (n === 5) return "#10B981";
    if (n === 4) return "#84cc16";
    if (n === 3) return "#EAB308";
    if (n === 2) return "#F97316";
    return "#EF4444";
  };

  return (
    <div className={cn(NEW_CARD)}>
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-white/70" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/85">
            Distribuição de Notas
          </span>
        </div>
        <p className="mt-1 text-[11px] text-white/50">todas as plataformas</p>
      </div>
      <div className="space-y-3 p-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-32 animate-pulse" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/50">Sem dados disponíveis</p>
        ) : (
          <>
            <div>
              <div className="text-3xl font-bold tabular-nums" style={{ color: "#10B981" }}>
                {total5 ? `${total5.pct.toFixed(2).replace(".", ",")}%` : "—"}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-white/55">
                de avaliações 5 estrelas
              </div>
            </div>
            <div className="space-y-1.5">
              {data.map((row) => {
                const pct = Math.min(100, Math.max(0, row.pct));
                return (
                  <div key={row.nota} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] font-bold tabular-nums text-white/85">
                      {row.nota}★
                    </span>
                    <div className="relative flex-1 h-4 rounded-md bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all"
                        style={{ width: `${pct}%`, backgroundColor: colorByNota(row.nota) }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums text-white/85">
                      {row.pct.toFixed(2).replace(".", ",")}%
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/55">
                      {row.total.toLocaleString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>
            {totalAll > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.06]">
                {["iFood", "Google", "TripAdvisor", "Get In", "Instagram", "WhatsApp"].map((p) => (
                  <Badge
                    key={p}
                    variant="outline"
                    className="text-[10px] font-medium uppercase tracking-wide border-white/[0.1] text-white/70"
                  >
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SEÇÃO C — Avaliações 1-3 × Faturamento
// ──────────────────────────────────────────────────────────────
function FatVsAvalCard({
  data,
  loading,
}: {
  data: {
    salao: Array<{ loja: string; av13: number; totalAv: number; pctAv13: number; faturamento: number; rPorAv: number }>;
    delivery: Array<{ loja: string; av13: number; totalAv: number; pctAv13: number; faturamento: number; rPorAv: number }>;
  } | null;
  loading: boolean;
}) {
  const [tab, setTab] = useState<"salao" | "delivery">("salao");
  const rows = data ? (tab === "salao" ? data.salao : data.delivery) : [];

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const fmtNum = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  const rPorAvStyle = (v: number): { bg: string; color: string } => {
    if (v >= 120000) return { bg: "rgba(16,185,129,.15)", color: "#10B981" };
    if (v >= 95000) return { bg: "rgba(234,179,8,.15)", color: "#EAB308" };
    if (v >= 70000) return { bg: "rgba(249,115,22,.15)", color: "#F97316" };
    return { bg: "rgba(239,68,68,.15)", color: "#EF4444" };
  };

  return (
    <div className={cn(NEW_CARD)}>
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-white/70" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/85">
              Avaliações 1-3 × Faturamento
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/50">Abril 2026</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "salao" | "delivery")}>
          <TabsList className="h-8 bg-white/[0.06]">
            <TabsTrigger value="salao" className="text-xs">Salão</TabsTrigger>
            <TabsTrigger value="delivery" className="text-xs">Delivery</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-white/55 text-[11px] uppercase">Loja</TableHead>
              <TableHead className="text-center text-white/55 text-[11px] uppercase">Aval. 1-3</TableHead>
              <TableHead className="text-center text-white/55 text-[11px] uppercase">Total</TableHead>
              <TableHead className="text-center text-white/55 text-[11px] uppercase">%</TableHead>
              <TableHead className="text-right text-white/55 text-[11px] uppercase">Faturamento</TableHead>
              <TableHead className="text-right text-white/55 text-[11px] uppercase">R$/Avaliação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-white/[0.06]">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="border-white/[0.06]">
                <TableCell colSpan={6} className="py-8 text-center text-xs text-white/50">
                  Sem dados disponíveis
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const st = rPorAvStyle(row.rPorAv);
                return (
                  <TableRow key={row.loja} className="border-white/[0.06]">
                    <TableCell className="font-medium text-white/90">{row.loja}</TableCell>
                    <TableCell className="text-center tabular-nums text-white/85">{fmtNum(row.av13)}</TableCell>
                    <TableCell className="text-center tabular-nums text-white/85">{fmtNum(row.totalAv)}</TableCell>
                    <TableCell className="text-center tabular-nums text-white/85">
                      {row.pctAv13.toFixed(2).replace(".", ",")}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-white/85">{fmtBRL(row.faturamento)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold"
                        style={{ backgroundColor: st.bg, color: st.color }}
                      >
                        {fmtBRL(row.rPorAv)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-white/[0.06]">
        {[
          { label: "≥ R$ 120k", bg: "rgba(16,185,129,.15)", color: "#10B981" },
          { label: "≥ R$ 95k", bg: "rgba(234,179,8,.15)", color: "#EAB308" },
          { label: "≥ R$ 70k", bg: "rgba(249,115,22,.15)", color: "#F97316" },
          { label: "< R$ 70k", bg: "rgba(239,68,68,.15)", color: "#EF4444" },
        ].map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: c.bg, color: c.color }}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
