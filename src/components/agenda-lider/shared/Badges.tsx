import { Badge } from "@/components/ui/badge";
import type { MissaoPrioridade, MissaoStatus } from "@/hooks/useMissoes";
import { cn } from "@/lib/utils";

const PRIORIDADE_MAP: Record<MissaoPrioridade, { label: string; cls: string; accent: string }> = {
  alta: {
    label: "ALTA",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    accent: "bg-destructive",
  },
  media: {
    label: "MÉDIA",
    cls: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
    accent: "bg-amber-500",
  },
  baixa: {
    label: "BAIXA",
    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
    accent: "bg-emerald-500",
  },
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
    <Badge variant="outline" className={cn("font-semibold uppercase tracking-wide", info.cls, className)}>
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

/**
 * Retorna a classe Tailwind da cor sólida usada como "etiqueta" lateral
 * (faixa vertical) que indica a prioridade visualmente em cards.
 */
export function prioridadeAccent(prioridade: MissaoPrioridade): string {
  return PRIORIDADE_MAP[prioridade].accent;
}

/**
 * Faixa vertical colorida (à esquerda) para usar como etiqueta de prioridade
 * em cards. O card deve ser `relative overflow-hidden`.
 */
export function PrioridadeAccentBar({
  prioridade,
  className,
  width = "w-1",
}: {
  prioridade: MissaoPrioridade;
  className?: string;
  width?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("absolute inset-y-0 left-0", width, prioridadeAccent(prioridade), className)}
    />
  );
}

export const STATUS_ORDER: MissaoStatus[] = ["a_fazer", "em_andamento", "aguardando", "concluido"];
export const STATUS_LABEL = (s: MissaoStatus) => STATUS_MAP[s].label;
