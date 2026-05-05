import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import type { AvalFatData, AvalFatRow } from "@/lib/indicadores-parsers";
import { cn } from "@/lib/utils";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${(v * (v < 1 ? 100 : 1)).toFixed(1)}%`;

function pctColor(p: number) {
  const norm = p < 1 ? p * 100 : p;
  if (norm < 5) return "text-emerald-600";
  if (norm < 10) return "text-amber-600";
  return "text-red-600";
}

function Tabela({ titulo, rows }: { titulo: string; rows: AvalFatRow[] }) {
  return (
    <div className="rounded-2xl border bg-white/70 backdrop-blur-md p-4 shadow-sm">
      <h3 className="font-semibold text-amber-700 mb-3">{titulo}</h3>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Sem dados</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="text-left py-1.5 font-medium">Loja</th>
                <th className="text-right py-1.5 font-medium">Aval 1-3</th>
                <th className="text-right py-1.5 font-medium">Total</th>
                <th className="text-right py-1.5 font-medium">%</th>
                <th className="text-right py-1.5 font-medium">Faturamento</th>
                <th className="text-right py-1.5 font-medium">R$/Aval</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.loja} className="border-b border-border/40">
                  <td className="py-1.5 font-medium truncate max-w-[180px]">{r.loja}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.aval13}</td>
                  <td className="py-1.5 text-right tabular-nums">{r.totalAval}</td>
                  <td className={cn("py-1.5 text-right tabular-nums font-semibold", pctColor(r.pct))}>{fmtPct(r.pct)}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtBRL(r.fatTotal)}</td>
                  <td className="py-1.5 text-right tabular-nums text-amber-700">{fmtBRL(r.rsPorAval)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AvaliacoesFaturamentoDashboard() {
  return (
    <IndicadorDashboardShell<AvalFatData>
      metaKey="atendimento-medias"
      subtitle="Avaliações 1-3 vs faturamento por loja"
      render={(d) => (
        <div className="space-y-4">
          {d.periodo && (
            <div className="text-xs text-muted-foreground">Período da planilha: <strong>{d.periodo}</strong></div>
          )}
          <Tabela titulo="Salão" rows={d.salao} />
          <Tabela titulo="Delivery" rows={d.delivery} />
        </div>
      )}
    />
  );
}
