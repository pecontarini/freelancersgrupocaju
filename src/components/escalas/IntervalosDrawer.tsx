import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Printer,
  Play,
  Square,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Loader2,
  Coffee,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useDailyRoster, type DailyRosterRow } from "@/hooks/useDailyRoster";
import {
  useScheduleBreaks,
  useStartBreak,
  useEndBreak,
  useUpsertManualBreak,
  useDeleteBreak,
  type ScheduleBreak,
} from "@/hooks/useScheduleBreaks";
import { exportDailyBreakControl } from "@/lib/scheduleDailyControlPdf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unitId: string;
  unitName: string;
}

function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function hhmm(t: string | null) {
  return t ? t.slice(0, 5) : "—";
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function isoToTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function timeInputToIso(date: string, hhmmStr: string): string | null {
  if (!hhmmStr) return null;
  const [h, m] = hhmmStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Re-render a cada N ms (para cronômetro). */
function useTick(intervalMs: number, active: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setT((x) => x + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);
}

export function IntervalosDrawer({ open, onOpenChange, unitId, unitName }: Props) {
  const [date, setDate] = useState<string>(todayStr());
  const [printing, setPrinting] = useState(false);

  const { data: roster = [], isLoading: loadingRoster } = useDailyRoster(unitId, date);
  const { data: breaks = [], isLoading: loadingBreaks } = useScheduleBreaks(unitId, date);

  const startMut = useStartBreak(unitId, date);
  const endMut = useEndBreak(unitId, date);
  const upsertMut = useUpsertManualBreak(unitId, date);
  const deleteMut = useDeleteBreak(unitId, date);

  // Breaks indexados por schedule_id
  const breaksBySchedule = useMemo(() => {
    const map = new Map<string, ScheduleBreak[]>();
    for (const b of breaks) {
      if (!map.has(b.schedule_id)) map.set(b.schedule_id, []);
      map.get(b.schedule_id)!.push(b);
    }
    return map;
  }, [breaks]);

  const hasOpenBreak = breaks.some((b) => b.started_at && !b.ended_at);
  useTick(1000, open && hasOpenBreak);

  // Agrupa roster por setor
  const sectors = useMemo(() => {
    const map = new Map<string, DailyRosterRow[]>();
    for (const r of roster) {
      if (!map.has(r.sector_name)) map.set(r.sector_name, []);
      map.get(r.sector_name)!.push(r);
    }
    return Array.from(map.entries());
  }, [roster]);

  async function handlePrint() {
    if (roster.length === 0) {
      toast.info("Sem colaboradores escalados nesta data.");
      return;
    }
    setPrinting(true);
    try {
      await exportDailyBreakControl({ unitName, date, rows: roster });
      toast.success("PDF gerado!");
    } catch (e: any) {
      console.error("[IntervalosDrawer] PDF error:", e);
      toast.error(e?.message || "Erro ao gerar PDF.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Coffee className="h-5 w-5" />
            Intervalos do dia
          </SheetTitle>
          <SheetDescription>{unitName}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Data:</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-auto"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={printing || loadingRoster}
            className="gap-1.5"
          >
            {printing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Imprimir folha
          </Button>
        </div>

        <div className="mt-5 space-y-5">
          {loadingRoster || loadingBreaks ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : roster.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Sem colaboradores escalados nesta data.
            </div>
          ) : (
            sectors.map(([sectorName, sectorRows]) => (
              <section key={sectorName}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {sectorName}
                </h3>
                <div className="space-y-2">
                  {sectorRows.map((row) => (
                    <BreakRow
                      key={row.schedule_id}
                      row={row}
                      date={date}
                      unitId={unitId}
                      breaks={breaksBySchedule.get(row.schedule_id) || []}
                      onStart={() =>
                        startMut.mutate({
                          schedule_id: row.schedule_id,
                          unit_id: unitId,
                          schedule_date: date,
                          planned_minutes: row.break_duration || null,
                        })
                      }
                      onEnd={(id) => endMut.mutate(id)}
                      onSaveManual={(args) => upsertMut.mutate(args)}
                      onDelete={(id) => deleteMut.mutate(id)}
                      mutating={
                        startMut.isPending ||
                        endMut.isPending ||
                        upsertMut.isPending ||
                        deleteMut.isPending
                      }
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================

interface BreakRowProps {
  row: DailyRosterRow;
  date: string;
  unitId: string;
  breaks: ScheduleBreak[];
  onStart: () => void;
  onEnd: (breakId: string) => void;
  onSaveManual: (args: {
    id?: string;
    schedule_id: string;
    unit_id: string;
    schedule_date: string;
    started_at: string | null;
    ended_at: string | null;
    planned_minutes?: number | null;
  }) => void;
  onDelete: (breakId: string) => void;
  mutating: boolean;
}

function BreakRow({
  row,
  date,
  unitId,
  breaks,
  onStart,
  onEnd,
  onSaveManual,
  onDelete,
  mutating,
}: BreakRowProps) {
  // O intervalo "principal" exibido: aberto > último (mais recente)
  const open = breaks.find((b) => b.started_at && !b.ended_at);
  const sorted = [...breaks].sort(
    (a, b) => (b.created_at || "").localeCompare(a.created_at || ""),
  );
  const primary: ScheduleBreak | null = open || sorted[0] || null;
  const extras = sorted.filter((b) => b.id !== primary?.id);

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{row.employee_name}</span>
            {row.worker_type !== "clt" && (
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                {row.worker_type.toUpperCase()}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {row.job_title || "—"} · {hhmm(row.start_time)}–{hhmm(row.end_time)}
            {row.break_duration > 0 && (
              <> · interv. previsto {row.break_duration}min</>
            )}
          </div>

          {primary && <BreakStatusBadge brk={primary} />}

          {extras.length > 0 && (
            <details className="mt-1">
              <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                + {extras.length} intervalo(s) anterior(es)
              </summary>
              <div className="mt-1 space-y-1 pl-3 border-l border-border">
                {extras.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 text-[11px]">
                    <BreakStatusBadge brk={b} compact />
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(b.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {open ? (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1"
              onClick={() => onEnd(open.id)}
              disabled={mutating}
            >
              <Square className="h-3.5 w-3.5" />
              Encerrar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={onStart}
              disabled={mutating}
            >
              <Play className="h-3.5 w-3.5" />
              Iniciar
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <EditTimesMenuItem
                brk={primary}
                row={row}
                date={date}
                unitId={unitId}
                onSave={onSaveManual}
              />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() =>
                  onSaveManual({
                    schedule_id: row.schedule_id,
                    unit_id: unitId,
                    schedule_date: date,
                    started_at: new Date().toISOString(),
                    ended_at: null,
                    planned_minutes: row.break_duration || null,
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Adicionar outro intervalo
              </DropdownMenuItem>
              {primary && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => onDelete(primary.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir intervalo
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// ============================================================================

function BreakStatusBadge({ brk, compact = false }: { brk: ScheduleBreak; compact?: boolean }) {
  if (brk.started_at && !brk.ended_at) {
    const elapsed = Date.now() - new Date(brk.started_at).getTime();
    return (
      <div
        className={`mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 ${
          compact ? "h-5" : ""
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        Em intervalo · {formatDuration(elapsed)}
      </div>
    );
  }
  if (brk.started_at && brk.ended_at) {
    const totalMin = Math.round(
      (new Date(brk.ended_at).getTime() - new Date(brk.started_at).getTime()) / 60000,
    );
    return (
      <div
        className={`mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-200 ${
          compact ? "h-5" : ""
        }`}
      >
        Concluído · {isoToTimeInput(brk.started_at)} → {isoToTimeInput(brk.ended_at)} ({totalMin}min)
      </div>
    );
  }
  return null;
}

// ============================================================================

function EditTimesMenuItem({
  brk,
  row,
  date,
  unitId,
  onSave,
}: {
  brk: ScheduleBreak | null;
  row: DailyRosterRow;
  date: string;
  unitId: string;
  onSave: BreakRowProps["onSaveManual"];
}) {
  const [openPop, setOpenPop] = useState(false);
  const [startT, setStartT] = useState(isoToTimeInput(brk?.started_at ?? null));
  const [endT, setEndT] = useState(isoToTimeInput(brk?.ended_at ?? null));

  useEffect(() => {
    if (openPop) {
      setStartT(isoToTimeInput(brk?.started_at ?? null));
      setEndT(isoToTimeInput(brk?.ended_at ?? null));
    }
  }, [openPop, brk?.started_at, brk?.ended_at]);

  function handleSave() {
    onSave({
      id: brk?.id,
      schedule_id: row.schedule_id,
      unit_id: unitId,
      schedule_date: date,
      started_at: timeInputToIso(date, startT),
      ended_at: timeInputToIso(date, endT),
      planned_minutes: row.break_duration || null,
    });
    setOpenPop(false);
  }

  return (
    <Popover open={openPop} onOpenChange={setOpenPop}>
      <PopoverTrigger asChild>
        <DropdownMenuItem
          className="gap-2 cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            setOpenPop(true);
          }}
        >
          <Pencil className="h-4 w-4" />
          Editar horários
        </DropdownMenuItem>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 bg-popover">
        <div className="space-y-3">
          <div className="text-sm font-medium">Editar intervalo</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Saída</label>
              <Input
                type="time"
                value={startT}
                onChange={(e) => setStartT(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Retorno</label>
              <Input
                type="time"
                value={endT}
                onChange={(e) => setEndT(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpenPop(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
