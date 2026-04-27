import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMissoes, type Missao } from "@/hooks/useMissoes";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { supabase } from "@/integrations/supabase/client";
import { PrioridadeBadge, StatusBadge, PrioridadeAccentBar } from "../shared/Badges";
import { MissaoDetailDialog } from "../card/MissaoDetailDialog";

interface TarefaCompacta {
  id: string;
  missao_id: string;
  descricao: string;
  dia_semana: string | null;
  concluido: boolean;
}

export function MeuPainelView() {
  const { user } = useAuth();
  const { effectiveUnidadeId } = useUnidade();
  const { data: missoes = [], isLoading } = useMissoes({
    unidadeId: effectiveUnidadeId,
    onlyMine: true,
  });

  const [tarefasHoje, setTarefasHoje] = useState<TarefaCompacta[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingTarefas, setLoadingTarefas] = useState(false);

  const hoje = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  useEffect(() => {
    if (missoes.length === 0) {
      setTarefasHoje([]);
      return;
    }
    setLoadingTarefas(true);
    const ids = missoes.map((m) => m.id);
    supabase
      .from("missao_tarefas" as any)
      .select("id, missao_id, descricao, dia_semana, concluido")
      .in("missao_id", ids)
      .eq("dia_semana", hoje)
      .order("ordem")
      .then(({ data }) => {
        setTarefasHoje(((data ?? []) as any[]) as TarefaCompacta[]);
        setLoadingTarefas(false);
      });
  }, [missoes, hoje]);

  async function toggleTarefa(t: TarefaCompacta) {
    const novoVal = !t.concluido;
    setTarefasHoje((prev) => prev.map((x) => (x.id === t.id ? { ...x, concluido: novoVal } : x)));
    await supabase
      .from("missao_tarefas" as any)
      .update({
        concluido: novoVal,
        concluido_por: novoVal ? user?.id ?? null : null,
        concluido_em: novoVal ? new Date().toISOString() : null,
      } as any)
      .eq("id", t.id);
  }

  const ativas = missoes.filter((m) => m.status !== "concluido");
  const concluidas = missoes.filter((m) => m.status === "concluido");

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hoje */}
      <div className="glass-card relative overflow-hidden p-4">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
            Checklist de hoje
          </h3>
        </div>
        {loadingTarefas ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : tarefasHoje.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada agendado para hoje.</p>
        ) : (
          <ul className="space-y-2">
            {tarefasHoje.map((t) => {
              const m = missoes.find((mm) => mm.id === t.missao_id);
              return (
                <li
                  key={t.id}
                  className="flex items-start gap-2 rounded-md border border-white/40 bg-white/40 p-2 backdrop-blur dark:border-white/10 dark:bg-white/5"
                >
                  <Checkbox
                    checked={t.concluido}
                    onCheckedChange={() => toggleTarefa(t)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${t.concluido ? "text-muted-foreground line-through" : ""}`}>
                      {t.descricao}
                    </p>
                    {m && (
                      <button
                        onClick={() => setOpenId(m.id)}
                        className="text-[10px] text-muted-foreground hover:text-primary hover:underline"
                      >
                        <span className="uppercase tracking-wide">↳ {m.titulo}</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Missões ativas */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Minhas missões ({ativas.length})
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ativas.map((m) => (
            <MissaoCardMeuPainel key={m.id} missao={m} onClick={() => setOpenId(m.id)} />
          ))}
          {ativas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma missão ativa.</p>
          )}
        </div>
      </div>

      {/* Concluídas */}
      {concluidas.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" /> Concluídas ({concluidas.length})
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {concluidas.map((m) => (
              <MissaoCardMeuPainel key={m.id} missao={m} onClick={() => setOpenId(m.id)} />
            ))}
          </div>
        </div>
      )}

      <MissaoDetailDialog missaoId={openId} open={!!openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function MissaoCardMeuPainel({ missao, onClick }: { missao: Missao; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass-card hover-lift relative flex w-full flex-col items-start gap-2 overflow-hidden p-3 pl-4 text-left"
    >
      <PrioridadeAccentBar prioridade={missao.prioridade} />
      <div className="flex w-full items-center justify-between gap-2">
        <PrioridadeBadge prioridade={missao.prioridade} className="px-1.5 py-0 text-[10px]" />
        <StatusBadge status={missao.status} className="px-1.5 py-0 text-[10px]" />
      </div>
      <h4 className="line-clamp-2 text-sm font-semibold uppercase tracking-wide">{missao.titulo}</h4>
      {missao.descricao && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{missao.descricao}</p>
      )}
      {missao.prazo && (
        <p className="text-[10px] text-muted-foreground">
          Prazo: {new Date(missao.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
        </p>
      )}
    </button>
  );
}
