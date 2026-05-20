import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  className?: string;
}

export function SchedulableEmptyState({ className }: Props) {
  const qc = useQueryClient();
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/40 bg-card/50 px-6 py-10 text-center backdrop-blur-md ${className ?? ""}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
        <CloudOff className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1 max-w-md">
        <p className="text-sm font-medium text-foreground">
          Nenhum funcionário CLT sincronizado nesta unidade.
        </p>
        <p className="text-xs text-muted-foreground">
          Verifique se o cadastro no Secullum foi feito.
          A sincronização acontece todo dia às 5h.
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          qc.invalidateQueries({ queryKey: ["employees"] });
          qc.invalidateQueries({ queryKey: ["employees-schedulable"] });
        }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Atualizar agora
      </Button>
    </div>
  );
}
