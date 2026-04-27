import { useDraggable } from "@dnd-kit/core";
import { Calendar, Users } from "lucide-react";
import { PrioridadeBadge, PrioridadeAccentBar } from "../shared/Badges";
import type { Missao } from "@/hooks/useMissoes";
import { cn } from "@/lib/utils";

type Variant = "default" | "overlay";

export function MissaoCardCompact({
  missao,
  responsavelNome,
  membrosCount,
  onClick,
  variant = "default",
  isLanding = false,
}: {
  missao: Missao;
  responsavelNome?: string | null;
  membrosCount?: number;
  onClick?: () => void;
  variant?: Variant;
  isLanding?: boolean;
}) {
  // Em modo overlay, não usamos o draggable (já está dentro do DragOverlay).
  const draggable = useDraggable({
    id: missao.id,
    data: { missao },
    disabled: variant === "overlay",
  });

  const isOverlay = variant === "overlay";
  const isDragging = !isOverlay && draggable.isDragging;

  const content = (
    <>
      <PrioridadeAccentBar prioridade={missao.prioridade} />
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-sm font-semibold uppercase tracking-wide leading-tight text-foreground">
          {missao.titulo}
        </h4>
        <PrioridadeBadge prioridade={missao.prioridade} className="shrink-0 px-1.5 py-0 text-[10px]" />
      </div>

      {missao.descricao && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{missao.descricao}</p>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span className="truncate">{responsavelNome ?? "—"}</span>
          {membrosCount && membrosCount > 1 && (
            <span className="rounded-full bg-muted px-1.5 py-0 text-[10px]">+{membrosCount - 1}</span>
          )}
        </div>
        {missao.prazo && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(missao.prazo + "T00:00:00").toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </div>
        )}
      </div>
    </>
  );

  if (isOverlay) {
    return (
      <div
        className={cn(
          "glass-card-strong drag-overlay-card relative w-[260px] space-y-2 overflow-hidden p-3 pl-4",
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      ref={draggable.setNodeRef}
      {...draggable.attributes}
      {...draggable.listeners}
      onClick={onClick}
      className={cn(
        "glass-card hover-lift relative cursor-grab active:cursor-grabbing space-y-2 overflow-hidden p-3 pl-4 transition-all duration-200",
        isDragging && "drag-ghost",
        isLanding && "drag-landing",
      )}
    >
      {content}
    </div>
  );
}
