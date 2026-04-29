import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  type RegimeType,
} from "@/hooks/useHoldingConfig";
import {
  DAYS_OF_WEEK_DISPLAY,
  SECTOR_LABELS,
  SHIFT_TYPES,
  sectorsForBrand,
  type Brand,
  type SectorKey,
} from "@/lib/holding/sectors";
import { cn } from "@/lib/utils";

interface Props {
  brand: Brand;
  unitId: string;
  monthYear: string;
}

/** Padrão inicial de regime quando ainda não há registro salvo. */
function defaultRegimeFor(sector: SectorKey): RegimeType {
  return sector === "sushi" ? "6x1" : "5x2";
}

/** Cálculo das fórmulas de dobras conforme regime. */
function calcDobras(soma: number, regime: RegimeType): number {
  if (regime === "5x2") return (soma * 2) / 10;
  return soma / 9.5;
}

function pessoasFromDobras(dobras: number): number {
  return Math.ceil(dobras);
}

function badgeColorForPessoas(n: number): string {
  if (n <= 4) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (n <= 8) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-destructive/15 text-destructive";
}

/**
 * Parser de célula "X+Y" → { required, extras }.
 * Aceita: "4", "4+1", "4 + 1", "+2" (=> required=0, extras=2), "" (=> 0+0).
 * Valores negativos viram 0; decimais são truncados.
 */
function parseCellValue(raw: string): { required: number; extras: number } {
  const s = (raw ?? "").trim();
  if (!s) return { required: 0, extras: 0 };
  const m = s.match(/^\s*(-?\d+)?\s*(?:\+\s*(-?\d+))?\s*$/);
  if (!m) return { required: 0, extras: 0 };
  const req = Math.max(0, Math.floor(Number(m[1] ?? 0) || 0));
  const ext = Math.max(0, Math.floor(Number(m[2] ?? 0) || 0));
  return { required: req, extras: ext };
}

function formatCellValue(required: number, extras: number): string {
  if (extras > 0) return `${required}+${extras}`;
  return String(required);
}

export function HoldingStaffingPanel({ brand, unitId, monthYear }: Props) {
  const { data: rows, isLoading } = useHoldingStaffingConfig(unitId, monthYear);
  const { data: effectiveBySector } = useEffectiveHeadcountBySector(unitId);
  const upsert = useUpsertHoldingStaffing();
  const sectors = sectorsForBrand(brand);
  const [showExtras, setShowExtras] = useState(false);

  // Regime override local (até persistir): `${sector}|${shift}` -> regime
  const [regimeOverride, setRegimeOverride] = useState<Record<string, RegimeType>>({});

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

  /**
   * Regime efetivo da linha (sector + shift):
   * 1) override local recém clicado
   * 2) qualquer registro persistido daquela linha (qualquer dia) com regime salvo
   * 3) default (sushi=6x1, demais=5x2)
   */
  const getRegime = (sector: SectorKey, shift: "almoco" | "jantar"): RegimeType => {
    const k = `${sector}|${shift}`;
    if (regimeOverride[k]) return regimeOverride[k];
    for (const d of DAYS_OF_WEEK_DISPLAY) {
      const r = index.get(`${sector}|${shift}|${d.key}`);
      if (r?.regime) return r.regime;
    }
    return defaultRegimeFor(sector);
  };

  const persistCell = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    required: number,
    extras: number,
    regime?: RegimeType,
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
      regime: regime ?? getRegime(sector, shift),
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

  /** Edição combinada X+Y na célula principal (ex.: "4+1"). */
  const handleCombinedBlur = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    raw: string,
  ) => {
    const { required, extras } = parseCellValue(raw);
    const curReq = getRequired(sector, shift, day);
    const curExt = getExtras(sector, shift, day);
    if (required === curReq && extras === curExt) return;
    persistCell(sector, shift, day, required, extras);
  };

  /**
   * Persiste o novo regime em TODAS as 7 células daquele setor+turno
   * (mantendo required/extras atuais).
   */
  const handleRegimeChange = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    next: RegimeType,
  ) => {
    const k = `${sector}|${shift}`;
    setRegimeOverride((prev) => ({ ...prev, [k]: next }));
    for (const d of DAYS_OF_WEEK_DISPLAY) {
      persistCell(
        sector,
        shift,
        d.key,
        getRequired(sector, shift, d.key),
        getExtras(sector, shift, d.key),
        next,
      );
    }
  };

  // Cálculos por linha (setor × turno): soma dos 7 dias (required + extras) e dobras nos 2 regimes
  const rowMetrics = useMemo(() => {
    const out: Record<
      string,
      { soma: number; somaReq: number; somaExt: number; dobras5x2: number; dobras6x1: number }
    > = {};
    for (const sector of sectors) {
      for (const shift of SHIFT_TYPES) {
        let somaReq = 0;
        let somaExt = 0;
        for (const d of DAYS_OF_WEEK_DISPLAY) {
          somaReq += getRequired(sector, shift.key, d.key);
          somaExt += getExtras(sector, shift.key, d.key);
        }
        const soma = somaReq + somaExt;
        out[`${sector}|${shift.key}`] = {
          soma,
          somaReq,
          somaExt,
          dobras5x2: calcDobras(soma, "5x2"),
          dobras6x1: calcDobras(soma, "6x1"),
        };
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, index]);

  // Métrica agregada para Necess./Efet./Gap (uma vez por setor)
  // Pico semanal considera required + extras por dia/turno.
  const metricsBySector = useMemo(() => {
    const out: Record<string, { necessarias: number; dobras: number }> = {};
    for (const sector of sectors) {
      let maxTotal = 0;
      let maxExtras = 0;
      for (const d of DAYS_OF_WEEK_DISPLAY) {
        const aTot = getRequired(sector, "almoco", d.key) + getExtras(sector, "almoco", d.key);
        const jTot = getRequired(sector, "jantar", d.key) + getExtras(sector, "jantar", d.key);
        const ea = getExtras(sector, "almoco", d.key);
        const ej = getExtras(sector, "jantar", d.key);
        maxTotal = Math.max(maxTotal, aTot, jTot);
        maxExtras = Math.max(maxExtras, ea, ej);
      }
      out[sector] = { necessarias: maxTotal, dobras: maxExtras };
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
              O regime (5x2 ou 6x1) calcula automaticamente nº de dobras e pessoas necessárias.
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
          <TooltipProvider delayDuration={150}>
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
                    <TableHead className="w-[80px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                      Regime
                    </TableHead>
                    <TableHead className="hidden xl:table-cell w-[140px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                      Nº Dobras
                    </TableHead>
                    <TableHead className="hidden xl:table-cell w-[100px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                      Nº Pessoas
                    </TableHead>
                    <TableHead className="w-[72px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                      Necess.
                    </TableHead>
                    <TableHead className="w-[72px] text-center text-[11px] uppercase tracking-wide bg-muted/40">
                      Efet.
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
                    return SHIFT_TYPES.map((shift) => {
                      const regime = getRegime(sector, shift.key);
                      const rm = rowMetrics[`${sector}|${shift.key}`] ?? {
                        soma: 0,
                        dobras5x2: 0,
                        dobras6x1: 0,
                      };
                      const dobrasAtivas = regime === "5x2" ? rm.dobras5x2 : rm.dobras6x1;
                      const pessoas = pessoasFromDobras(dobrasAtivas);
                      return (
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
                          {DAYS_OF_WEEK_DISPLAY.map((d) => {
                            const reqVal = getRequired(sector, shift.key, d.key);
                            const cell = (
                              <div className="flex flex-col items-center gap-0.5">
                                <Input
                                  type="number"
                                  min={0}
                                  defaultValue={reqVal}
                                  key={`req-${sector}-${shift.key}-${d.key}-${reqVal}`}
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
                            );
                            return (
                              <TableCell key={d.key} className="p-1 text-center w-[76px]">
                                {/* Em telas <1280px, tooltip com cálculos no hover do required */}
                                <span className="xl:hidden">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div>{cell}</div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      <div className="space-y-0.5">
                                        <div>Soma semanal: <strong>{rm.soma}</strong></div>
                                        <div className={cn(regime === "5x2" && "font-semibold text-primary")}>
                                          5x2: {rm.dobras5x2.toFixed(1)} dobras → {pessoasFromDobras(rm.dobras5x2)} pessoas
                                        </div>
                                        <div className={cn(regime === "6x1" && "font-semibold text-primary")}>
                                          6x1: {rm.dobras6x1.toFixed(1)} dobras → {pessoasFromDobras(rm.dobras6x1)} pessoas
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </span>
                                <span className="hidden xl:block">{cell}</span>
                              </TableCell>
                            );
                          })}

                          {/* Regime toggle (sempre visível) */}
                          <TableCell className="p-1 text-center w-[80px] bg-muted/20">
                            <div className="inline-flex rounded-md border border-border/60 overflow-hidden">
                              <Button
                                type="button"
                                size="sm"
                                variant={regime === "5x2" ? "default" : "ghost"}
                                className="h-7 px-2 text-[10px] rounded-none"
                                onClick={() => handleRegimeChange(sector, shift.key, "5x2")}
                              >
                                5x2
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={regime === "6x1" ? "default" : "ghost"}
                                className="h-7 px-2 text-[10px] rounded-none"
                                onClick={() => handleRegimeChange(sector, shift.key, "6x1")}
                              >
                                6x1
                              </Button>
                            </div>
                          </TableCell>

                          {/* Nº Dobras (≥ xl) */}
                          <TableCell className="hidden xl:table-cell text-center align-middle w-[140px] bg-muted/20">
                            <div className="flex flex-col leading-tight tabular-nums">
                              <span
                                className={cn(
                                  "text-xs",
                                  regime === "5x2"
                                    ? "font-bold text-primary"
                                    : "text-muted-foreground/70",
                                )}
                              >
                                5x2: {rm.dobras5x2.toFixed(1)}
                              </span>
                              <span
                                className={cn(
                                  "text-xs",
                                  regime === "6x1"
                                    ? "font-bold text-primary"
                                    : "text-muted-foreground/70",
                                )}
                              >
                                6x1: {rm.dobras6x1.toFixed(1)}
                              </span>
                            </div>
                          </TableCell>

                          {/* Nº Pessoas Necessárias (≥ xl) */}
                          <TableCell className="hidden xl:table-cell text-center align-middle w-[100px] bg-muted/20">
                            <Badge
                              className={cn(
                                "border-0 font-semibold tabular-nums",
                                badgeColorForPessoas(pessoas),
                              )}
                            >
                              {pessoas}
                            </Badge>
                          </TableCell>

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
                                className={`text-center align-middle bg-muted/20 ${zebra}`}
                              >
                                {renderGap(metrics.necessarias, metrics.dobras, efetivas)}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    });
                  })}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        )}
        <p className="text-[10px] text-muted-foreground italic">
          Regime: 5x2 → dobras = (soma×2)/10 • 6x1 → dobras = soma/9,5 • Nº Pessoas = arredondamento p/ cima.
          Necess./Efet./Gap permanecem por setor (pico semanal vs CLT ativos).
        </p>
      </CardContent>
    </Card>
  );
}
