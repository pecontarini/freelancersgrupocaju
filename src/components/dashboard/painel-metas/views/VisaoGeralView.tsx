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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MetaPageHeader } from "../shared/MetaPageHeader";
import { KpiByStoreCard, KpiByStoreGrid } from "../shared/KpiByStoreGrid";
import { currentMonth, formatNumberPt, monthRange } from "../shared/dateUtils";
import { useSheetData } from "@/hooks/useSheetData";
import { parseChecklistCSV } from "@/utils/parseSheetData";

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

export function VisaoGeralView({ defaultMes }: VisaoGeralViewProps) {
  const [mes, setMes] = useState(defaultMes ?? currentMonth());

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
            overview.data?.avgBack !== null && overview.data?.avgBack !== undefined
              ? `${formatNumberPt(overview.data.avgBack, 1)}`
              : "—"
          }
          progress={overview.data?.avgBack ?? 0}
          tone={tierToTone(overview.data?.avgBack ?? null)}
          icon={TrendingDown}
          loading={overview.isLoading}
        />
        <KpiByStoreCard
          label="Front Score Médio"
          value={
            overview.data?.avgFront !== null && overview.data?.avgFront !== undefined
              ? `${formatNumberPt(overview.data.avgFront, 1)}`
              : "—"
          }
          progress={overview.data?.avgFront ?? 0}
          tone={tierToTone(overview.data?.avgFront ?? null)}
          icon={TrendingUp}
          loading={overview.isLoading}
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
                {heatmap.isLoading ? (
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
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma unidade disponível para este mês
                    </TableCell>
                  </TableRow>
                ) : (
                  (heatmap.data ?? []).map((row) => (
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
