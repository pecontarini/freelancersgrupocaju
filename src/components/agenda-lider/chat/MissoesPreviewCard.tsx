import { useMemo } from "react";
import { Check, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PrioridadeBadge, PrioridadeAccentBar } from "../shared/Badges";
import type { UnidadeMembro } from "@/hooks/useUnidadeMembros";
import type { MissaoPrioridade } from "@/hooks/useMissoes";
import { cn } from "@/lib/utils";

export interface MissaoSugerida {
  topico?: string;
  titulo: string;
  descricao: string;
  prioridade: MissaoPrioridade;
  prazo: string;
  responsavel_user_id: string;
  co_responsaveis: string[];
  plano_acao: { descricao: string; dia_semana: string }[];
}

function prazoBadgeClass(prazo: string | undefined): string {
  if (!prazo || !prazo.trim()) return "bg-muted text-muted-foreground";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(prazo + "T00:00:00");
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "bg-destructive/15 text-destructive";
  if (diffDays <= 2) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-primary/10 text-primary";
}

export function MissoesPreviewCard({
  missao,
  membros,
  doneState,
  onToggleTask,
  onConfirm,
  confirmed,
}: {
  missao: MissaoSugerida;
  membros: UnidadeMembro[];
  doneState: boolean[];
  onToggleTask: (idx: number, value: boolean) => void;
  onConfirm: () => void;
  confirmed?: boolean;
}) {
  const responsavel = membros.find((m) => m.user_id === missao.responsavel_user_id);
  const coResp = (missao.co_responsaveis ?? [])
    .map((id) => membros.find((m) => m.user_id === id))
    .filter(Boolean) as UnidadeMembro[];

  const prazoCls = useMemo(() => prazoBadgeClass(missao.prazo), [missao.prazo]);

  return (
    <div className={cn("glass-card relative overflow-hidden p-3 pl-4", confirmed && "opacity-70")}>
      <PrioridadeAccentBar prioridade={missao.prioridade} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PrioridadeBadge prioridade={missao.prioridade} />
            <h4 className="truncate text-sm font-semibold uppercase tracking-wide text-foreground">{missao.titulo}</h4>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{missao.descricao}</p>
        </div>
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={confirmed}
          className="shrink-0"
          variant={confirmed ? "secondary" : "default"}
        >
          <Check className="mr-1 h-3 w-3" />
          {confirmed ? "Criada" : "Confirmar"}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {responsavel ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            <User className="h-3 w-3" />
            {responsavel.nome}
          </span>
        ) : (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
            Responsável a definir
          </span>
        )}
        {coResp.map((c) => (
          <span key={c.user_id} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            +{c.nome}
          </span>
        ))}
        {missao.prazo && missao.prazo.trim() && (
          <span className={cn("rounded-full px-2 py-0.5 font-medium", prazoCls)}>
            Prazo: {new Date(missao.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {(missao.plano_acao ?? []).length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-border/30 pt-2 text-xs">
          {missao.plano_acao.map((t, i) => {
            const done = !!doneState[i];
            return (
              <li key={i} className="flex items-start gap-2">
                <Checkbox
                  id={`task-${missao.titulo}-${i}`}
                  checked={done}
                  onCheckedChange={(v) => onToggleTask(i, !!v)}
                  className="mt-0.5"
                  disabled={confirmed}
                />
                <label
                  htmlFor={`task-${missao.titulo}-${i}`}
                  className={cn(
                    "flex-1 cursor-pointer text-foreground/90",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  {t.descricao}
                </label>
                {t.dia_semana && t.dia_semana.trim() && (
                  <span className="text-muted-foreground">
                    {new Date(t.dia_semana + "T00:00:00").toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
