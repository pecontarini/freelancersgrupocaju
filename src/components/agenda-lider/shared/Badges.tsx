import { Badge } from "@/components/ui/badge";
import type { MissaoPrioridade, MissaoStatus } from "@/hooks/useMissoes";
import { cn } from "@/lib/utils";

const PRIORIDADE_MAP: Record<MissaoPrioridade, { label: string; cls: string; emoji: string }> = {
  alta: { label: "Alta", emoji: "🔴", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  media: { label: "Média", emoji: "🟡", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400" },
  baixa: { label: "Baixa", emoji: "🟢", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400" },
};

const STATUS_MAP: Record<MissaoStatus, { label: string; cls: string }> = {
  a_fazer: { label: "A FAZER", cls: "bg-muted text-muted-foreground border-border" },
  em_andamento: { label: "EM ANDAMENTO", cls: "bg-primary/15 text-primary border-primary/30" },
  aguardando: { label: "AGUARDANDO", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400" },
  concluido: { label: "CONCLUÍDO", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400" },
};

export function PrioridadeBadge({ prioridade, className }: { prioridade: MissaoPrioridade; className?: string }) {
  const info = PRIORIDADE_MAP[prioridade];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", info.cls, className)}>
      <span aria-hidden>{info.emoji}</span>
      {info.label}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status: MissaoStatus; className?: string }) {
  const info = STATUS_MAP[status];
  return (
    <Badge variant="outline" className={cn("font-semibold uppercase tracking-wide", info.cls, className)}>
      {info.label}
    </Badge>
  );
}

export const STATUS_ORDER: MissaoStatus[] = ["a_fazer", "em_andamento", "aguardando", "concluido"];
export const STATUS_LABEL = (s: MissaoStatus) => STATUS_MAP[s].label;
