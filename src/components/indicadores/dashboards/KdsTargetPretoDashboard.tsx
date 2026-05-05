import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from "recharts";
import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import { MetricCard, SectionHeader, TIER, tooltipStyle, axisTick } from "../shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { KdsData, KdsLoja } from "@/lib/indicadores-parsers";
import { cn } from "@/lib/utils";

const pctN = (p: number) => (p < 1 ? p * 100 : p);

function LojaItem({ loja, idx }: { loja: KdsLoja; idx: number }) {
  const tg = loja.totalGeral;
  const color = TIER.kds(tg.pct);
  return (
    <AccordionItem
      value={loja.loja}
      className="border border-white/10 rounded-xl bg-white/[0.03] mb-2 overflow-hidden"
    >
      <AccordionTrigger className="px-4 hover:no-underline hover:bg-white/[0.04]">
        <div className="flex items-center justify-between w-full pr-3 gap-3">
          <span className="font-semibold text-white/90 truncate">{loja.loja}</span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-white/40 tabular-nums">
              {tg.qtnTarget}/{tg.totalPratos}
            </span>
            <span
              className="text-sm font-mono tabular-nums font-bold w-16 text-right px-2 py-0.5 rounded-full"
              style={{ background: `${color}1f`, color }}
            >
              {pctN(tg.pct).toFixed(1)}%
            </span>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-3">
        <div className="space-y-2 pt-2">
          {loja.categorias.map((c) => {
            const p = pctN(c.pct);
            return (
              <div key={c.categoria} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span className="truncate">{c.categoria}</span>
                  <span className="tabular-nums font-mono">
                    {c.qtnTarget}/{c.totalPratos} · {p.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(p * 4, 100)}%` }}
                    transition={{ duration: 0.6, delay: 0.05 * idx }}
                    className="h-full rounded-full"
                    style={{ background: TIER.kds(c.pct) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function KdsTargetPretoDashboard() {
  return (
    <IndicadorDashboardShell<KdsData>
      metaKey="kds-target-preto"
      subtitle="% pratos em Target Preto — meta ≤8%, crítico ≥15%"
      render={(d) => {
        const sorted = [...d.lojas].sort((a, b) => pctN(b.totalGeral.pct) - pctN(a.totalGeral.pct));
        const chartData = sorted.map((l) => ({ loja: l.loja, pct: pctN(l.totalGeral.pct) }));
        return (
          <div className="space-y-4">
            {d.dataAtualizacao && (
              <div className="text-xs text-white/50">
                Atualização: <strong className="text-white/80">{d.dataAtualizacao}</strong>
              </div>
            )}

            <MetricCard>
              <SectionHeader title="Visão por loja" subtitle="% Target Preto vs metas" />
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                    <XAxis
                      dataKey="loja"
                      stroke="rgba(255,255,255,0.15)"
                      tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      height={70}
                      interval={0}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.15)"
                      tick={axisTick}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "rgba(245,158,11,0.05)" }}
                      formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Target Preto"]}
                    />
                    <ReferenceLine
                      y={8}
                      stroke="#FBBF24"
                      strokeDasharray="4 4"
                      label={{ value: "Meta 8%", fill: "#FBBF24", fontSize: 11, position: "right" }}
                    />
                    <ReferenceLine
                      y={15}
                      stroke="#EF4444"
                      strokeDasharray="4 4"
                      label={{ value: "Crítico 15%", fill: "#EF4444", fontSize: 11, position: "right" }}
                    />
                    <Bar dataKey="pct" radius={[6, 6, 0, 0]} animationDuration={800}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={TIER.kds(d.pct)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </MetricCard>

            <MetricCard>
              <SectionHeader title="Detalhe por categoria" subtitle="Ordenado por % decrescente" />
              <Accordion type="multiple" className="space-y-2">
                {sorted.map((l, i) => <LojaItem key={l.loja} loja={l} idx={i} />)}
              </Accordion>
            </MetricCard>
          </div>
        );
      }}
    />
  );
}
