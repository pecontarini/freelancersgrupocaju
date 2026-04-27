import { Check, ChevronRight, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrioridadeBadge } from "../shared/Badges";
import type { UnidadeMembro } from "@/hooks/useUnidadeMembros";
import type { MissaoPrioridade } from "@/hooks/useMissoes";

export interface MissaoSugerida {
  titulo: string;
  descricao: string;
  prioridade: MissaoPrioridade;
  prazo: string;
  responsavel_user_id: string;
  co_responsaveis: string[];
  plano_acao: { descricao: string; dia_semana: string }[];
}

export function MissoesPreviewCard({
  missao,
  membros,
  onConfirm,
}: {
  missao: MissaoSugerida;
  membros: UnidadeMembro[];
  onConfirm: () => void;
}) {
  const responsavel = membros.find((m) => m.user_id === missao.responsavel_user_id);
  const coResp = (missao.co_responsaveis ?? [])
    .map((id) => membros.find((m) => m.user_id === id))
    .filter(Boolean) as UnidadeMembro[];

  return (
    <Card className="border-primary/20 bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PrioridadeBadge prioridade={missao.prioridade} />
            <h4 className="truncate text-sm font-semibold text-foreground">{missao.titulo}</h4>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{missao.descricao}</p>
        </div>
        <Button size="sm" onClick={onConfirm} className="shrink-0">
          <Check className="mr-1 h-3 w-3" /> Confirmar
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {responsavel ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            <User className="h-3 w-3" />
            {responsavel.nome}
          </span>
        ) : (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400">
            Responsável a definir
          </span>
        )}
        {coResp.map((c) => (
          <span key={c.user_id} className="rounded-full bg-muted px-2 py-0.5">
            +{c.nome}
          </span>
        ))}
        {missao.prazo && missao.prazo.trim() && (
          <span>Prazo: {new Date(missao.prazo + "T00:00:00").toLocaleDateString("pt-BR")}</span>
        )}
      </div>

      {(missao.plano_acao ?? []).length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/30 pt-2 text-xs">
          {missao.plano_acao.map((t, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <ChevronRight className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
              <span className="text-foreground/80">{t.descricao}</span>
              {t.dia_semana && t.dia_semana.trim() && (
                <span className="ml-auto text-muted-foreground">
                  {new Date(t.dia_semana + "T00:00:00").toLocaleDateString("pt-BR", {
                    weekday: "short",
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
