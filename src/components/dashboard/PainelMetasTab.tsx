import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";
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
// Placeholder para sub-abas restantes
// ──────────────────────────────────────────────────────────────

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
        <PlaceholderCard name="NPS" />
      </TabsContent>
      <TabsContent value="conformidade" className="mt-4">
        <PlaceholderCard name="Conformidade" />
      </TabsContent>
      <TabsContent value="planos" className="mt-4">
        <PlaceholderCard name="Planos de Ação" />
      </TabsContent>
    </Tabs>
  );
}
