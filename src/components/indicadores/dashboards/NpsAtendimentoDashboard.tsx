import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Store, Truck } from "lucide-react";
import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import { MetricCard, SectionHeader, KpiBlock, CountUp, TIER, tooltipStyle, axisTick } from "../shared";
import type { NpsData } from "@/lib/indicadores-parsers";
import { cn } from "@/lib/utils";

function ChartPanel({ data, label }: { data: NpsData["atendimento"]; label: string }) {
  if (data.length === 0) {
    return <div className="text-xs text-white/40 py-10 text-center">Sem dados</div>;
  }
  const height = Math.max(220, data.length * 32);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart layout="vertical" data={data} margin={{ left: 10, right: 50, top: 8, bottom: 8 }}>
          <XAxis type="number" domain={[4, 5]} tickCount={6} stroke="rgba(255,255,255,0.15)" tick={axisTick} />
          <YAxis
            type="category"
            dataKey="restaurante"
            width={130}
            stroke="rgba(255,255,255,0.15)"
            tick={{ fill: "rgba(255,255,255,0.8)", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgba(245,158,11,0.05)" }}
            formatter={(v: any, _n, p: any) => [
              `${Number(v).toFixed(3)} (${p.payload.totalAvaliacoes} aval.)`,
              label,
            ]}
          />
          <Bar
            dataKey="media"
            radius={[0, 6, 6, 0]}
            animationDuration={800}
            animationBegin={200}
            label={{
              position: "right",
              fill: "white",
              fontSize: 11,
              formatter: (v: number) => v.toFixed(2),
            }}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={TIER.nps(d.media)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function avgPonderada(arr: NpsData["atendimento"]) {
  let soma = 0, total = 0;
  for (const it of arr) { soma += it.media * it.totalAvaliacoes; total += it.totalAvaliacoes; }
  return { media: total > 0 ? soma / total : 0, total };
}

export function NpsAtendimentoDashboard() {
  const [active, setActive] = useState<"atendimento" | "delivery">("atendimento");

  return (
    <IndicadorDashboardShell<NpsData>
      metaKey="nps"
      subtitle="Notas médias ponderadas — Atendimento (Google + TripAdvisor) × Delivery (iFood)"
      render={(d) => {
        const at = avgPonderada(d.atendimento);
        const dl = avgPonderada(d.delivery);
        const cur = active === "atendimento" ? d.atendimento : d.delivery;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KpiBlock
                index={0}
                label="Atendimento — média rede"
                value={<CountUp value={at.media} decimals={3} />}
                hint={`${at.total.toLocaleString("pt-BR")} avaliações`}
                color={TIER.nps(at.media)}
              />
              <KpiBlock
                index={1}
                label="Delivery — média rede"
                value={<CountUp value={dl.media} decimals={3} />}
                hint={`${dl.total.toLocaleString("pt-BR")} avaliações`}
                color={TIER.nps(dl.media)}
              />
            </div>

            <MetricCard>
              <SectionHeader
                title="Ranking por unidade"
                subtitle="Faixas: ≥4.8 verde · ≥4.6 verde-claro · ≥4.4 amarelo · <4.4 vermelho"
                right={
                  <div className="flex gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10">
                    {[
                      { id: "atendimento" as const, label: "Atendimento", Icon: Store },
                      { id: "delivery" as const, label: "Delivery", Icon: Truck },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActive(t.id)}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition",
                          active === t.id ? "bg-amber-500 text-black" : "text-white/60 hover:text-white",
                        )}
                      >
                        <t.Icon className="h-3.5 w-3.5" /> {t.label}
                      </button>
                    ))}
                  </div>
                }
              />
              <ChartPanel data={cur} label={active === "atendimento" ? "Atendimento" : "Delivery"} />
            </MetricCard>
          </div>
        );
      }}
    />
  );
}
