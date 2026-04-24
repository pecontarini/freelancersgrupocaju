import { useMemo, useState } from "react";
import { CATEGORIA_INFO, WEEK_DAYS_PT, sameDay, startOfWeek } from "./agendaUtils";
import type { AgendaEvento } from "@/hooks/useAgendaEventos";
import { ChevronLeft, ChevronRight, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06 - 23

interface Props {
  eventos: AgendaEvento[];
  onSelectEvent: (e: AgendaEvento) => void;
}

export function AgendaWeekView({ eventos, onSelectEvent }: Props) {
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cursor);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  const eventsForDay = (d: Date) => eventos.filter((e) => sameDay(new Date(e.data_inicio), d));

  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">
          {days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} –{" "}
          {days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
        </h2>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(cursor);
              d.setDate(d.getDate() - 7);
              setCursor(d);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfWeek(new Date()))}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(cursor);
              d.setDate(d.getDate() + 7);
              setCursor(d);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div />
            {days.map((d, i) => {
              const isToday = sameDay(d, today);
              return (
                <div
                  key={i}
                  className={cn(
                    "py-2 text-center text-xs font-semibold uppercase",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {WEEK_DAYS_PT[i]}
                  <div className={cn("text-base", isToday && "text-primary")}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {HOURS.map((h) => (
              <div key={`r-${h}`} className="contents">
                <div className="border-r border-t py-1 pr-2 text-right text-[10px] text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </div>
                {days.map((d, di) => {
                  const evs = eventsForDay(d).filter((e) => new Date(e.data_inicio).getHours() === h);
                  return (
                    <div key={`c-${h}-${di}`} className="relative min-h-[44px] border-l border-t p-0.5">
                      {evs.map((e) => {
                        const info = CATEGORIA_INFO[e.categoria];
                        return (
                          <button
                            key={e.id}
                            onClick={() => onSelectEvent(e)}
                            className={cn(
                              "flex w-full items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[10px] font-medium transition-opacity hover:opacity-80",
                              info.bg,
                              info.text,
                              e.concluido && "line-through opacity-60"
                            )}
                            title={`${e.titulo} ${e.google_event_id ? "(Google)" : "(Local)"}`}
                          >
                            {e.google_event_id ? (
                              <Cloud className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />
                            ) : (
                              <CloudOff className="h-2.5 w-2.5 flex-shrink-0 opacity-50" />
                            )}
                            <span className="truncate">
                              {new Date(e.data_inicio).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              {e.titulo}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
