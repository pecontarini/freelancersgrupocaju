import { useEffect, useMemo, useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMissoes, type Missao, type MissaoStatus } from "@/hooks/useMissoes";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUnidadeMembros } from "@/hooks/useUnidadeMembros";
import { supabase } from "@/integrations/supabase/client";
import { MissaoColumn } from "./MissaoColumn";
import { MissaoCardCompact } from "./MissaoCardCompact";
import { MissaoDetailDialog } from "../card/MissaoDetailDialog";
import { NovaMissaoDialog } from "../card/NovaMissaoDialog";
import { STATUS_ORDER } from "../shared/Badges";
import { useAuth } from "@/contexts/AuthContext";

export function MissoesBoardView() {
  const { user } = useAuth();
  const { effectiveUnidadeId } = useUnidade();
  const { data: missoes = [], update } = useMissoes({ unidadeId: effectiveUnidadeId });
  const { data: membros = [] } = useUnidadeMembros(effectiveUnidadeId);

  const [openId, setOpenId] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [responsaveis, setResponsaveis] = useState<Record<string, { nome: string; total: number }>>(
    {},
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Carrega membros pra todas as missões visíveis (1 query)
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

  const grouped = useMemo(() => {
    const out: Record<MissaoStatus, Missao[]> = {
      a_fazer: [],
      em_andamento: [],
      aguardando: [],
      concluido: [],
    };
    missoes.forEach((m) => out[m.status].push(m));
    return out;
  }, [missoes]);

  function handleDragEnd(e: DragEndEvent) {
    const overId = e.over?.id;
    const missaoId = e.active.id as string;
    if (!overId || typeof overId !== "string" || !overId.startsWith("col-")) return;
    const newStatus = overId.slice(4) as MissaoStatus;
    const m = missoes.find((x) => x.id === missaoId);
    if (!m || m.status === newStatus) return;
    update.mutate(
      { id: missaoId, status: newStatus },
      {
        onError: (err: any) => toast.error(err?.message ?? "Falha ao mover."),
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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <MissaoColumn key={status} status={status} count={grouped[status].length}>
              {grouped[status].map((m) => (
                <MissaoCardCompact
                  key={m.id}
                  missao={m}
                  responsavelNome={responsaveis[m.id]?.nome}
                  membrosCount={responsaveis[m.id]?.total}
                  onClick={() => setOpenId(m.id)}
                />
              ))}
              {grouped[status].length === 0 && (
                <div className="rounded-md border border-dashed border-border/40 p-4 text-center text-xs text-muted-foreground">
                  Nenhuma missão
                </div>
              )}
            </MissaoColumn>
          ))}
        </div>
      </DndContext>

      <MissaoDetailDialog missaoId={openId} open={!!openId} onClose={() => setOpenId(null)} />
      <NovaMissaoDialog open={openNew} onClose={() => setOpenNew(false)} />
    </div>
  );
}
