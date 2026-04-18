import { useMemo } from "react";
import { CATEGORIA_INFO, formatDateTimeBR } from "./agendaUtils";
import type { AgendaEvento } from "@/hooks/useAgendaEventos";
import { CheckCircle2, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  eventos: AgendaEvento[];
  onSelectEvent: (e: AgendaEvento) => void;
  showOwner?: boolean;
  ownerNameById?: Record<string, string>;
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
              </div>
              <div
                className={cn(
                  "mt-1 truncate font-semibold",
                  e.concluido && "line-through opacity-60"
                )}
              >
                {e.titulo}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
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
