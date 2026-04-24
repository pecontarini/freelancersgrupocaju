import { useMemo } from "react";
import { CATEGORIA_INFO, formatDateTimeBR } from "./agendaUtils";
import type { AgendaEvento, AgendaParticipante } from "@/hooks/useAgendaEventos";
import { CheckCircle2, Clock, User, Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_DOT_COLOR } from "./ParticipanteStatusBadge";

interface Props {
  eventos: AgendaEvento[];
  onSelectEvent: (e: AgendaEvento) => void;
  showOwner?: boolean;
  ownerNameById?: Record<string, string>;
}

function initialsFrom(p: AgendaParticipante): string {
  const src = (p.nome && p.nome.trim()) || p.email.split("@")[0] || p.email;
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || src.slice(0, 2)).toUpperCase();
}

export function AgendaListView({ eventos, onSelectEvent, showOwner, ownerNameById }: Props) {
  const ordered = useMemo(() => {
    const now = Date.now();
    return [...eventos]
      .filter((e) => new Date(e.data_inicio).getTime() >= now - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());
  }, [eventos]);

  if (ordered.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">
        Nenhum evento futuro. Crie o primeiro com o botão "Novo Evento".
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ordered.map((e) => {
        const info = CATEGORIA_INFO[e.categoria];
        const participantes = e.participantes ?? [];
        const visiveis = participantes.slice(0, 3);
        const restantes = participantes.length - visiveis.length;
        return (
          <button
            key={e.id}
            onClick={() => onSelectEvent(e)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border bg-card/40 p-4 text-left transition-all hover:border-primary/40 hover:bg-accent",
              info.border
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    info.bg,
                    info.text
                  )}
                >
                  {info.label}
                </span>
                {e.concluido ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> Concluído
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
                    <Clock className="h-3 w-3" /> Pendente
                  </span>
                )}
                {e.google_event_id ? (
                  <span
                    title="Sincronizado com Google Calendar"
                    className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600"
                  >
                    <Cloud className="h-3 w-3" /> Google
                  </span>
                ) : (
                  <span
                    title="Salvo apenas localmente"
                    className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground"
                  >
                    <CloudOff className="h-3 w-3" /> Local
                  </span>
                )}
              </div>
              <div
                className={cn(
                  "mt-1 truncate font-semibold",
                  e.concluido && "line-through opacity-60"
                )}
              >
                {e.titulo}
              </div>

              {participantes.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1">
                  <div className="flex -space-x-1.5">
                    {visiveis.map((p) => (
                      <span
                        key={p.email}
                        title={`${p.nome ?? p.email} (${p.status})`}
                        className="relative"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-primary/15 text-[9px] font-bold uppercase text-primary">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                          ) : (
                            initialsFrom(p)
                          )}
                        </span>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] border-background",
                            STATUS_DOT_COLOR[p.status]
                          )}
                        />
                      </span>
                    ))}
                  </div>
                  {restantes > 0 && (
                    <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                      +{restantes}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-1 text-xs text-muted-foreground">
                {formatDateTimeBR(e.data_inicio)}
                {e.data_fim && ` → ${formatDateTimeBR(e.data_fim)}`}
              </div>
              {showOwner && ownerNameById && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {ownerNameById[e.user_id] ?? "Usuário"}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
