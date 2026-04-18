import { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  dateStrToDiaPraca,
  filterPracas,
  inferTurnoFromTime,
  usePracasByUnit,
  type Praca,
  type TurnoPraca,
} from "@/hooks/usePracas";

interface ScheduleLike {
  id: string;
  schedule_date: string;
  start_time?: string | null;
  praca_id?: string | null;
  schedule_type?: string;
  status?: string;
}

interface PlanoChaoStatusProps {
  unitId: string | null;
  sectorName: string | null | undefined;
  /** YYYY-MM-DD — the day shown in the grid */
  date: string;
  /** Schedules of the active sector for that date (already filtered by sector) */
  schedules: ScheduleLike[];
}

interface Row {
  praca: Praca;
  alocado: number;
  status: "ok" | "parcial" | "vazio";
}

function buildRows(
  pracas: Praca[],
  sectorName: string | null | undefined,
  schedules: ScheduleLike[],
): { rows: Row[]; turnos: TurnoPraca[] } {
  const dia = dateStrToDiaPraca(schedules[0]?.schedule_date || new Date().toISOString().slice(0, 10));

  // Detect which turnos are present in the day (default to both if no schedules)
  const turnos: TurnoPraca[] = [];
  const seen = new Set<TurnoPraca>();
  schedules
    .filter((s) => s.schedule_type === "working")
    .forEach((s) => {
      const t = inferTurnoFromTime(s.start_time);
      if (!seen.has(t)) {
        seen.add(t);
        turnos.push(t);
      }
    });
  if (turnos.length === 0) turnos.push("ALMOCO", "JANTAR");

  // Count allocations per praca_id
  const counts = new Map<string, number>();
  schedules.forEach((s) => {
    if (s.praca_id) counts.set(s.praca_id, (counts.get(s.praca_id) || 0) + 1);
  });

  const all: Row[] = [];
  turnos.forEach((turno) => {
    const matching = filterPracas(pracas, sectorName, turno, dia);
    matching
      .filter((p) => p.qtd_necessaria > 0)
      .forEach((p) => {
        const alocado = counts.get(p.id) || 0;
        const status: Row["status"] =
          alocado >= p.qtd_necessaria ? "ok" : alocado > 0 ? "parcial" : "vazio";
        all.push({ praca: p, alocado, status });
      });
  });

  return { rows: all, turnos };
}

const TURNO_LABEL: Record<TurnoPraca, string> = {
  ALMOCO: "Almoço",
  JANTAR: "Jantar",
  TARDE: "Tarde",
};

export function PlanoChaoStatus({
  unitId,
  sectorName,
  date,
  schedules,
}: PlanoChaoStatusProps) {
  const { data: pracas = [] } = usePracasByUnit(unitId);

  const daySchedules = useMemo(
    () => schedules.filter((s) => s.schedule_date === date && s.status !== "cancelled"),
    [schedules, date],
  );

  const { rows } = useMemo(
    () => buildRows(pracas, sectorName, daySchedules),
    [pracas, sectorName, daySchedules],
  );

  const hasRed = rows.some((r) => r.status === "vazio");
  const [open, setOpen] = useState<boolean>(hasRed);

  // Re-evaluate openness when day or critical state changes
  useEffect(() => {
    setOpen(hasRed);
  }, [date, hasRed]);

  if (rows.length === 0) return null;

  const totalPraças = rows.length;
  const totalOk = rows.filter((r) => r.status === "ok").length;
  const totalRed = rows.filter((r) => r.status === "vazio").length;

  return (
    <Card>
      <CardContent className="p-0">
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-semibold">Plano de chão — status do turno</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {totalOk}/{totalPraças} OK
            </Badge>
            {totalRed > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive bg-destructive/5"
              >
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                {totalRed} sem ninguém
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <div className="border-t divide-y">
            {rows.map((r) => {
              const color =
                r.status === "ok"
                  ? "text-green-600 dark:text-green-400 border-green-300/60 bg-green-50 dark:bg-green-950/20"
                  : r.status === "parcial"
                    ? "text-amber-600 dark:text-amber-400 border-amber-300/60 bg-amber-50 dark:bg-amber-950/20"
                    : "text-destructive border-destructive/40 bg-destructive/5";
              return (
                <div
                  key={r.praca.id}
                  className="flex items-center gap-3 px-4 py-2 text-sm"
                >
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 shrink-0"
                  >
                    {TURNO_LABEL[r.praca.turno]}
                  </Badge>
                  <span className="font-medium truncate flex-1">
                    {r.praca.nome_praca}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Previsto <span className="font-semibold text-foreground">{r.praca.qtd_necessaria}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Alocado <span className="font-semibold text-foreground">{r.alocado}</span>
                  </span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${color}`}>
                    {r.status === "ok" ? (
                      <>
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Completo
                      </>
                    ) : r.status === "parcial" ? (
                      "Parcial"
                    ) : (
                      "Vazio"
                    )}
                  </Badge>
                </div>
              );
            })}
            {totalPraças === 0 && (
              <div className="px-4 py-3 text-xs text-muted-foreground">
                Nenhuma praça cadastrada para este setor.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
