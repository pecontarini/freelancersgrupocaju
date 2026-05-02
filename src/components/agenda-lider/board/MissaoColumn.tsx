import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
  itemIds,
  children,
  isActiveTarget = false,
  isDragInProgress = false,
}: {
  status: MissaoStatus;
  count: number;
  itemIds: string[];
  children: ReactNode;
  isActiveTarget?: boolean;
  isDragInProgress?: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `col-${status}`,
    data: { status, type: "column" },
  });

  const dimmed = isDragInProgress && !isActiveTarget;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass-card relative flex h-full min-h-[400px] flex-col p-3 transition-all duration-300",
        "before:absolute before:left-0 before:top-0 before:h-full before:rounded-l-[inherit] before:transition-all before:duration-300",
        STATUS_ACCENT[status],
        isActiveTarget ? "before:w-[5px]" : "before:w-[3px]",
        isActiveTarget && "drop-zone-active",
        dimmed && "drag-column-dim",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {STATUS_LABEL(status)}
        </h3>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-xs font-medium backdrop-blur transition-all duration-300",
            isActiveTarget
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-white/40 bg-background/60 text-muted-foreground",
          )}
        >
          {count}
        </span>
      </div>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto">{children}</div>
      </SortableContext>
    </div>
  );
}
