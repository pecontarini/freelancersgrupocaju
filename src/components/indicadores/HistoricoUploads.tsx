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
    return <div className="text-xs text-white/40">Carregando histórico…</div>;
  }
  if (!historico || historico.length === 0) {
    return <div className="text-xs text-white/40">Nenhum upload ainda</div>;
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
      {historico.map((h) => {
        const active = h.referenciaMes === referenciaMes;
        return (
          <button
            key={h.referenciaMes}
            onClick={() => onChange(h.referenciaMes)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex-shrink-0",
              active
                ? "bg-amber-500 border-amber-500 text-black font-semibold shadow-[0_0_0_3px_rgba(245,158,11,0.15)]"
                : "border-white/10 text-white/60 hover:border-amber-500/40 hover:text-white",
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
