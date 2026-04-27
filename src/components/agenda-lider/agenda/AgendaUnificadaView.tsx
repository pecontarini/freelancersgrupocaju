import { useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Link2Off,
  List,
  Loader2,
  RefreshCw,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useUnidade } from "@/contexts/UnidadeContext";
import { useMissoes, type Missao } from "@/hooks/useMissoes";
import { useGoogleCalendarEvents, type GoogleEvent } from "@/hooks/useGoogleCalendarEvents";
import { startGoogleOAuth } from "@/services/googleCalendar";
import { PrioridadeBadge, StatusBadge, prioridadeAccent } from "../shared/Badges";
import { MissaoDetailDialog } from "../card/MissaoDetailDialog";

type ModoVisualizacao = "mes" | "semana" | "lista";

interface UnifiedItem {
  key: string;
  date: Date; // dia de referência
  start: Date;
  end: Date;
  type: "missao" | "google";
  missao?: Missao;
  event?: GoogleEvent;
  title: string;
  isAllDay: boolean;
}

// =====================================================================
// AgendaUnificadaView
// Mostra missões da Agenda do Líder + eventos do Google Agenda do líder
// logado em três modos: Mês / Semana / Lista.
// =====================================================================
export function AgendaUnificadaView() {
  const { effectiveUnidadeId } = useUnidade();
  const [modo, setModo] = useState<ModoVisualizacao>("mes");
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [openMissao, setOpenMissao] = useState<string | null>(null);

  const { data: missoes = [], isLoading: loadingMissoes } = useMissoes({
    unidadeId: effectiveUnidadeId,
  });

  // Janela ampla para o Google: cobre o mês visível ± buffer (semana inclui borda)
  const range = useMemo(() => {
    if (modo === "semana") {
      const start = startOfWeek(refDate, { weekStartsOn: 0 });
      const end = endOfWeek(refDate, { weekStartsOn: 0 });
      return { start, end };
    }
    if (modo === "mes") {
      const start = startOfWeek(startOfMonth(refDate), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(refDate), { weekStartsOn: 0 });
      return { start, end };
    }
    // lista: 30 dias a partir de hoje
    return { start: startOfDay(new Date()), end: endOfDay(addMonths(new Date(), 1)) };
  }, [modo, refDate]);

  const {
    data: googleData,
    isLoading: loadingGoogle,
    refetch: refetchGoogle,
    isFetching: fetchingGoogle,
  } = useGoogleCalendarEvents({ timeMin: range.start, timeMax: range.end });

  const needsGoogleConnect = googleData?.status === "needs_connect";

  // Unifica missões + google events
  const items = useMemo<UnifiedItem[]>(() => {
    const out: UnifiedItem[] = [];

    // Missões (usam prazo como dia)
    for (const m of missoes) {
      if (!m.prazo) continue;
      const d = parseISO(m.prazo + "T12:00:00");
      out.push({
        key: `m-${m.id}`,
        date: startOfDay(d),
        start: d,
        end: d,
        type: "missao",
        missao: m,
        title: m.titulo,
        isAllDay: true,
      });
    }

    // Eventos do Google (ignora os que já são espelhos de missões nossas)
    for (const ev of googleData?.events ?? []) {
      if (ev.caju_missao_id) continue;
      const start = ev.all_day ? parseISO(ev.start + "T00:00:00") : parseISO(ev.start);
      const end = ev.all_day ? parseISO(ev.end + "T00:00:00") : parseISO(ev.end);
      out.push({
        key: `g-${ev.id}`,
        date: startOfDay(start),
        start,
        end,
        type: "google",
        event: ev,
        title: ev.summary,
        isAllDay: ev.all_day,
      });
    }

    out.sort((a, b) => a.start.getTime() - b.start.getTime());
    return out;
  }, [missoes, googleData?.events]);

  const itemsByDay = useMemo(() => {
    const m = new Map<string, UnifiedItem[]>();
    for (const it of items) {
      const k = format(it.date, "yyyy-MM-dd");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return m;
  }, [items]);

  // Navegação entre períodos
  function goPrev() {
    if (modo === "mes") setRefDate((d) => addMonths(d, -1));
    else if (modo === "semana") setRefDate((d) => addWeeks(d, -1));
    else setRefDate(new Date());
  }
  function goNext() {
    if (modo === "mes") setRefDate((d) => addMonths(d, 1));
    else if (modo === "semana") setRefDate((d) => addWeeks(d, 1));
    else setRefDate(new Date());
  }
  function goToday() {
    setRefDate(new Date());
  }

  const periodoLabel = useMemo(() => {
    if (modo === "mes") return format(refDate, "MMMM 'de' yyyy", { locale: ptBR });
    if (modo === "semana") {
      const s = startOfWeek(refDate, { weekStartsOn: 0 });
      const e = endOfWeek(refDate, { weekStartsOn: 0 });
      return `${format(s, "dd MMM", { locale: ptBR })} – ${format(e, "dd MMM yyyy", { locale: ptBR })}`;
    }
    return "Próximos 30 dias";
  }, [modo, refDate]);

  return (
    <div className="space-y-4">
      {/* Header / Controles */}
      <div className="glass-card-strong p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
              <CalendarRange className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold leading-tight">
                Agenda unificada
              </h3>
              <p className="text-xs text-muted-foreground">
                Missões da liderança + Google Agenda em um só lugar.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={goToday}>
                Hoje
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Tabs value={modo} onValueChange={(v) => setModo(v as ModoVisualizacao)}>
              <TabsList className="h-8">
                <TabsTrigger value="mes" className="h-7 gap-1 px-2 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" /> Mês
                </TabsTrigger>
                <TabsTrigger value="semana" className="h-7 gap-1 px-2 text-xs">
                  <CalendarRange className="h-3.5 w-3.5" /> Semana
                </TabsTrigger>
                <TabsTrigger value="lista" className="h-7 gap-1 px-2 text-xs">
                  <List className="h-3.5 w-3.5" /> Lista
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => refetchGoogle()}
              disabled={fetchingGoogle}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", fetchingGoogle && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <div className="text-sm font-medium capitalize">{periodoLabel}</div>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-muted-foreground">
            <LegendDot className="bg-primary" label="Missão" />
            <LegendDot className="bg-blue-500" label="Google Agenda" />
          </div>
        </div>

        {needsGoogleConnect && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/40 p-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Link2Off className="h-3.5 w-3.5" />
              Conecte sua conta Google para ver os compromissos da sua agenda aqui.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5"
              onClick={() => {
                startGoogleOAuth("/?tab=agenda-lider").catch((e) =>
                  toast.error(e?.message ?? "Falha ao iniciar conexão Google."),
                );
              }}
            >
              Conectar Google
            </Button>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {(loadingMissoes || loadingGoogle) && items.length === 0 ? (
        <div className="glass-card flex items-center justify-center p-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando agenda…
        </div>
      ) : modo === "mes" ? (
        <MesView refDate={refDate} itemsByDay={itemsByDay} onOpenMissao={setOpenMissao} />
      ) : modo === "semana" ? (
        <SemanaView refDate={refDate} itemsByDay={itemsByDay} onOpenMissao={setOpenMissao} />
      ) : (
        <ListaView items={items} onOpenMissao={setOpenMissao} />
      )}

      <MissaoDetailDialog
        missaoId={openMissao}
        open={!!openMissao}
        onClose={() => setOpenMissao(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
function LegendDot({ className, label }: { className?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------
// VISTA: MÊS
// ---------------------------------------------------------------------
function MesView({
  refDate,
  itemsByDay,
  onOpenMissao,
}: {
  refDate: Date;
  itemsByDay: Map<string, UnifiedItem[]>;
  onOpenMissao: (id: string) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(refDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(refDate), { weekStartsOn: 0 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
    return out;
  }, [refDate]);

  const weekDayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="glass-card overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {weekDayLabels.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const k = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDay.get(k) ?? [];
          const isToday = isSameDay(day, new Date());
          const inMonth = isSameMonth(day, refDate);
          return (
            <div
              key={k}
              className={cn(
                "min-h-[110px] border-b border-r p-1.5 text-xs",
                !inMonth && "bg-muted/20 text-muted-foreground/60",
                isToday && "bg-primary/5",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayItems.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayItems.length - 3}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, 3).map((it) => (
                  <CalendarChip
                    key={it.key}
                    item={it}
                    compact
                    onClick={() => {
                      if (it.type === "missao" && it.missao) onOpenMissao(it.missao.id);
                      else if (it.type === "google" && it.event?.html_link)
                        window.open(it.event.html_link, "_blank");
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// VISTA: SEMANA
// ---------------------------------------------------------------------
function SemanaView({
  refDate,
  itemsByDay,
  onOpenMissao,
}: {
  refDate: Date;
  itemsByDay: Map<string, UnifiedItem[]>;
  onOpenMissao: (id: string) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(refDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [refDate]);

  return (
    <div className="glass-card overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {days.map((d) => {
          const isToday = isSameDay(d, new Date());
          return (
            <div
              key={d.toISOString()}
              className={cn("py-2 text-center", isToday && "text-primary")}
            >
              <div>{format(d, "EEE", { locale: ptBR })}</div>
              <div className={cn("text-base font-bold normal-case", !isToday && "text-foreground")}>
                {format(d, "dd/MM")}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const k = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDay.get(k) ?? [];
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={k}
              className={cn(
                "min-h-[260px] space-y-1 border-r p-2",
                isToday && "bg-primary/5",
              )}
            >
              {dayItems.length === 0 && (
                <div className="pt-6 text-center text-[11px] text-muted-foreground/60">
                  —
                </div>
              )}
              {dayItems.map((it) => (
                <CalendarChip
                  key={it.key}
                  item={it}
                  onClick={() => {
                    if (it.type === "missao" && it.missao) onOpenMissao(it.missao.id);
                    else if (it.type === "google" && it.event?.html_link)
                      window.open(it.event.html_link, "_blank");
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// VISTA: LISTA
// ---------------------------------------------------------------------
function ListaView({
  items,
  onOpenMissao,
}: {
  items: UnifiedItem[];
  onOpenMissao: (id: string) => void;
}) {
  // Agrupa por dia
  const grouped = useMemo(() => {
    const m = new Map<string, UnifiedItem[]>();
    for (const it of items) {
      const k = format(it.date, "yyyy-MM-dd");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (grouped.length === 0) {
    return (
      <div className="glass-card p-10 text-center text-sm text-muted-foreground">
        Nada agendado nos próximos 30 dias.
      </div>
    );
  }

  return (
    <div className="glass-card p-0">
      <ScrollArea className="max-h-[640px]">
        <div className="divide-y">
          {grouped.map(([dateKey, dayItems]) => {
            const date = parseISO(dateKey + "T12:00:00");
            const isToday = isSameDay(date, new Date());
            return (
              <div key={dateKey} className="p-3">
                <div className="mb-2 flex items-baseline gap-2">
                  <h4 className={cn("font-display text-sm font-bold", isToday && "text-primary")}>
                    {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h4>
                  {isToday && (
                    <Badge variant="outline" className="h-5 border-primary/30 bg-primary/10 text-[10px] uppercase text-primary">
                      Hoje
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  {dayItems.map((it) => (
                    <CalendarChip
                      key={it.key}
                      item={it}
                      large
                      onClick={() => {
                        if (it.type === "missao" && it.missao) onOpenMissao(it.missao.id);
                        else if (it.type === "google" && it.event?.html_link)
                          window.open(it.event.html_link, "_blank");
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------
function CalendarChip({
  item,
  compact,
  large,
  onClick,
}: {
  item: UnifiedItem;
  compact?: boolean;
  large?: boolean;
  onClick?: () => void;
}) {
  const isMissao = item.type === "missao";
  const accent = isMissao && item.missao ? prioridadeAccent(item.missao.prioridade) : null;
  const baseColor = isMissao
    ? "bg-primary/10 hover:bg-primary/20 border-primary/30"
    : "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30";

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 pl-2 text-left text-[10.5px] font-medium leading-tight backdrop-blur transition",
          baseColor,
          isMissao ? "text-primary" : "text-blue-700 dark:text-blue-300",
        )}
        title={item.title}
      >
        {accent ? (
          <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px] rounded-l", accent)} />
        ) : (
          <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-l bg-blue-500" />
        )}
        <span className="truncate uppercase tracking-wide">{item.title}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col gap-1 overflow-hidden rounded-md border p-2 pl-3 text-left backdrop-blur transition",
        baseColor,
      )}
    >
      {accent ? (
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      ) : (
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-blue-500" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {isMissao ? (
            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <CalendarRange className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
          )}
          <div>
            <div
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                isMissao ? "text-primary" : "text-blue-700 dark:text-blue-300",
                large && "text-sm",
              )}
            >
              {item.title}
            </div>
            {!item.isAllDay && (
              <div className="text-[11px] text-muted-foreground">
                {format(item.start, "HH:mm")} – {format(item.end, "HH:mm")}
              </div>
            )}
            {large && item.type === "google" && item.event?.location && (
              <div className="text-[11px] text-muted-foreground">📍 {item.event.location}</div>
            )}
          </div>
        </div>
        {item.type === "google" && item.event?.html_link && (
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100 text-blue-600 dark:text-blue-400" />
        )}
      </div>

      {large && isMissao && item.missao && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <PrioridadeBadge prioridade={item.missao.prioridade} className="h-5 text-[10px]" />
          <StatusBadge status={item.missao.status} className="h-5 text-[10px]" />
        </div>
      )}
    </button>
  );
}
