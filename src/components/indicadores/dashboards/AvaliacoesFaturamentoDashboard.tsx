import { useState, useMemo } from "react";
import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import { MetricCard, SectionHeader, KpiBlock, CountUp, TIER } from "../shared";
import type { AvalFatData, AvalFatRow } from "@/lib/indicadores-parsers";
import { cn } from "@/lib/utils";
import { Store, Truck } from "lucide-react";

const fmtBRL0 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pctNorm = (p: number) => (p < 1 ? p * 100 : p);

function PctBadge({ p }: { p: number }) {
  const n = pctNorm(p);
  const color = TIER.pctNeg(p);
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold tabular-nums"
      style={{ background: `${color}1f`, color }}
    >
      {n.toFixed(1)}%
    </span>
  );
}

function Tabela({ rows }: { rows: AvalFatRow[] }) {
  if (rows.length === 0) {
    return <div className="text-xs text-white/40 py-10 text-center">Sem dados</div>;
  }
  const totals = rows.reduce(
    (acc, r) => {
      acc.aval13 += r.aval13;
      acc.totalAval += r.totalAval;
      acc.fatTotal += r.fatTotal;
      return acc;
    },
    { aval13: 0, totalAval: 0, fatTotal: 0 },
  );
  const pctTotal = totals.totalAval > 0 ? (totals.aval13 / totals.totalAval) * 100 : 0;
  const rsTotal = totals.aval13 > 0 ? totals.fatTotal / totals.aval13 : 0;

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-widest text-white/40 border-b border-white/10">
          <tr>
            <th className="text-left py-2 px-2 font-medium">Loja</th>
            <th className="text-right py-2 px-2 font-medium">Aval 1-3</th>
            <th className="text-right py-2 px-2 font-medium">Total</th>
            <th className="text-right py-2 px-2 font-medium">%</th>
            <th className="text-right py-2 px-2 font-medium">Faturamento</th>
            <th className="text-right py-2 px-2 font-medium">R$/Aval</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.loja} className="border-b border-white/5 hover:bg-white/[0.04] transition">
              <td className="py-2 px-2 font-medium text-white/90 truncate max-w-[200px]">{r.loja}</td>
              <td className="py-2 px-2 text-right tabular-nums text-white/80">{r.aval13}</td>
              <td className="py-2 px-2 text-right tabular-nums text-white/60">{r.totalAval}</td>
              <td className="py-2 px-2 text-right"><PctBadge p={r.pct} /></td>
              <td className="py-2 px-2 text-right tabular-nums text-white/70">{fmtBRL0(r.fatTotal)}</td>
              <td
                className="py-2 px-2 text-right tabular-nums font-semibold"
                style={{ color: TIER.rsAval(r.rsPorAval) }}
              >
                {fmtBRL0(r.rsPorAval)}
              </td>
            </tr>
          ))}
          <tr className="bg-white/[0.06] border-t-2 border-white/20 font-semibold">
            <td className="py-2 px-2 text-white">Total</td>
            <td className="py-2 px-2 text-right tabular-nums text-white">{totals.aval13}</td>
            <td className="py-2 px-2 text-right tabular-nums text-white">{totals.totalAval}</td>
            <td className="py-2 px-2 text-right"><PctBadge p={pctTotal} /></td>
            <td className="py-2 px-2 text-right tabular-nums text-white">{fmtBRL0(totals.fatTotal)}</td>
            <td
              className="py-2 px-2 text-right tabular-nums"
              style={{ color: TIER.rsAval(rsTotal) }}
            >
              {fmtBRL0(rsTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Inner({ d }: { d: AvalFatData }) {
  const [tab, setTab] = useState<"salao" | "delivery">("salao");
  const cur = tab === "salao" ? d.salao : d.delivery;
  const k = useMemo(() => {
    const tot = cur.reduce((a, r) => a + r.aval13, 0);
    const totalAval = cur.reduce((a, r) => a + r.totalAval, 0);
    const pct = totalAval > 0 ? (tot / totalAval) * 100 : 0;
    const ofensor = [...cur].sort((a, b) => pctNorm(b.pct) - pctNorm(a.pct))[0];
    return { tot, pct, ofensor };
  }, [cur]);
  return (
          <div className="space-y-4">
            {d.periodo && (
              <div className="text-xs text-white/50">
                Período: <strong className="text-white/80">{d.periodo}</strong>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiBlock
                index={0}
                label="Avaliações 1-3"
                value={<CountUp value={k.tot} />}
                hint="Total na rede (modo ativo)"
                color="#EF4444"
              />
              <KpiBlock
                index={1}
                label="% Médio"
                value={<CountUp value={k.pct} decimals={1} suffix="%" />}
                color={TIER.pctNeg(k.pct)}
              />
              <KpiBlock
                index={2}
                label="Maior ofensor"
                value={<span className="text-xl">{k.ofensor?.loja ?? "—"}</span>}
                hint={k.ofensor ? `${pctNorm(k.ofensor.pct).toFixed(1)}%` : ""}
                color="#F59E0B"
              />
            </div>

            <MetricCard>
              <SectionHeader
                title="Detalhe por loja"
                right={
                  <div className="flex gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
                    {[
                      { id: "salao" as const, label: "Salão", Icon: Store },
                      { id: "delivery" as const, label: "Delivery", Icon: Truck },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition",
                          tab === t.id ? "bg-amber-500 text-black" : "text-white/60 hover:text-white",
                        )}
                      >
                        <t.Icon className="h-3.5 w-3.5" /> {t.label}
                      </button>
                    ))}
                  </div>
                }
              />
              <Tabela rows={cur} />
            </MetricCard>
          </div>
  );
}

export function AvaliacoesFaturamentoDashboard() {
  return (
    <IndicadorDashboardShell<AvalFatData>
      metaKey="atendimento-medias"
      subtitle="Avaliações 1-3 vs faturamento por loja"
      render={(d) => <Inner d={d} />}
    />
  );
}

