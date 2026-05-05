import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import type { SupervisoresRanking } from "@/lib/indicadores-parsers";
import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";

function RankingCard({ titulo, periodo, itens }: { titulo: string; periodo: string; itens: { posicao: number; unidade: string; media: number }[] }) {
  const max = Math.max(...itens.map((i) => i.media), 1);
  return (
    <div className="rounded-2xl border bg-white/70 backdrop-blur-md p-4 shadow-sm">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-amber-700">{titulo}</h3>
        {periodo && <span className="text-xs text-muted-foreground">{periodo}</span>}
      </div>
      {itens.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Sem dados</div>
      ) : (
        <div className="space-y-2">
          {itens.map((it) => {
            const podio = it.posicao <= 3;
            const Icon = it.posicao === 1 ? Trophy : it.posicao === 2 ? Medal : Award;
            const pct = (it.media / max) * 100;
            return (
              <div key={`${it.posicao}-${it.unidade}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {podio ? (
                      <Icon className={cn("h-4 w-4 flex-shrink-0", it.posicao === 1 && "text-amber-500", it.posicao === 2 && "text-slate-400", it.posicao === 3 && "text-orange-700")} />
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground w-4 text-right">{it.posicao}º</span>
                    )}
                    <span className={cn("truncate", podio && "font-semibold")}>{it.unidade}</span>
                  </div>
                  <span className="font-mono tabular-nums text-amber-700 font-semibold">{it.media.toFixed(2)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-amber-100/60 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full bg-gradient-to-r", podio ? "from-amber-400 to-orange-500" : "from-amber-200 to-amber-400")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SupervisoresRankingDashboard() {
  return (
    <IndicadorDashboardShell<SupervisoresRanking>
      metaKey="ranking-supervisores"
      subtitle="Ranking de checklist por unidade e por gerência"
      render={(d) => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RankingCard titulo="Geral" periodo={d.geral.periodo} itens={d.geral.itens} />
          <RankingCard titulo="Gerentes Back" periodo={d.gerenteBack.periodo} itens={d.gerenteBack.itens} />
          <RankingCard titulo="Gerentes Front" periodo={d.gerenteFront.periodo} itens={d.gerenteFront.itens} />
        </div>
      )}
    />
  );
}
