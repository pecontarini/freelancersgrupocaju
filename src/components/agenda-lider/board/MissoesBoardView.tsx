import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  closestCorners,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMissoes, type Missao, type MissaoStatus } from "@/hooks/useMissoes";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUnidadeMembros } from "@/hooks/useUnidadeMembros";
import { supabase } from "@/integrations/supabase/client";
import { MissaoColumn } from "./MissaoColumn";
import { MissaoCardCompact } from "./MissaoCardCompact";
import { SortableMissaoCard } from "./SortableMissaoCard";
import { MissaoDetailDialog } from "../card/MissaoDetailDialog";
import { NovaMissaoDialog } from "../card/NovaMissaoDialog";
import { STATUS_ORDER } from "../shared/Badges";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const dropAnimation: DropAnimation = {
  duration: 260,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.35" } },
  }),
};

type Grouped = Record<MissaoStatus, Missao[]>;

const STATUS_LABEL_PT: Record<MissaoStatus, string> = {
  a_fazer: "A fazer",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluido: "Concluído",
};

export function MissoesBoardView() {
  const { effectiveUnidadeId } = useUnidade();
  const { data: missoes = [], update } = useMissoes({ unidadeId: effectiveUnidadeId });
  const { data: membros = [] } = useUnidadeMembros(effectiveUnidadeId);
  const haptic = useHapticFeedback();

  const [openId, setOpenId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [activeMissao, setActiveMissao] = useState<Missao | null>(null);
  const [landingId, setLandingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<MissaoStatus | null>(null);
  const [responsaveis, setResponsaveis] = useState<Record<string, { nome: string; total: number }>>(
    {},
  );

  // Local optimistic state — overlays the server data while dragging.
  const [localGrouped, setLocalGrouped] = useState<Grouped | null>(null);
  const initialStatusRef = useRef<MissaoStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (activeMissao) document.body.classList.add("is-dragging");
    else document.body.classList.remove("is-dragging");
    return () => document.body.classList.remove("is-dragging");
  }, [activeMissao]);

  useEffect(() => {
    if (missoes.length === 0) {
      setResponsaveis({});
      return;
    }
    const ids = missoes.map((m) => m.id);
    supabase
      .from("missao_membros" as any)
      .select("missao_id, user_id, papel")
      .in("missao_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { nome: string; total: number }> = {};
        const totals: Record<string, number> = {};
        (data as any[]).forEach((r) => {
          totals[r.missao_id] = (totals[r.missao_id] ?? 0) + 1;
          if (r.papel === "responsavel") {
            const m = membros.find((x) => x.user_id === r.user_id);
            map[r.missao_id] = { nome: m?.nome ?? "—", total: 0 };
          }
        });
        Object.keys(totals).forEach((mid) => {
          map[mid] = { nome: map[mid]?.nome ?? "—", total: totals[mid] };
        });
        setResponsaveis(map);
      });
  }, [missoes, membros]);

  const serverGrouped = useMemo<Grouped>(() => {
    const out: Grouped = { a_fazer: [], em_andamento: [], aguardando: [], concluido: [] };
    missoes.forEach((m) => out[m.status].push(m));
    return out;
  }, [missoes]);

  const grouped = localGrouped ?? serverGrouped;

  function findContainer(id: string): MissaoStatus | null {
    if (id.startsWith("col-")) return id.slice(4) as MissaoStatus;
    for (const s of STATUS_ORDER) {
      if (grouped[s].some((m) => m.id === id)) return s;
    }
    return null;
  }

  function handleDragStart(e: DragStartEvent) {
    const m = (e.active.data.current as any)?.missao as Missao | undefined;
    if (!m) return;
    setActiveMissao(m);
    initialStatusRef.current = m.status;
    setLocalGrouped(serverGrouped);
    haptic.pickup();
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const fromCol = findContainer(activeId);
    const toCol = findContainer(overId);
    if (!fromCol || !toCol) return;
    setOverColumn(toCol);
    if (fromCol === toCol) return;

    setLocalGrouped((prev) => {
      const base = prev ?? serverGrouped;
      const next: Grouped = {
        a_fazer: [...base.a_fazer],
        em_andamento: [...base.em_andamento],
        aguardando: [...base.aguardando],
        concluido: [...base.concluido],
      };
      const idx = next[fromCol].findIndex((m) => m.id === activeId);
      if (idx === -1) return prev;
      const [moved] = next[fromCol].splice(idx, 1);
      const overIdx = next[toCol].findIndex((m) => m.id === overId);
      const insertAt = overIdx === -1 ? next[toCol].length : overIdx;
      next[toCol].splice(insertAt, 0, { ...moved, status: toCol });
      return next;
    });
  }

  function handleDragCancel() {
    setActiveMissao(null);
    setOverColumn(null);
    setLocalGrouped(null);
    initialStatusRef.current = null;
    haptic.cancel();
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const missaoId = String(active.id);
    const dragged = activeMissao;
    setActiveMissao(null);
    setOverColumn(null);

    if (!over || !dragged) {
      setLocalGrouped(null);
      return;
    }

    const toCol = findContainer(String(over.id));
    const fromCol = initialStatusRef.current;
    initialStatusRef.current = null;

    if (!toCol) {
      setLocalGrouped(null);
      return;
    }

    // Reorder within same column (visual only; not persisted yet)
    if (toCol === fromCol) {
      const overId = String(over.id);
      if (overId !== missaoId && !overId.startsWith("col-")) {
        setLocalGrouped((prev) => {
          const base = prev ?? serverGrouped;
          const arr = base[toCol];
          const oldIdx = arr.findIndex((m) => m.id === missaoId);
          const newIdx = arr.findIndex((m) => m.id === overId);
          if (oldIdx === -1 || newIdx === -1) return prev;
          return { ...base, [toCol]: arrayMove(arr, oldIdx, newIdx) };
        });
        // No DB persistence — drop the local override after a beat to re-sync
        setTimeout(() => setLocalGrouped(null), 1200);
      } else {
        setLocalGrouped(null);
      }
      return;
    }

    // Status change → persist
    haptic.drop();
    update.mutate(
      { id: missaoId, status: toCol },
      {
        onSuccess: () => {
          setLandingId(missaoId);
          window.setTimeout(() => setLandingId(null), 600);
          setLocalGrouped(null);
        },
        onError: (err: any) => {
          toast.error(err?.message ?? "Falha ao mover.");
          setLocalGrouped(null);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Arraste cards entre colunas para mudar o status. Clique para abrir detalhes.
        </p>
        <Button size="sm" onClick={() => setOpenNew(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nova missão
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Pegou a missão ${String(active.id)}`,
            onDragOver: ({ active, over }) =>
              over ? `Missão sobre ${String(over.id)}` : `Missão fora de área`,
            onDragEnd: ({ active, over }) =>
              over ? `Missão solta em ${String(over.id)}` : `Drag cancelado`,
            onDragCancel: () => "Drag cancelado",
          },
          screenReaderInstructions: {
            draggable:
              "Use espaço para pegar a missão, setas para mover entre colunas, espaço para soltar.",
          },
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {STATUS_ORDER.map((status) => {
            const items = grouped[status];
            const isActiveTarget = !!activeMissao && overColumn === status;
            return (
              <MissaoColumn
                key={status}
                status={status}
                count={items.length}
                itemIds={items.map((m) => m.id)}
                isActiveTarget={isActiveTarget}
                isDragInProgress={!!activeMissao}
              >
                {items.map((m) => (
                  <SortableMissaoCard
                    key={m.id}
                    missao={m}
                    status={status}
                    responsavelNome={responsaveis[m.id]?.nome}
                    membrosCount={responsaveis[m.id]?.total}
                    onClick={() => setOpenId(m.id)}
                    isLanding={landingId === m.id}
                  />
                ))}
                {items.length === 0 && (
                  <div className="rounded-md border border-dashed border-border/40 p-4 text-center text-xs text-muted-foreground">
                    {isActiveTarget ? "Soltar aqui" : "Nenhuma missão"}
                  </div>
                )}
              </MissaoColumn>
            );
          })}
        </div>

        <DragOverlay dropAnimation={dropAnimation} zIndex={100}>
          {activeMissao ? (
            <MissaoCardCompact
              missao={activeMissao}
              responsavelNome={responsaveis[activeMissao.id]?.nome}
              membrosCount={responsaveis[activeMissao.id]?.total}
              variant="overlay"
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <MissaoDetailDialog missaoId={openId} open={!!openId} onClose={() => setOpenId(null)} />
      <NovaMissaoDialog open={openNew} onClose={() => setOpenNew(false)} />
    </div>
  );
}
