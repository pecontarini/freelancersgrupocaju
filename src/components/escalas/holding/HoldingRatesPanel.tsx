import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calculator, CheckCircle2, Loader2, Save, Zap } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useHoldingFreelancerRates,
  useUpsertHoldingRate,
} from "@/hooks/useHoldingConfig";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
import { useHoldingFreelancerBudgetCalc } from "@/hooks/useHoldingFreelancerBudgetCalc";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  SECTOR_LABELS,
  sectorsForBrand,
  type Brand,
  type SectorKey,
} from "@/lib/holding/sectors";
import { toast } from "sonner";

interface Props {
  brand: Brand;
  unitId: string;
  monthYear: string;
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * F3 — Tabela de diárias por setor + calculadora de budget de freelancers.
 * Agora cruza automaticamente: gap (mínimo - CLT efetivo) + previsões pontuais.
 * Auto-grava em store_budgets.freelancer_budget com debounce.
 */
export function HoldingRatesPanel({ brand, unitId, monthYear }: Props) {
  const sectors = sectorsForBrand(brand);
  const { data: rates, isLoading: loadingRates } = useHoldingFreelancerRates(unitId);
  const upsertRate = useUpsertHoldingRate();
  const { getBudgetForStoreMonth } = useStoreBudgets();
  const queryClient = useQueryClient();

  const calc = useHoldingFreelancerBudgetCalc(unitId, monthYear, brand);

  const ratesIndex = useMemo(() => {
    const m = new Map<string, number>();
    (rates ?? []).forEach((r) => m.set(r.sector_key, Number(r.daily_rate)));
    return m;
  }, [rates]);

  const currentBudget = getBudgetForStoreMonth(unitId, monthYear);
  const totalBudget = calc.totalBudget;

  // ───────── Auto-save com debounce ─────────
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastSavedValueRef = useRef<number | null>(null);

  const persistBudget = async (silent = true) => {
    try {
      setAutoSaveState("saving");
      const payload = {
        store_id: unitId,
        month_year: monthYear,
        freelancer_budget: Math.round(totalBudget * 100) / 100,
        maintenance_budget: currentBudget?.maintenance_budget ?? 0,
        uniforms_budget: currentBudget?.uniforms_budget ?? 0,
        cleaning_budget: currentBudget?.cleaning_budget ?? 0,
        utensils_budget: currentBudget?.utensils_budget ?? 0,
        apoio_venda_budget: currentBudget?.apoio_venda_budget ?? 0,
      };
      const { error } = await supabase
        .from("store_budgets")
        .upsert(payload, { onConflict: "store_id,month_year" });
      if (error) throw error;
      lastSavedValueRef.current = payload.freelancer_budget;
      setLastSavedAt(new Date());
      setAutoSaveState("saved");
      await queryClient.invalidateQueries({ queryKey: ["store_budgets"] });
      if (!silent) toast.success("Budget de freelancers gravado.");
    } catch (e: any) {
      setAutoSaveState("error");
      if (!silent) toast.error(e?.message ?? "Erro ao salvar budget.");
    }
  };

  useEffect(() => {
    // Não autosalvar enquanto carregando
    if (calc.isLoading || calc.isFetching) return;
    if (!unitId || !monthYear) return;
    const current = currentBudget?.freelancer_budget ?? 0;
    const target = Math.round(totalBudget * 100) / 100;
    if (Math.abs(current - target) < 0.01) {
      // já sincronizado
      if (lastSavedValueRef.current === null) lastSavedValueRef.current = target;
      return;
    }
    // evita re-disparar para o mesmo valor que acabamos de gravar
    if (lastSavedValueRef.current !== null && Math.abs(lastSavedValueRef.current - target) < 0.01) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      persistBudget(true);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalBudget, currentBudget?.freelancer_budget, calc.isLoading, calc.isFetching, unitId, monthYear]);

  const handleRateBlur = (sector: SectorKey, raw: string) => {
    const value = Math.max(0, Number(raw) || 0);
    const current = ratesIndex.get(sector) ?? 120;
    if (value === current) return;
    upsertRate.mutate({
      unit_id: unitId,
      brand,
      sector_key: sector,
      daily_rate: value,
    });
  };

  const syncStatusLabel = (() => {
    if (autoSaveState === "saving") return "salvando…";
    if (autoSaveState === "error") return "erro ao salvar";
    if (lastSavedAt) {
      const secs = Math.max(1, Math.round((Date.now() - lastSavedAt.getTime()) / 1000));
      return `sincronizado há ${secs}s`;
    }
    const current = currentBudget?.freelancer_budget ?? 0;
    if (Math.abs(current - totalBudget) < 0.01) return "sincronizado";
    return "aguardando…";
  })();

  return (
    <div className="space-y-3">
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Diária Padrão por Setor</CardTitle>
          <p className="text-xs text-muted-foreground">
            Valor base que será usado pela calculadora de budget abaixo.
          </p>
        </CardHeader>
        <CardContent>
          {loadingRates ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead className="w-40 text-right">Diária (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectors.map((s) => (
                    <TableRow key={s}>
                      <TableCell className="font-medium">
                        {SECTOR_LABELS[s]}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          defaultValue={ratesIndex.get(s) ?? 120}
                          onBlur={(e) => handleRateBlur(s, e.target.value)}
                          className="h-8 w-32 text-right text-sm tabular-nums"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-5 w-5 text-primary" />
                Calculadora Automática de Budget — {monthYear}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                <strong>Qtd. Prevista</strong> = diárias do gap (mínimo − CLT efetivo) +
                previsões pontuais. <strong>Auto-grava</strong> em "Budgets Gerenciais".
              </p>
            </div>
            <Badge
              variant="secondary"
              className="gap-1.5 px-2.5 py-1 text-[11px]"
            >
              {autoSaveState === "saving" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : autoSaveState === "error" ? (
                <Zap className="h-3 w-3 text-destructive" />
              ) : (
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              )}
              {syncStatusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Diária</TableHead>
                  <TableHead className="text-right">Gap</TableHead>
                  <TableHead className="text-right">Pontuais</TableHead>
                  <TableHead className="text-right">Qtd. Prevista</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calc.perSector.map((row) => (
                  <TableRow key={row.sector}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {BRL(row.rate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.gapDiarias}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.pontuaisDiarias}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {row.totalDiarias}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {BRL(row.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-primary/5">
                  <TableCell colSpan={2} className="font-semibold">
                    Total Previsto
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {calc.totalGapDiarias}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {calc.totalPontuaisDiarias}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {calc.totalDiarias}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-primary">
                    {BRL(totalBudget)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Budget atual no mês:</span>{" "}
              <strong className="tabular-nums">
                {BRL(currentBudget?.freelancer_budget ?? 0)}
              </strong>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => persistBudget(false)}
              disabled={autoSaveState === "saving"}
              className="gap-1.5"
            >
              {autoSaveState === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Forçar gravação agora
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
