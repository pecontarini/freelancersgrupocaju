import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MissaoStatus } from "@/hooks/useMissoes";
import { STATUS_LABEL } from "../shared/Badges";

const STATUS_COLOR: Record<MissaoStatus, string> = {
  a_fazer: "border-border bg-muted/30",
  em_andamento: "border-primary/30 bg-primary/5",
  aguardando: "border-amber-500/30 bg-amber-500/5",
  concluido: "border-emerald-500/30 bg-emerald-500/5",
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
        "flex h-full min-h-[400px] flex-col rounded-xl border-2 border-dashed p-3 transition",
        STATUS_COLOR[status],
        isOver && "ring-2 ring-primary/50",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {STATUS_LABEL(status)}
        </h3>
        <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">{children}</div>
    </div>
  );
}
