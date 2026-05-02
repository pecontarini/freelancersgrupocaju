import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MissaoCardCompact } from "./MissaoCardCompact";
import type { Missao, MissaoStatus } from "@/hooks/useMissoes";
import { cn } from "@/lib/utils";

export function SortableMissaoCard({
  missao,
  status,
  responsavelNome,
  membrosCount,
  onClick,
  isLanding,
}: {
  missao: Missao;
  status: MissaoStatus;
  responsavelNome?: string | null;
  membrosCount?: number;
  onClick?: () => void;
  isLanding?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: missao.id,
    data: { missao, status, type: "card" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none outline-none",
        isDragging && "drag-ghost",
      )}
    >
      <MissaoCardCompact
        missao={missao}
        responsavelNome={responsavelNome}
        membrosCount={membrosCount}
        onClick={onClick}
        isLanding={isLanding}
        asPresentation
      />
    </div>
  );
}
