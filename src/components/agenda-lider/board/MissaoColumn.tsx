import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MissaoStatus } from "@/hooks/useMissoes";
import { STATUS_LABEL } from "../shared/Badges";

const STATUS_ACCENT: Record<MissaoStatus, string> = {
  a_fazer: "before:bg-muted-foreground/30",
  em_andamento: "before:bg-primary/60",
  aguardando: "before:bg-amber-500/60",
  concluido: "before:bg-emerald-500/60",
};

export function MissaoColumn({
  status,
  count,
  children,
}: {
  status: MissaoStatus;
  count: number;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `col-${status}`,
    data: { status },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass-card relative flex h-full min-h-[400px] flex-col p-3 transition",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-[inherit]",
        STATUS_ACCENT[status],
        isOver && "ring-2 ring-primary/50 shadow-[var(--shadow-primary)]",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {STATUS_LABEL(status)}
        </h3>
        <span className="rounded-full border border-white/40 bg-background/60 px-2 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur">
          {count}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">{children}</div>
    </div>
  );
}
