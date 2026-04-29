import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  useHoldingStaffingConfig,
  useUpsertHoldingStaffing,
  type HoldingStaffingConfigRow,
} from "@/hooks/useHoldingConfig";
import {
  DAYS_OF_WEEK,
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
 */
export function HoldingStaffingPanel({ brand, unitId, monthYear }: Props) {
  const { data: rows, isLoading } = useHoldingStaffingConfig(unitId, monthYear);
  const upsert = useUpsertHoldingStaffing();
  const sectors = sectorsForBrand(brand);

  // index: `${sector_key}|${shift_type}|${day}` -> row
  const index = useMemo(() => {
    const m = new Map<string, HoldingStaffingConfigRow>();
    (rows ?? []).forEach((r) => {
      m.set(`${r.sector_key}|${r.shift_type}|${r.day_of_week}`, r);
    });
    return m;
  }, [rows]);

  const getValue = (sector: SectorKey, shift: "almoco" | "jantar", day: number) =>
    index.get(`${sector}|${shift}|${day}`)?.required_count ?? 0;

  const handleBlur = (
    sector: SectorKey,
    shift: "almoco" | "jantar",
    day: number,
    raw: string,
  ) => {
    const value = Math.max(0, Math.floor(Number(raw) || 0));
    const current = getValue(sector, shift, day);
    if (value === current) return;
    upsert.mutate({
      unit_id: unitId,
      brand,
      sector_key: sector,
      shift_type: shift,
      day_of_week: day,
      month_year: monthYear,
      required_count: value,
      extras_count: 0,
    });
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Mínimo Operacional por Setor / Turno / Dia
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Os valores definidos aqui alimentam automaticamente o alerta de POP no
          editor de escalas dos gerentes.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card/95 backdrop-blur min-w-[200px]">
                    Setor
                  </TableHead>
                  <TableHead className="w-20 text-center">Turno</TableHead>
                  {DAYS_OF_WEEK.map((d) => (
                    <TableHead key={d.key} className="w-16 text-center text-xs">
                      {d.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectors.map((sector) =>
                  SHIFT_TYPES.map((shift) => (
                    <TableRow key={`${sector}-${shift.key}`}>
                      {shift.key === "almoco" && (
                        <TableCell
                          rowSpan={2}
                          className="sticky left-0 z-10 bg-card/95 backdrop-blur align-middle font-medium"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">{SECTOR_LABELS[sector]}</span>
                            {sector === "sushi" && (
                              <Badge variant="secondary" className="w-fit text-[9px]">
                                Nazo
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-center text-xs uppercase text-muted-foreground">
                        {shift.label}
                      </TableCell>
                      {DAYS_OF_WEEK.map((d) => (
                        <TableCell key={d.key} className="p-1 text-center">
                          <Input
                            type="number"
                            min={0}
                            defaultValue={getValue(sector, shift.key, d.key)}
                            onBlur={(e) =>
                              handleBlur(sector, shift.key, d.key, e.target.value)
                            }
                            className="h-8 w-14 text-center text-sm tabular-nums"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
