import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Check,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import type { UnitJob } from "@/hooks/usePOPWizardBatch";
import { POPWizardPreview } from "./POPWizardPreview";

interface UnitProposalCardProps {
  job: UnitJob;
  onApply: (unitId: string) => void;
  onDiscard: (unitId: string) => void;
  onRetry: (unitId: string) => void;
}

function StatusBadge({ status }: { status: UnitJob["status"] }) {
  switch (status) {
    case "queued":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> Na fila
        </Badge>
      );
    case "streaming":
      return (
        <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
          <Loader2 className="h-3 w-3 animate-spin" /> Lendo POP
        </Badge>
      );
    case "ready":
      return (
        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> Proposta pronta
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" /> Falhou
        </Badge>
      );
    case "applying":
      return (
        <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
          <Loader2 className="h-3 w-3 animate-spin" /> Aplicando
        </Badge>
      );
    case "applied":
      return (
        <Badge className="gap-1 bg-emerald-700 hover:bg-emerald-700">
          <Check className="h-3 w-3" /> Aplicada
        </Badge>
      );
    case "discarded":
      return (
        <Badge variant="secondary" className="gap-1">
          <Trash2 className="h-3 w-3" /> Descartada
        </Badge>
      );
  }
}

export function UnitProposalCard({
  job,
  onApply,
  onDiscard,
  onRetry,
}: UnitProposalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isBusy = job.status === "streaming" || job.status === "applying";
  const canExpand = job.status === "ready" && !!job.proposed;

  return (
    <div
      className={cn(
        "rounded-lg border bg-background/60 backdrop-blur-sm transition-colors",
        job.status === "applied" && "border-emerald-500/40 bg-emerald-500/5",
        job.status === "failed" && "border-destructive/40 bg-destructive/5",
        job.status === "discarded" && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => canExpand && setExpanded((v) => !v)}
              disabled={!canExpand}
              className={cn(
                "rounded p-0.5",
                canExpand
                  ? "hover:bg-muted text-foreground"
                  : "text-muted-foreground/40 cursor-default",
              )}
              aria-label={expanded ? "Recolher" : "Expandir"}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate uppercase">
                {job.unitName}
              </div>
              <div className="text-[11px] text-muted-foreground">{job.brand}</div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={job.status} />
          {job.status === "ready" && job.proposed && (
            <span className="text-[10px] text-muted-foreground">
              {job.proposed.changes.length} célula(s)
            </span>
          )}
        </div>
      </div>

      {/* Resumo curto da IA quando há proposta */}
      {job.status === "ready" && job.proposed?.summary && (
        <div className="px-3 pb-2 -mt-1">
          <div className="rounded-md bg-muted/40 border border-border/40 px-2.5 py-1.5">
            <div className="prose prose-xs max-w-none text-[11px] text-muted-foreground prose-p:my-0">
              <ReactMarkdown>{job.proposed.summary}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Erro */}
      {job.status === "failed" && job.error && (
        <div className="px-3 pb-2 -mt-1">
          <p className="text-[11px] text-destructive">{job.error}</p>
        </div>
      )}

      {/* Aplicada */}
      {job.status === "applied" && (
        <div className="px-3 pb-2 -mt-1">
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            {job.appliedCount ?? 0} célula(s) gravada(s) na grade desta unidade.
          </p>
        </div>
      )}

      {/* Diff expandido */}
      {expanded && job.proposed && job.currentConfig && (
        <div className="border-t border-border/40 bg-muted/20 p-2">
          <POPWizardPreview
            proposed={job.proposed}
            currentConfig={job.currentConfig}
          />
        </div>
      )}

      {/* Ações */}
      {(job.status === "ready" || job.status === "failed") && (
        <div className="flex items-center justify-end gap-1.5 border-t border-border/40 px-3 py-2">
          {job.status === "failed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRetry(job.unitId)}
              disabled={isBusy}
              className="h-7 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Tentar de novo
            </Button>
          )}
          {job.status === "ready" && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDiscard(job.unitId)}
                disabled={isBusy}
                className="h-7 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Descartar
              </Button>
              <Button
                size="sm"
                onClick={() => onApply(job.unitId)}
                disabled={isBusy}
                className="h-7 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Aplicar nesta unidade
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
