import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useHoldingStaffingConfig,
  useUpsertHoldingStaffing,
  useEffectiveHeadcountBySector,
  type HoldingStaffingConfigRow,
} from "@/hooks/useHoldingConfig";
import {
  DAYS_OF_WEEK_DISPLAY,
  SECTOR_LABELS,
  SHIFT_TYPES,
  sectorsForBrand,
  type Brand,
  type SectorKey,
} from "@/lib/holding/sectors";

interface Props {
  brand: Brand;
  unitId: string;
  monthYear: string;
}

/**
 * F1 + F4 — Mínimo de pessoas por setor × turno × dia da semana,
 * para o mês de referência selecionado. Salva via upsert e dispara
 * o trigger de espelhamento para o staffing_matrix.
 *
 * Inclui colunas calculadas Necess./Efet./Dobras/Gap por setor.
 */
export function HoldingStaffingPanel({ brand, unitId, monthYear }: Props) {
  const { data: rows, isLoading } = useHoldingStaffingConfig(unitId, monthYear);
  const { data: effectiveBySector } = useEffectiveHeadcountBySector(unitId);
  const upsert = useUpsertHoldingStaffing();
  const sectors = sectorsForBrand(brand);
  const [showExtras, setShowExtras] = useState(false);

  // index: `${sector_key}|${shift_type}|${day}` -> row
  const index = useMemo(() => {
    const m = new Map<string, HoldingStaffingConfigRow>();
    (rows ?? []).forEach((r) => {
      m.set(`${r.sector_key}|${r.shift_type}|${r.day_of_week}`, r);
    });
    return m;
  }, [rows]);

  const getRequired = (sector: SectorKey, shift: "almoco" | "jantar", day: number) =>
    index.get(`${sector}|${shift}|${day}`)?.required_count ?? 0;

  const getExtras = (sector: SectorKey, shift: "almoco" | "jantar", day: number) =>
    index.get(`${sector}|${shift}|${day}`)?.extras_count ?? 0;

  const persistCell = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    required: number,
    extras: number,
  ) => {
    upsert.mutate({
      unit_id: unitId,
      brand,
      sector_key: sector,
      shift_type: shift,
      day_of_week: day,
      month_year: monthYear,
      required_count: Math.max(0, Math.floor(required || 0)),
      extras_count: Math.max(0, Math.floor(extras || 0)),
    });
  };

  const handleRequiredBlur = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    raw: string,
  ) => {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    if (value === getRequired(sector, shift, day)) return;
    persistCell(sector, shift, day, value, getExtras(sector, shift, day));
  };

  const handleExtrasBlur = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    raw: string,
  ) => {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    if (value === getExtras(sector, shift, day)) return;
    persistCell(sector, shift, day, getRequired(sector, shift, day), value);
  };

  // Métricas por setor (uma vez por setor)
  const metricsBySector = useMemo(() => {
    const out: Record<string, { necessarias: number; dobras: number }> = {};
    for (const sector of sectors) {
      let maxReq = 0;
      let maxExtras = 0;
      for (const d of DAYS_OF_WEEK_DISPLAY) {
        const a = getRequired(sector, "almoco", d.key);
        const j = getRequired(sector, "jantar", d.key);
        const ea = getExtras(sector, "almoco", d.key);
        const ej = getExtras(sector, "jantar", d.key);
        maxReq = Math.max(maxReq, a, j);
        maxExtras = Math.max(maxExtras, ea, ej);
      }
      out[sector] = { necessarias: maxReq, dobras: maxExtras };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, index]);

  const renderGap = (necessarias: number, dobras: number, efetivas: number) => {
    const gap = necessarias + dobras - efetivas;
    if (gap > 0) {
      return (
        <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-0 font-semibold">
          Faltam {gap}
        </Badge>
      );
    }
    if (gap === 0) {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-0 font-semibold">
          OK
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border-0 font-semibold">
        Excedente {Math.abs(gap)}
      </Badge>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">
              Mínimo Operacional por Setor / Turno / Dia
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Os valores aqui alimentam o alerta de POP e a IA geradora de escalas.
              Dobras (extras) são reposições autorizadas quando faltas comprometem o mínimo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-extras"
              checked={showExtras}
              onCheckedChange={setShowExtras}
            />
            <Label htmlFor="show-extras" className="text-xs cursor-pointer">
              Mostrar dobras por célula
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card/95 backdrop-blur w-[120px] text-xs uppercase tracking-wide">
                    Setor
                  </TableHead>
                  <TableHead className="w-14 text-center text-[10px] uppercase tracking-wide">
                    Turno
                  </TableHead>
                  {DAYS_OF_WEEK_DISPLAY.map((d) => (
                    <TableHead
                      key={d.key}
                      className="w-[76px] text-center text-[11px] uppercase tracking-wide"
                    >
                      {d.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-[72px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                    Necess.
                  </TableHead>
                  <TableHead className="w-[72px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                    Efet.
                  </TableHead>
                  <TableHead className="w-[72px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                    Dobras
                  </TableHead>
                  <TableHead className="w-[100px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                    Gap
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectors.map((sector, sIdx) => {
                  const metrics = metricsBySector[sector] ?? { necessarias: 0, dobras: 0 };
                  const efetivas = effectiveBySector?.[sector] ?? 0;
                  const zebra = sIdx % 2 === 1 ? "bg-muted/10" : "";
                  return SHIFT_TYPES.map((shift) => (
                    <TableRow key={`${sector}-${shift.key}`} className={`h-11 ${zebra}`}>
                      {shift.key === "almoco" && (
                        <TableCell
                          rowSpan={2}
                          className={`sticky left-0 z-10 bg-card/95 backdrop-blur align-middle font-medium w-[120px] ${zebra}`}
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wide">
                              {SECTOR_LABELS[sector]}
                            </span>
                            {sector === "sushi" && (
                              <Badge variant="secondary" className="w-fit text-[9px]">
                                Nazo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-center text-[10px] uppercase tracking-wide text-muted-foreground w-14">
                        {shift.label}
                      </TableCell>
                      {DAYS_OF_WEEK_DISPLAY.map((d) => (
                        <TableCell key={d.key} className="p-1 text-center w-[76px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <Input
                              type="number"
                              min={0}
                              defaultValue={getRequired(sector, shift.key, d.key)}
                              key={`req-${sector}-${shift.key}-${d.key}-${getRequired(sector, shift.key, d.key)}`}
                              onBlur={(e) =>
                                handleRequiredBlur(sector, shift.key, d.key, e.target.value)
                              }
                              className="h-9 w-16 text-center text-base tabular-nums font-semibold bg-background/60 backdrop-blur-sm"
                            />
                            {showExtras && (
                              <Input
                                type="number"
                                min={0}
                                defaultValue={getExtras(sector, shift.key, d.key)}
                                key={`ext-${sector}-${shift.key}-${d.key}-${getExtras(sector, shift.key, d.key)}`}
                                onBlur={(e) =>
                                  handleExtrasBlur(sector, shift.key, d.key, e.target.value)
                                }
                                placeholder="+0"
                                className="h-7 w-16 text-center text-xs tabular-nums text-muted-foreground bg-background/30"
                              />
                            )}
                          </div>
                        </TableCell>
                      ))}
                      {shift.key === "almoco" && (
                        <>
                          <TableCell
                            rowSpan={2}
                            className={`text-center align-middle font-semibold tabular-nums bg-muted/20 ${zebra}`}
                          >
                            {metrics.necessarias}
                          </TableCell>
                          <TableCell
                            rowSpan={2}
                            className={`text-center align-middle font-semibold tabular-nums bg-muted/20 ${zebra}`}
                          >
                            {efetivas}
                          </TableCell>
                          <TableCell
                            rowSpan={2}
                            className={`text-center align-middle font-semibold tabular-nums bg-muted/20 ${zebra}`}
                          >
                            {metrics.dobras}
                          </TableCell>
                          <TableCell
                            rowSpan={2}
                            className={`text-center align-middle bg-muted/20 ${zebra}`}
                          >
                            {renderGap(metrics.necessarias, metrics.dobras, efetivas)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground italic">
          Necess. = pico semanal (turno crítico) por setor • Efet. = CLT ativos vinculados
          ao setor na unidade • Dobras = teto de reposição autorizado • Gap = (Necess + Dobras) − Efet
        </p>
      </CardContent>
    </Card>
  );
}
