import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MetaPageHeader } from "../shared/MetaPageHeader";
import { KpiByStoreCard, KpiByStoreGrid } from "../shared/KpiByStoreGrid";
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

function tierToTone(score: number | null): "excelente" | "bom" | "regular" | "redflag" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 95) return "excelente";
  if (score >= 90) return "bom";
  if (score >= 80) return "regular";
  return "redflag";
}

export function VisaoGeralView({ defaultMes, selectedUnidadeId }: VisaoGeralViewProps) {
  const [mes, setMes] = useState(defaultMes ?? currentMonth());

  // ── Google Sheets integration (additive) ──────────────────────
  const { raw: rawGeral, loading: loadingGeral } = useSheetData("checklist_geral");
  const { raw: rawChefias, loading: loadingChefias } = useSheetData("checklist_chefias");
  const { raw: rawNps } = useSheetData("nps_dashboard");
  const { raw: rawFat } = useSheetData("avaliacoes_fat");
  const { raw: rawBase } = useSheetData("base_avaliacoes");

  const npsData = useMemo(() => (rawNps ? parseNpsCSV(rawNps) : []), [rawNps]);
  const fatData = useMemo(
    () => (rawFat ? parseFaturamentoCSV(rawFat) : null),
    [rawFat]
  );
  const baseData = useMemo(
    () => (rawBase ? parseBaseAvaliacoesCSV(rawBase) : []),
    [rawBase]
  );

  const rankingGeral = useMemo(
    () => (rawGeral ? parseChecklistCSV(rawGeral) : []),
    [rawGeral]
  );
  const rankingChefias = useMemo(
    () => (rawChefias ? parseChecklistCSV(rawChefias) : []),
    [rawChefias]
  );

  const rkGeral = useMemo(
    () => rankingGeral.find((r) => r.titulo.toUpperCase().includes("- GERAL"))?.rows ?? [],
    [rankingGeral]
  );
  const rkGerenteFront = useMemo(
    () => rankingGeral.find((r) => r.titulo.toUpperCase().includes("FRONT"))?.rows ?? [],
    [rankingGeral]
  );
  const rkGerenteBack = useMemo(
    () => rankingGeral.find((r) => r.titulo.toUpperCase().includes("BACK"))?.rows ?? [],
    [rankingGeral]
  );

  const sheetAvgFront = useMemo(
    () => avg(rkGerenteFront.map((r) => r.media)),
    [rkGerenteFront]
  );
  const sheetAvgBack = useMemo(
    () => avg(rkGerenteBack.map((r) => r.media)),
    [rkGerenteBack]
  );
  // sheetAvgGeral kept for future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sheetAvgGeral = useMemo(
    () => avg(rkGeral.map((r) => r.media)),
    [rkGeral]
  );

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

  // ── Unidades lookup (for selectedUnidadeId → nome) ────────────
  const unidades = useQuery({
    queryKey: ["painel-unidades-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_lojas")
        .select("id, nome");
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

  // ── Heatmap from Sheets (additive fallback over Supabase) ─────
  const heatmapFromSheet = useMemo(() => {
    return rkGeral.map((row) => {
      const front = rkGerenteFront.find((r) => r.unidade === row.unidade);
      const back = rkGerenteBack.find((r) => r.unidade === row.unidade);
      return {
        id: row.unidade,
        nome: row.unidade,
        general_score: row.media,
        front_score: front?.media ?? null,
        back_score: back?.media ?? null,
        front_tier: null as string | null,
        back_tier: null as string | null,
        general_tier: null as string | null,
        reclamacoes: 0,
      };
    });
  }, [rkGeral, rkGerenteFront, rkGerenteBack]);

  const heatmapRowsBase = heatmapFromSheet.length > 0 ? heatmapFromSheet : (heatmap.data ?? []);

  const heatmapRows = useMemo(() => {
    if (!selectedUnidadeNome) return heatmapRowsBase;
    const target = selectedUnidadeNome.toUpperCase().trim();
    return heatmapRowsBase.filter(
      (r: any) => (r.nome ?? "").toUpperCase().trim() === target
    );
  }, [heatmapRowsBase, selectedUnidadeNome]);

  const criticalUnits = useMemo(
    () => heatmapRows.filter((r: any) => r.general_tier === "aceitavel"),
    [heatmapRows]
  );

  // ── Display KPI values: Sheets first, Supabase fallback ───────
  const displayAvgFront = sheetAvgFront ?? overview.data?.avgFront ?? null;
  const displayAvgBack = sheetAvgBack ?? overview.data?.avgBack ?? null;
  const isLoadingKpis = overview.isLoading || loadingGeral || loadingChefias;

  return (
    <div className="space-y-4">
      <MetaPageHeader metaKey="visao-geral" mes={mes} onMesChange={setMes} />

      {criticalUnits.length > 0 && (
        <Alert variant="destructive" className="glass-card border-destructive/40">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>RED FLAG ATIVA</strong> — {criticalUnits.length} unidade
            {criticalUnits.length > 1 ? "s" : ""} com performance crítica este mês:{" "}
            {criticalUnits.map((u) => u.nome).join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      <KpiByStoreGrid>
        <KpiByStoreCard
          label="Back Score Médio"
          value={
            displayAvgBack !== null && displayAvgBack !== undefined
              ? `${formatNumberPt(displayAvgBack, 2)}%`
              : "—"
          }
          progress={displayAvgBack ?? 0}
          tone={tierToTone(displayAvgBack ?? null)}
          icon={TrendingDown}
          loading={isLoadingKpis}
        />
        <KpiByStoreCard
          label="Front Score Médio"
          value={
            displayAvgFront !== null && displayAvgFront !== undefined
              ? `${formatNumberPt(displayAvgFront, 2)}%`
              : "—"
          }
          progress={displayAvgFront ?? 0}
          tone={tierToTone(displayAvgFront ?? null)}
          icon={TrendingUp}
          loading={isLoadingKpis}
        />
        <KpiByStoreCard
          label="Reclamações no Mês"
          value={overview.data?.reclamCount?.toString() ?? "—"}
          hint="registradas"
          tone={(overview.data?.reclamCount ?? 0) > 10 ? "regular" : "neutral"}
          icon={MessageCircle}
          loading={overview.isLoading}
        />
        <KpiByStoreCard
          label="Auditoria Supervisão"
          value={
            overview.data?.avgSupervision !== null && overview.data?.avgSupervision !== undefined
              ? `${formatNumberPt(overview.data.avgSupervision, 1)}`
              : "—"
          }
          progress={overview.data?.avgSupervision ?? 0}
          tone={tierToTone(overview.data?.avgSupervision ?? null)}
          icon={Trophy}
          loading={overview.isLoading}
        />
      </KpiByStoreGrid>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <Building2 className="h-4 w-4 text-primary" />
            Mapa de Calor — Metas por Unidade
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Front</TableHead>
                  <TableHead className="text-center">Back</TableHead>
                  <TableHead className="text-center">Geral</TableHead>
                  <TableHead className="text-center">Reclam.</TableHead>
                  <TableHead className="text-center">Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(heatmap.isLoading || loadingGeral) && heatmapRows.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : heatmapRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma unidade disponível para este mês
                    </TableCell>
                  </TableRow>
                ) : (
                  heatmapRows.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.nome}</TableCell>
                      <TableCell className="text-center">
                        <ScoreDot score={row.front_score} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ScoreDot score={row.back_score} />
                      </TableCell>
                      <TableCell className="text-center">
                        <ScoreDot score={row.general_score} />
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        <span
                          className={cn(
                            "inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md px-2 text-xs font-semibold",
                            row.reclamacoes >= 5
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-muted text-foreground"
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
                            tierClasses(row.general_tier)
                          )}
                        >
                          {tierLabel(row.general_tier)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── SEÇÕES A + B (NPS + Distribuição de Notas) ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <NpsCard data={npsData} loading={!rawNps} />
        <DistribuicaoCard data={baseData} loading={!rawBase} />
      </div>

      {/* ── SEÇÃO C (Avaliações 1-3 × Faturamento) ── */}
      <FatVsAvalCard data={fatData} loading={!rawFat} />
    </div>
  );
}

function ScoreDot({ score }: { score: number | null }) {
  const tone = tierToTone(score);
  const colorMap = {
    excelente: "bg-emerald-500",
    bom: "bg-primary",
    regular: "bg-amber-500",
    redflag: "bg-destructive",
    neutral: "bg-muted-foreground/30",
  } as const;
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full shadow-sm", colorMap[tone])} aria-hidden />
      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
        {score !== null ? score.toFixed(0) : "—"}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SEÇÃO A — NPS: Média de Notas por Loja
// ──────────────────────────────────────────────────────────────
function NpsCard({
  data,
  loading,
}: {
  data: { loja: string; media: number }[];
  loading: boolean;
}) {
  const META = 4.8;

  const barColor = (v: number) => {
    if (v >= 4.8) return "#15803d";
    if (v >= 4.5) return "#22c55e";
    return "#888888";
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <Star className="h-4 w-4 text-primary" />
          NPS — Média de Notas
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Google + TripAdvisor · meta ≥ 4,80
        </p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full animate-pulse" />
          ))
        ) : data.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Sem dados disponíveis
          </p>
        ) : (
          data.map((row) => {
            const pct = Math.min(100, Math.max(0, (row.media / 5) * 100));
            const passed = row.media >= META;
            return (
              <div key={row.loja} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-right text-[11px] font-medium text-muted-foreground">
                  {row.loja}
                </span>
                <div className="relative flex-1 h-5 rounded-md bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all"
                    style={{ width: `${pct}%`, backgroundColor: barColor(row.media) }}
                  />
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-[11px] font-bold text-foreground/90 tabular-nums">
                    {row.media.toFixed(3).replace(".", ",")}
                  </span>
                </div>
                {passed ? (
                  <Check className="h-4 w-4 shrink-0" style={{ color: "#22c55e" }} />
                ) : (
                  <X className="h-4 w-4 shrink-0 text-destructive" />
                )}
              </div>
            );
          })
        )}
        <p className="pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          Meta: ≥ 4,80
        </p>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────
// SEÇÃO B — Distribuição de Notas
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
    if (n === 5) return "#22c55e";
    if (n === 4) return "#84cc16";
    if (n === 3) return "#eab308";
    if (n === 2) return "#f97316";
    return "#ef4444";
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <Star className="h-4 w-4 text-primary" />
          Distribuição de Notas
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">todas as plataformas</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-32 animate-pulse" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Sem dados disponíveis
          </p>
        ) : (
          <>
            <div>
              <div
                className="text-3xl font-bold tabular-nums"
                style={{ color: "#22c55e" }}
              >
                {total5 ? `${total5.pct.toFixed(2).replace(".", ",")}%` : "—"}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                de avaliações 5 estrelas
              </div>
            </div>

            <div className="space-y-1.5">
              {data.map((row) => {
                const pct = Math.min(100, Math.max(0, row.pct));
                return (
                  <div key={row.nota} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[11px] font-bold tabular-nums">
                      {row.nota}★
                    </span>
                    <div className="relative flex-1 h-4 rounded-md bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: colorByNota(row.nota),
                        }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums">
                      {row.pct.toFixed(2).replace(".", ",")}%
                    </span>
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {row.total.toLocaleString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>

            {totalAll > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
                {["iFood", "Google", "TripAdvisor", "Get In", "Instagram", "WhatsApp"].map(
                  (p) => (
                    <Badge
                      key={p}
                      variant="outline"
                      className="text-[10px] font-medium uppercase tracking-wide"
                    >
                      {p}
                    </Badge>
                  )
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
    salao: Array<{
      loja: string;
      av13: number;
      totalAv: number;
      pctAv13: number;
      faturamento: number;
      rPorAv: number;
    }>;
    delivery: Array<{
      loja: string;
      av13: number;
      totalAv: number;
      pctAv13: number;
      faturamento: number;
      rPorAv: number;
    }>;
  } | null;
  loading: boolean;
}) {
  const [tab, setTab] = useState<"salao" | "delivery">("salao");
  const rows = data ? (tab === "salao" ? data.salao : data.delivery) : [];

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });

  const fmtNum = (v: number) =>
    v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  const rPorAvStyle = (v: number): { bg: string; color: string } => {
    if (v >= 120000) return { bg: "rgba(34,197,94,.15)", color: "#16a34a" };
    if (v >= 95000) return { bg: "rgba(234,179,8,.15)", color: "#ca8a04" };
    if (v >= 70000) return { bg: "rgba(251,146,60,.15)", color: "#ea580c" };
    return { bg: "rgba(239,68,68,.15)", color: "#dc2626" };
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
              <DollarSign className="h-4 w-4 text-primary" />
              Avaliações 1-3 × Faturamento
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Abril 2026</p>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "salao" | "delivery")}>
            <TabsList className="h-8">
              <TabsTrigger value="salao" className="text-xs">
                Salão
              </TabsTrigger>
              <TabsTrigger value="delivery" className="text-xs">
                Delivery
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-0 sm:p-6 sm:pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loja</TableHead>
                <TableHead className="text-center">Aval. 1-3</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">R$/Avaliação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-xs text-muted-foreground"
                  >
                    Sem dados disponíveis
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const st = rPorAvStyle(row.rPorAv);
                  return (
                    <TableRow key={row.loja}>
                      <TableCell className="font-medium">{row.loja}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {fmtNum(row.av13)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {fmtNum(row.totalAv)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.pctAv13.toFixed(2).replace(".", ",")}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtBRL(row.faturamento)}
                      </TableCell>
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

        <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-0 sm:pb-0">
          {[
            { label: "≥ R$ 120k", bg: "rgba(34,197,94,.15)", color: "#16a34a" },
            { label: "≥ R$ 95k", bg: "rgba(234,179,8,.15)", color: "#ca8a04" },
            { label: "≥ R$ 70k", bg: "rgba(251,146,60,.15)", color: "#ea580c" },
            { label: "< R$ 70k", bg: "rgba(239,68,68,.15)", color: "#dc2626" },
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
      </CardContent>
    </Card>
  );
}
