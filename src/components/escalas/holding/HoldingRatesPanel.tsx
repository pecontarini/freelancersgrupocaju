import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, Loader2, Save } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useHoldingFreelancerForecast,
  useHoldingFreelancerRates,
  useUpsertHoldingRate,
} from "@/hooks/useHoldingConfig";
import { useStoreBudgets } from "@/hooks/useStoreBudgets";
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

/**
 * F3 — Tabela de diárias por setor + calculadora de budget de freelancers.
 * Multiplica diária × previsão (do mês) e grava o total em
 * store_budgets.freelancer_budget via upsert (store_id, month_year).
 */
export function HoldingRatesPanel({ brand, unitId, monthYear }: Props) {
  const sectors = sectorsForBrand(brand);
  const { data: rates, isLoading: loadingRates } = useHoldingFreelancerRates(unitId);
  const { data: forecast } = useHoldingFreelancerForecast(unitId, monthYear);
  const upsertRate = useUpsertHoldingRate();
  const { budgets, upsertBudget, getBudgetForStoreMonth, isUpdating } =
    useStoreBudgets();

  // setor -> diária atual (R$)
  const ratesIndex = useMemo(() => {
    const m = new Map<string, number>();
    (rates ?? []).forEach((r) => m.set(r.sector_key, Number(r.daily_rate)));
    return m;
  }, [rates]);

  // setor -> total previsto de diárias no mês
  const forecastIndex = useMemo(() => {
    const m = new Map<string, number>();
    (forecast ?? []).forEach((f) => {
      m.set(f.sector_key, (m.get(f.sector_key) ?? 0) + (f.freelancer_count ?? 0));
    });
    return m;
  }, [forecast]);

  const totalBudget = useMemo(() => {
    let total = 0;
    sectors.forEach((s) => {
      const rate = ratesIndex.get(s) ?? 120;
      const qty = forecastIndex.get(s) ?? 0;
      total += rate * qty;
    });
    return total;
  }, [sectors, ratesIndex, forecastIndex]);

  const currentBudget = getBudgetForStoreMonth(unitId, monthYear);

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

  const handlePersistBudget = async () => {
    try {
      await upsertBudget({
        store_id: unitId,
        month_year: monthYear,
        freelancer_budget: Math.round(totalBudget * 100) / 100,
        maintenance_budget: currentBudget?.maintenance_budget ?? 0,
        uniforms_budget: currentBudget?.uniforms_budget ?? 0,
        cleaning_budget: currentBudget?.cleaning_budget ?? 0,
        utensils_budget: currentBudget?.utensils_budget ?? 0,
        apoio_venda_budget: currentBudget?.apoio_venda_budget ?? 0,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar budget.");
    }
  };

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
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora de Budget de Freelancers — {monthYear}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Diária × Previsão de freelancers (do mês). O total será gravado em
            "Budgets Gerenciais" da unidade.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Diária</TableHead>
                  <TableHead className="text-right">Qtd. Prevista</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectors.map((s) => {
                  const rate = ratesIndex.get(s) ?? 120;
                  const qty = forecastIndex.get(s) ?? 0;
                  const subtotal = rate * qty;
                  return (
                    <TableRow key={s}>
                      <TableCell>{SECTOR_LABELS[s]}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {BRL(rate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {qty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {BRL(subtotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-primary/5">
                  <TableCell colSpan={3} className="font-semibold">
                    Total Previsto
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
              onClick={handlePersistBudget}
              disabled={isUpdating || totalBudget <= 0}
              className="gap-1.5"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Gravar como Budget de Freelancers
            </Button>
          </div>

          {budgets.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum budget cadastrado ainda neste mês — ao gravar, será criado um
              novo registro em store_budgets.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
