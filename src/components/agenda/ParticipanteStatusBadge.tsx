import { cn } from "@/lib/utils";
import type { ParticipanteStatus } from "@/hooks/useAgendaEventos";

const STATUS_STYLE: Record<ParticipanteStatus, { label: string; className: string }> = {
  aceito: { label: "Aceito", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40" },
  recusado: { label: "Recusado", className: "bg-destructive/15 text-destructive border-destructive/40" },
  talvez: { label: "Talvez", className: "bg-amber-500/15 text-amber-600 border-amber-500/40" },
  pendente: { label: "Aguardando", className: "bg-muted text-muted-foreground border-border" },
};

export function ParticipanteStatusBadge({ status }: { status: ParticipanteStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        s.className
      )}
    >
      {s.label}
    </span>
  );
}

export const STATUS_DOT_COLOR: Record<ParticipanteStatus, string> = {
  aceito: "bg-emerald-500",
  recusado: "bg-destructive",
  talvez: "bg-amber-500",
  pendente: "bg-muted-foreground/60",
};
