import { useMemo, useState } from "react";
import { CATEGORIA_INFO, MONTHS_PT, WEEK_DAYS_PT, sameDay, startOfMonth } from "./agendaUtils";
import type { AgendaEvento } from "@/hooks/useAgendaEventos";
import { ChevronLeft, ChevronRight, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  eventos: AgendaEvento[];
  onSelectEvent: (e: AgendaEvento) => void;
  onCreateForDate: (date: Date) => void;
}

export function AgendaMonthView({ eventos, onSelectEvent, onCreateForDate }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfMonth(cursor);
    const startWeekday = start.getDay();
    const totalDaysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (startWeekday - i));
      cells.push({ date: d, inMonth: false });
    }
    for (let i = 1; i <= totalDaysInMonth; i++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), i), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AgendaEvento[]>();
    eventos.forEach((e) => {
      const dt = new Date(e.data_inicio);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [eventos]);

  const dayEvents = (d: Date) =>
    eventsByDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? [];

  const today = new Date();
  const selectedDayEvents = selectedDay ? dayEvents(selectedDay) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">
          {MONTHS_PT[cursor.getMonth()]} {cursor.getFullYear()}
        </h2>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-muted-foreground">
        {WEEK_DAYS_PT.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, inMonth }, idx) => {
          const evs = dayEvents(date);
          const isToday = sameDay(date, today);
          const isSelected = selectedDay && sameDay(date, selectedDay);
          return (
            <button
              key={idx}
              onClick={() => setSelectedDay(date)}
              onDoubleClick={() => onCreateForDate(date)}
              className={cn(
                "min-h-[88px] rounded-lg border p-1.5 text-left transition-all",
                "hover:border-primary/50 hover:shadow-sm",
                inMonth ? "bg-card/40" : "bg-muted/20 text-muted-foreground/60",
                isToday && "border-primary/60 ring-1 ring-primary/30",
                isSelected && "border-primary bg-primary/5"
              )}
            >
              <div className={cn("text-xs font-semibold", isToday && "text-primary")}>
                {date.getDate()}
              </div>
              <div className="mt-1 space-y-0.5">
                {evs.slice(0, 3).map((e) => {
                  const info = CATEGORIA_INFO[e.categoria];
                  return (
                    <div
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectEvent(e);
                      }}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
                        info.bg,
                        info.text,
                        e.concluido && "line-through opacity-60"
                      )}
                    >
                      {e.google_event_id ? (
                        <Cloud className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />
                      ) : (
                        <CloudOff className="h-2.5 w-2.5 flex-shrink-0 opacity-50" />
                      )}
                      <span className="truncate">{e.titulo}</span>
                    </div>
                  );
                })}
                {evs.length > 3 && (
                  <div className="px-1.5 text-[10px] text-muted-foreground">+{evs.length - 3} mais</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && selectedDayEvents.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="mb-3 font-semibold">
            Eventos de{" "}
            {selectedDay.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
          </h3>
          <div className="space-y-2">
            {selectedDayEvents.map((e) => {
              const info = CATEGORIA_INFO[e.categoria];
              return (
                <button
                  key={e.id}
                  onClick={() => onSelectEvent(e)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                    info.border
                  )}
                >
                  <div>
                    <div className={cn("font-medium", e.concluido && "line-through opacity-60")}>
                      {e.titulo}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.data_inicio).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {e.data_fim &&
                        ` – ${new Date(e.data_fim).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", info.bg, info.text)}>
                    {info.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
