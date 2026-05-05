import { useIndicadoresHistorico } from "@/hooks/useIndicadoresSnapshot";
import { formatReferenciaShort } from "@/lib/indicadores-parsers";
import { cn } from "@/lib/utils";

interface Props {
  metaKey: string;
  referenciaMes?: string;
  onChange: (referenciaMes: string) => void;
}

export function HistoricoUploads({ metaKey, referenciaMes, onChange }: Props) {
  const { data: historico, isLoading } = useIndicadoresHistorico(metaKey);

  if (isLoading) {
    return <div className="text-xs text-muted-foreground">Carregando histórico…</div>;
  }

  if (!historico || historico.length === 0) {
    return <div className="text-xs text-muted-foreground">Nenhum upload ainda</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {historico.map((h) => {
        const active = h.referenciaMes === referenciaMes;
        return (
          <button
            key={h.referenciaMes}
            onClick={() => onChange(h.referenciaMes)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
              active
                ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                : "border-amber-400/40 text-amber-700 hover:bg-amber-500/10 hover:border-amber-500",
            )}
            title={h.referenciaLabel}
          >
            {formatReferenciaShort(h.referenciaMes)}
          </button>
        );
      })}
    </div>
  );
}
