import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import type { NpsData } from "@/lib/indicadores-parsers";
import { Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

function NpsList({ titulo, Icon, itens }: { titulo: string; Icon: any; itens: NpsData["atendimento"] }) {
  return (
    <div className="rounded-2xl border bg-white/70 backdrop-blur-md p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold text-amber-700">{titulo}</h3>
      </div>
      {itens.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Sem dados</div>
      ) : (
        <div className="space-y-2.5">
          {itens.map((it, idx) => {
            const pct = (it.media / 5) * 100;
            const top3 = idx < 3;
            return (
              <div key={it.restaurante} className="space-y-1">
                <div className="flex items-center justify-between text-sm gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("text-xs font-mono w-5 text-right", top3 ? "text-amber-600 font-bold" : "text-muted-foreground")}>{idx + 1}º</span>
                    <span className={cn("truncate", top3 && "font-semibold")}>{it.restaurante}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">({it.totalAvaliacoes})</span>
                    <span className="font-mono tabular-nums text-amber-700 font-semibold w-12 text-right">{it.media.toFixed(2)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-amber-100/60 overflow-hidden">
                  <div className={cn("h-full bg-gradient-to-r", top3 ? "from-amber-400 to-orange-500" : "from-amber-200 to-amber-400")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NpsAtendimentoDashboard() {
  return (
    <IndicadorDashboardShell<NpsData>
      metaKey="nps"
      subtitle="Notas médias ponderadas — Atendimento (Google + TripAdvisor) × Delivery (iFood)"
      render={(d) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NpsList titulo="Atendimento" Icon={Store} itens={d.atendimento} />
          <NpsList titulo="Delivery" Icon={Truck} itens={d.delivery} />
        </div>
      )}
    />
  );
}
