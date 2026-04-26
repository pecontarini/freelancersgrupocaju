import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LayoutDashboard,
  MessageSquare,
  ClipboardCheck,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Trophy,
  MessageCircle,
  Store,
  Truck,
  Utensils,
  Timer,
  Building2,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PainelMetasTabProps {
  selectedUnidadeId: string | null;
}

const SUBTABS = [
  { value: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { value: "nps", label: "NPS", icon: MessageSquare },
  { value: "conformidade", label: "Conformidade", icon: ClipboardCheck },
  { value: "planos", label: "Planos de Ação", icon: ListChecks },
] as const;

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthPt(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthRange(mes: string): { start: string; end: string } {
  const [y, m] = mes.split("-").map(Number);
  const start = `${mes}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${mes}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function tierClasses(tier: string | null | undefined): string {
  switch (tier) {
    case "ouro":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
    case "prata":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-200";
    case "bronze":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
    case "aceitavel":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function tierLabel(tier: string | null | undefined): string {
  if (!tier) return "—";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function progressBarColor(score: number | null): string {
  if (score === null) return "[&>div]:bg-muted-foreground/40";
  if (score >= 90) return "[&>div]:bg-emerald-500";
  if (score >= 75) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

function ScoreBadge({ score, tier }: { score: number | null | undefined; tier: string | null | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums min-w-[3.5rem]",
        tierClasses(tier)
      )}
    >
      {typeof score === "number" ? score.toFixed(1) : "—"}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────
// Visão Geral
// ──────────────────────────────────────────────────────────────

function VisaoGeral() {
  const [mes, setMes] = useState<string>(currentMonth());

  const overview = useQuery({
    queryKey: ["painel-overview", mes],
    queryFn: async () => {
      const { start, end } = monthRange(mes);

      const [scoresRes, reclamRes, supRes] = await Promise.all([
        supabase
          .from("leadership_store_scores")
          .select("front_score, back_score, general_score")
          .eq("month_year", mes),
        supabase
          .from("reclamacoes")
          .select("id", { count: "exact", head: true })
          .eq("referencia_mes", mes),
        supabase
          .from("supervision_audits")
          .select("global_score")
          .gte("audit_date", start)
          .lte("audit_date", end),
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
          .select(
            "loja_id, front_score, back_score, general_score, general_tier, front_tier, back_tier"
          )
          .eq("month_year", mes),
        supabase.from("reclamacoes").select("loja_id").eq("referencia_mes", mes),
      ]);

      if (lojasRes.error) throw lojasRes.error;
      if (scoresRes.error) throw scoresRes.error;
      if (reclamRes.error) throw reclamRes.error;

      const scoreMap = new Map<string, any>();
      (scoresRes.data ?? []).forEach((s: any) => scoreMap.set(s.loja_id, s));

      const reclamMap = new Map<string, number>();
      (reclamRes.data ?? []).forEach((r: any) => {
        reclamMap.set(r.loja_id, (reclamMap.get(r.loja_id) ?? 0) + 1);
      });

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

  const criticalUnits = useMemo(
    () => (heatmap.data ?? []).filter((r) => r.general_tier === "aceitavel"),
    [heatmap.data]
  );

  const isLoadingKpis = overview.isLoading;
  const isLoadingHeatmap = heatmap.isLoading;

  return (
    <div className="space-y-4">
      {/* BLOCO 1 — Seletor de mês */}
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center gap-3 p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMes((m) => shiftMonth(m, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Período
            </div>
            <div className="text-base font-semibold">{formatMonthPt(mes)}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMes((m) => shiftMonth(m, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* BLOCO 4 — Banner crítico */}
      {criticalUnits.length > 0 && (
        <Alert variant="destructive" className="glass-card border-destructive/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> {criticalUnits.length} unidade
            {criticalUnits.length > 1 ? "s" : ""} com performance crítica este mês:{" "}
            {criticalUnits.map((u) => u.nome).join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      {/* BLOCO 2 — KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Back Score Médio"
          icon={TrendingDown}
          value={overview.data?.avgBack ?? null}
          loading={isLoadingKpis}
          showProgress
          suffix="/100"
        />
        <KpiCard
          title="Front Score Médio"
          icon={TrendingUp}
          value={overview.data?.avgFront ?? null}
          loading={isLoadingKpis}
          showProgress
          suffix="/100"
        />
        <KpiCard
          title="Reclamações no Mês"
          icon={MessageCircle}
          value={overview.data?.reclamCount ?? 0}
          loading={isLoadingKpis}
          integer
          helper="registradas"
        />
        <KpiCard
          title="Auditoria Supervisão"
          icon={Trophy}
          value={overview.data?.avgSupervision ?? null}
          loading={isLoadingKpis}
          showProgress
          suffix="/100"
        />
      </div>

      {/* BLOCO 3 — Mapa de Calor */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mapa de Calor por Unidade</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">Front Score</TableHead>
                <TableHead className="text-center">Back Score</TableHead>
                <TableHead className="text-center">Score Geral</TableHead>
                <TableHead className="text-center">Reclamações</TableHead>
                <TableHead className="text-center">Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingHeatmap ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (heatmap.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma unidade disponível para este mês
                  </TableCell>
                </TableRow>
              ) : (
                (heatmap.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.nome}</TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={row.front_score} tier={row.front_tier} />
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={row.back_score} tier={row.back_tier} />
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={row.general_score} tier={row.general_tier} />
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {row.reclamacoes > 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold min-w-[2rem]",
                            row.reclamacoes >= 5
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-muted text-foreground"
                          )}
                        >
                          {row.reclamacoes}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wide",
                          tierClasses(row.general_tier)
                        )}
                      >
                        {tierLabel(row.general_tier)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// KPI Card
// ──────────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number | null;
  loading: boolean;
  showProgress?: boolean;
  integer?: boolean;
  suffix?: string;
  helper?: string;
}

function KpiCard({ title, icon: Icon, value, loading, showProgress, integer, suffix, helper }: KpiCardProps) {
  const display =
    value === null
      ? "—"
      : integer
      ? Math.round(value).toString()
      : value.toFixed(1);

  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <Icon className="h-4 w-4 text-primary/70" />
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-9 w-24" />
        ) : (
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums">{display}</span>
            {suffix && value !== null && (
              <span className="text-sm font-medium text-muted-foreground">{suffix}</span>
            )}
          </div>
        )}
        {showProgress && !loading && (
          <Progress
            value={value ?? 0}
            className={cn("mt-3 h-1.5", progressBarColor(value))}
          />
        )}
        {helper && !loading && (
          <div className="mt-2 text-xs text-muted-foreground">{helper}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// NPS — helpers
// ──────────────────────────────────────────────────────────────

const FONTE_LABELS: Record<string, string> = {
  google: "Google",
  ifood: "iFood",
  tripadvisor: "TripAdvisor",
  getin: "Getin",
  manual: "Manual",
  sheets: "Sheets",
};

const PIE_COLORS = ["#D05937", "#F59E0B", "#EF4444", "#10B981", "#0EA5E9", "#8B5CF6"];

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortMonthLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const month = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${month.charAt(0).toUpperCase() + month.slice(1)}/${String(y).slice(2)}`;
}

type FaixaSalao = "EXCELENTE" | "BOM" | "REGULAR" | "RED_FLAG";

function classifyFaixaSalao(rPorReclam: number | null): FaixaSalao | null {
  if (rPorReclam === null) return null;
  if (rPorReclam >= 120000) return "EXCELENTE";
  if (rPorReclam >= 95000) return "BOM";
  if (rPorReclam >= 70000) return "REGULAR";
  return "RED_FLAG";
}

function faixaBadgeVariant(faixa: FaixaSalao | null): "default" | "secondary" | "outline" | "destructive" {
  switch (faixa) {
    case "EXCELENTE":
      return "default";
    case "BOM":
      return "secondary";
    case "REGULAR":
      return "outline";
    case "RED_FLAG":
      return "destructive";
    default:
      return "outline";
  }
}

// ──────────────────────────────────────────────────────────────
// NPS View
// ──────────────────────────────────────────────────────────────

function NpsView() {
  const [mes, setMes] = useState<string>(currentMonth());

  const reclamQ = useQuery({
    queryKey: ["painel-nps", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reclamacoes")
        .select("id, loja_id, fonte, tipo_operacao, config_lojas(nome)")
        .eq("referencia_mes", mes);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const perfQ = useQuery({
    queryKey: ["painel-nps-perf", mes],
    queryFn: async () => {
      const { start, end } = monthRange(mes);
      const { data, error } = await supabase
        .from("store_performance_entries")
        .select("loja_id, faturamento_salao, faturamento_delivery, config_lojas(nome)")
        .gte("entry_date", start)
        .lte("entry_date", end);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const last6 = useMemo(
    () => Array.from({ length: 6 }, (_, i) => shiftMonth(mes, -(5 - i))),
    [mes]
  );

  const histQ = useQuery({
    queryKey: ["painel-nps-hist", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reclamacoes")
        .select("referencia_mes, tipo_operacao")
        .in("referencia_mes", last6);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // KPIs counts
  const totalSalao = useMemo(
    () => (reclamQ.data ?? []).filter((r) => r.tipo_operacao === "salao").length,
    [reclamQ.data]
  );
  const totalDelivery = useMemo(
    () => (reclamQ.data ?? []).filter((r) => r.tipo_operacao === "delivery").length,
    [reclamQ.data]
  );

  // Ranking por unidade (cruzamento)
  const ranking = useMemo(() => {
    const reclam = reclamQ.data ?? [];
    const perf = perfQ.data ?? [];

    type Row = {
      loja_id: string;
      nome: string;
      faturamento_salao: number;
      reclamacoes: number;
      r_por_reclam: number | null;
    };

    const map = new Map<string, Row>();

    perf.forEach((p: any) => {
      const id = p.loja_id;
      if (!id) return;
      const cur = map.get(id) ?? {
        loja_id: id,
        nome: p.config_lojas?.nome ?? "—",
        faturamento_salao: 0,
        reclamacoes: 0,
        r_por_reclam: null,
      };
      cur.faturamento_salao += Number(p.faturamento_salao ?? 0);
      if (p.config_lojas?.nome) cur.nome = p.config_lojas.nome;
      map.set(id, cur);
    });

    reclam
      .filter((r: any) => r.tipo_operacao === "salao")
      .forEach((r: any) => {
        const id = r.loja_id;
        if (!id) return;
        const cur = map.get(id) ?? {
          loja_id: id,
          nome: r.config_lojas?.nome ?? "—",
          faturamento_salao: 0,
          reclamacoes: 0,
          r_por_reclam: null,
        };
        cur.reclamacoes += 1;
        if (r.config_lojas?.nome && cur.nome === "—") cur.nome = r.config_lojas.nome;
        map.set(id, cur);
      });

    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      r_por_reclam: r.reclamacoes > 0 ? r.faturamento_salao / r.reclamacoes : null,
    }));

    rows.sort((a, b) => {
      if (a.r_por_reclam === null && b.r_por_reclam === null) return 0;
      if (a.r_por_reclam === null) return 1;
      if (b.r_por_reclam === null) return -1;
      return b.r_por_reclam - a.r_por_reclam;
    });

    return rows;
  }, [reclamQ.data, perfQ.data]);

  const withRatio = useMemo(
    () => ranking.filter((r) => r.r_por_reclam !== null),
    [ranking]
  );
  const melhor = withRatio[0] ?? null;
  const pior = withRatio[withRatio.length - 1] ?? null;

  // Pie data (canais)
  const pieData = useMemo(() => {
    const counts = new Map<string, number>();
    (reclamQ.data ?? []).forEach((r: any) => {
      const k = r.fonte ?? "manual";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([fonte, value]) => ({
      name: FONTE_LABELS[fonte] ?? fonte,
      value,
    }));
  }, [reclamQ.data]);

  // Line data (evolução)
  const lineData = useMemo(() => {
    const rows = histQ.data ?? [];
    return last6.map((m) => {
      const inMonth = rows.filter((r: any) => r.referencia_mes === m);
      return {
        mes: shortMonthLabel(m),
        Salão: inMonth.filter((r: any) => r.tipo_operacao === "salao").length,
        Delivery: inMonth.filter((r: any) => r.tipo_operacao === "delivery").length,
      };
    });
  }, [histQ.data, last6]);

  const isLoading = reclamQ.isLoading || perfQ.isLoading;

  return (
    <div className="space-y-4">
      {/* Seletor de mês */}
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center gap-3 p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMes((m) => shiftMonth(m, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Período
            </div>
            <div className="text-base font-semibold">{formatMonthPt(mes)}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMes((m) => shiftMonth(m, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* BLOCO 1 — KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Reclamações Salão"
          icon={Store}
          value={totalSalao}
          loading={isLoading}
          integer
          helper="no mês"
        />
        <KpiCard
          title="Reclamações Delivery"
          icon={Truck}
          value={totalDelivery}
          loading={isLoading}
          integer
          helper="no mês"
        />
        <KpiUnitCard
          title="Pior R$/Reclamação"
          icon={TrendingDown}
          loading={isLoading}
          unitName={pior?.nome ?? null}
          value={pior?.r_por_reclam ?? null}
          tone="bad"
        />
        <KpiUnitCard
          title="Melhor R$/Reclamação"
          icon={Trophy}
          loading={isLoading}
          unitName={melhor?.nome ?? null}
          value={melhor?.r_por_reclam ?? null}
          tone="good"
        />
      </div>

      {/* BLOCO 2 — Ranking */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ranking por Unidade — Salão</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Fat. Salão</TableHead>
                <TableHead className="text-center">Reclamações</TableHead>
                <TableHead className="text-right">R$/Reclamação</TableHead>
                <TableHead className="text-center">Faixa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : ranking.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sem dados de faturamento ou reclamações para este mês
                  </TableCell>
                </TableRow>
              ) : (
                ranking.map((r, idx) => {
                  const faixa = classifyFaixaSalao(r.r_por_reclam);
                  return (
                    <TableRow key={r.loja_id}>
                      <TableCell className="text-center font-semibold tabular-nums text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBRL(r.faturamento_salao)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {r.reclamacoes}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatBRL(r.r_por_reclam)}
                      </TableCell>
                      <TableCell className="text-center">
                        {faixa ? (
                          <Badge variant={faixaBadgeVariant(faixa)} className="uppercase tracking-wide text-[10px]">
                            {faixa.replace("_", " ")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* BLOCO 3 e 4 — Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* PieChart — canais */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reclamações por Canal</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : pieData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                Sem reclamações no mês
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={80}
                    label={(entry) => `${entry.value}`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* LineChart — evolução */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Evolução Mensal — Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {histQ.isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={lineData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.2)" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <RTooltip />
                  <Legend verticalAlign="bottom" height={28} />
                  <Line type="monotone" dataKey="Salão" stroke="#D05937" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Delivery" stroke="#0EA5E9" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// KPI Unit Card (variante com nome de unidade)
// ──────────────────────────────────────────────────────────────

interface KpiUnitCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  unitName: string | null;
  value: number | null;
  tone: "good" | "bad";
}

function KpiUnitCard({ title, icon: Icon, loading, unitName, value, tone }: KpiUnitCardProps) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <Icon
            className={cn(
              "h-4 w-4",
              tone === "good" ? "text-emerald-600" : "text-red-500"
            )}
          />
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-9 w-32" />
        ) : unitName ? (
          <>
            <div className="mt-2 truncate text-lg font-bold">{unitName}</div>
            <div
              className={cn(
                "mt-1 text-sm font-semibold tabular-nums",
                tone === "good" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}
            >
              {formatBRL(value)} / reclamação
            </div>
          </>
        ) : (
          <div className="mt-2 text-base text-muted-foreground">— sem dados —</div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// Placeholder para sub-abas restantes
// ──────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────
// Conformidade
// ──────────────────────────────────────────────────────────────

type FaixaConf = "EXCELENTE" | "BOM" | "REGULAR" | "RED_FLAG";

function classifyConformidade(score: number | null | undefined): FaixaConf | null {
  if (typeof score !== "number" || isNaN(score)) return null;
  if (score >= 95) return "EXCELENTE";
  if (score >= 90) return "BOM";
  if (score >= 80) return "REGULAR";
  return "RED_FLAG";
}

// score_percentual em "tempo_prato" = % de pratos OK (quanto MAIOR melhor)
// Faixas KDS espelhadas: EXCELENTE ≥95 | BOM ≥92 | REGULAR ≥90 | RED_FLAG <90
function classifyKds(score: number | null | undefined): FaixaConf | null {
  if (typeof score !== "number" || isNaN(score)) return null;
  if (score >= 95) return "EXCELENTE";
  if (score >= 92) return "BOM";
  if (score >= 90) return "REGULAR";
  return "RED_FLAG";
}

function faixaConfBadge(faixa: FaixaConf | null): {
  variant: "default" | "secondary" | "outline" | "destructive";
  label: string;
} {
  switch (faixa) {
    case "EXCELENTE":
      return { variant: "default", label: "Excelente" };
    case "BOM":
      return { variant: "secondary", label: "Bom" };
    case "REGULAR":
      return { variant: "outline", label: "Regular" };
    case "RED_FLAG":
      return { variant: "destructive", label: "Red Flag" };
    default:
      return { variant: "outline", label: "—" };
  }
}

function sectorLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const map: Record<string, string> = {
    cozinha: "Cozinha",
    bar: "Bar",
    parrilla: "Parrilla",
    sushi: "Sushi",
    salao: "Salão",
    delivery: "Delivery",
    front: "Front",
    back: "Back",
  };
  return map[code] ?? code.charAt(0).toUpperCase() + code.slice(1);
}

function ConformidadeView() {
  const [mes, setMes] = useState<string>(currentMonth());

  const scoresQ = useQuery({
    queryKey: ["conf-scores", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leadership_store_scores")
        .select("*, config_lojas(nome)")
        .eq("month_year", mes);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setoresQ = useQuery({
    queryKey: ["conf-setores", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_sector_scores")
        .select("*, config_lojas(nome)")
        .eq("month_year", mes);
      if (error) throw error;
      return data ?? [];
    },
  });

  const kdsQ = useQuery({
    queryKey: ["conf-kds", mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avaliacoes")
        .select("*, cargos(nome, setor_back), config_lojas(nome)")
        .eq("codigo_meta", "tempo_prato")
        .eq("referencia_mes", mes);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Linhas SEÇÃO A
  const scoreRows = useMemo(() => {
    const rows = (scoresQ.data ?? []).map((r: any) => ({
      loja_id: r.loja_id,
      nome: r.config_lojas?.nome ?? "—",
      front_score: typeof r.front_score === "number" ? r.front_score : null,
      back_score: typeof r.back_score === "number" ? r.back_score : null,
      general_score: typeof r.general_score === "number" ? r.general_score : null,
      general_tier: r.general_tier ?? null,
      total_audits: r.total_audits ?? 0,
    }));
    rows.sort((a, b) => (b.general_score ?? -1) - (a.general_score ?? -1));
    return rows;
  }, [scoresQ.data]);

  // Agregação SEÇÃO B (média por sector_code)
  const setorRows = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    (setoresQ.data ?? []).forEach((r: any) => {
      const code = r.sector_code as string | null;
      const score = typeof r.score === "number" ? r.score : null;
      if (!code || score === null) return;
      const acc = map.get(code) ?? { sum: 0, n: 0 };
      acc.sum += score;
      acc.n += 1;
      map.set(code, acc);
    });
    const rows = Array.from(map.entries()).map(([code, { sum, n }]) => ({
      code,
      avg: n > 0 ? sum / n : null,
      n,
    }));
    rows.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
    return rows;
  }, [setoresQ.data]);

  // Cards SEÇÃO C — KDS
  const kdsRows = useMemo(() => {
    return (kdsQ.data ?? []).map((r: any) => ({
      id: r.id,
      cargo: r.cargos?.nome ?? "—",
      setor_back: r.cargos?.setor_back ?? null,
      loja: r.config_lojas?.nome ?? "—",
      score: typeof r.score_percentual === "number" ? r.score_percentual : null,
    }));
  }, [kdsQ.data]);

  return (
    <div className="space-y-4">
      {/* Seletor de mês */}
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center gap-3 p-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMes((m) => shiftMonth(m, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[200px] text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Período</div>
            <div className="text-base font-semibold">{formatMonthPt(mes)}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMes((m) => shiftMonth(m, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* SEÇÃO A — Score por Unidade */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Score por Unidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scoresQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : scoreRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem dados de liderança para este mês.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead className="min-w-[180px]">Score Front</TableHead>
                    <TableHead className="min-w-[180px]">Score Back</TableHead>
                    <TableHead className="min-w-[180px]">Score Geral</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Auditorias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scoreRows.map((r) => (
                    <TableRow key={r.loja_id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell>
                        <ScoreCell score={r.front_score} />
                      </TableCell>
                      <TableCell>
                        <ScoreCell score={r.back_score} />
                      </TableCell>
                      <TableCell>
                        <ScoreCell score={r.general_score} />
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                            tierClasses(r.general_tier)
                          )}
                        >
                          {tierLabel(r.general_tier)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.total_audits}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO B — Por Setor */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Utensils className="h-4 w-4 text-primary" />
            Score Médio por Setor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {setoresQ.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : setorRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem dados setoriais para este mês.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {setorRows.map((s) => {
                const faixa = classifyConformidade(s.avg);
                const badge = faixaConfBadge(faixa);
                return (
                  <div
                    key={s.code}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background/40 p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold capitalize">{sectorLabel(s.code)}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.n} avaliaç{s.n === 1 ? "ão" : "ões"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-lg font-bold tabular-nums">
                        {s.avg !== null ? s.avg.toFixed(1) : "—"}
                      </span>
                      <Badge variant={badge.variant} className="text-[10px]">
                        {badge.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO C — KDS / Tempo de Prato */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4 text-primary" />
            KDS — Tempo de Prato
          </CardTitle>
        </CardHeader>
        <CardContent>
          {kdsQ.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : kdsRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sem avaliações de Tempo de Prato neste mês.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kdsRows.map((k) => {
                const faixa = classifyKds(k.score);
                const badge = faixaConfBadge(faixa);
                return (
                  <div
                    key={k.id}
                    className="flex flex-col gap-2 rounded-lg border bg-background/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{k.cargo}</div>
                        <div className="text-xs text-muted-foreground">
                          {sectorLabel(k.setor_back)} · {k.loja}
                        </div>
                      </div>
                      <Badge variant={badge.variant} className="shrink-0 text-[10px]">
                        {badge.label}
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">% pratos OK</span>
                      <span className="text-xl font-bold tabular-nums">
                        {k.score !== null ? `${k.score.toFixed(1)}%` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreCell({ score }: { score: number | null }) {
  const value = score ?? 0;
  return (
    <div className="flex items-center gap-2">
      <Progress value={value} className={cn("h-2 flex-1", progressBarColor(score))} />
      <span className="w-12 text-right text-xs font-semibold tabular-nums">
        {score !== null ? score.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function PlaceholderCard({ name }: { name: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="flex min-h-[280px] items-center justify-center p-10">
        <p className="text-center text-base font-medium text-muted-foreground">
          {name} — em construção
        </p>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// Root
// ──────────────────────────────────────────────────────────────

export function PainelMetasTab(_props: PainelMetasTabProps) {
  return (
    <Tabs defaultValue="visao-geral" className="space-y-4">
      <TabsList className="h-auto w-full justify-start gap-1 bg-muted/40 p-1 flex-wrap">
        {SUBTABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="visao-geral" className="mt-4">
        <VisaoGeral />
      </TabsContent>
      <TabsContent value="nps" className="mt-4">
        <NpsView />
      </TabsContent>
      <TabsContent value="conformidade" className="mt-4">
        <ConformidadeView />
      </TabsContent>
      <TabsContent value="planos" className="mt-4">
        <PlaceholderCard name="Planos de Ação" />
      </TabsContent>
    </Tabs>
  );
}
