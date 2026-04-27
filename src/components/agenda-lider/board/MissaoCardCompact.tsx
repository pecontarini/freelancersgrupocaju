import { useDraggable } from "@dnd-kit/core";
import { Calendar, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PrioridadeBadge } from "../shared/Badges";
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
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-pointer space-y-2 border-border/60 bg-card/80 p-3 transition hover:border-primary/40 hover:shadow-md",
        isDragging && "opacity-50 ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
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
    </Card>
  );
}
