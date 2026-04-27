import { useDraggable } from "@dnd-kit/core";
import { Calendar, Users } from "lucide-react";
import { PrioridadeBadge, PrioridadeAccentBar } from "../shared/Badges";
import type { Missao } from "@/hooks/useMissoes";
import { cn } from "@/lib/utils";

export function MissaoCardCompact({
  missao,
  responsavelNome,
  membrosCount,
  onClick,
}: {
  missao: Missao;
  responsavelNome?: string | null;
  membrosCount?: number;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: missao.id,
    data: { missao },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "glass-card hover-lift relative cursor-pointer space-y-2 overflow-hidden p-3 pl-4",
        isDragging && "opacity-50 ring-2 ring-primary/40",
      )}
    >
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
    </div>
  );
}
