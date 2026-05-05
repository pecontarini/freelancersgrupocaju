import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Medal, Award } from "lucide-react";
import { IndicadorDashboardShell } from "../IndicadorDashboardShell";
import { MetricCard, SectionHeader, TIER } from "../shared";
import type { SupervisoresRanking } from "@/lib/indicadores-parsers";
import { cn } from "@/lib/utils";

type Item = { posicao: number; unidade: string; media: number };

function Podium({ itens }: { itens: Item[] }) {
  const top3 = itens.slice(0, 3);
  if (top3.length === 0) return null;
  const ordered = [top3[1], top3[0], top3[2]].filter(Boolean);
  return (
    <div className="grid grid-cols-3 gap-2 mb-4 items-end">
      {ordered.map((it) => {
        const isFirst = it.posicao === 1;
        const Icon = it.posicao === 1 ? Crown : it.posicao === 2 ? Medal : Award;
        return (
          <motion.div
            key={it.unidade}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: it.posicao * 0.08 }}
            className={cn(
              "rounded-xl p-3 text-center border",
              isFirst
                ? "bg-amber-500 border-amber-400 text-black scale-105 shadow-[0_8px_24px_rgba(245,158,11,0.4)]"
                : "bg-white/[0.04] border-white/10 text-white",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 mx-auto mb-1",
                isFirst ? "text-black" : it.posicao === 2 ? "text-slate-300" : "text-orange-400",
              )}
            />
            <div className={cn("text-xs font-bold truncate", isFirst ? "text-black/80" : "text-white/70")}>
              {it.unidade}
            </div>
            <div className={cn("text-lg font-bold tabular-nums", isFirst ? "text-black" : "text-amber-400")}>
              {(it.media * (it.media < 1 ? 100 : 1)).toFixed(1)}%
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ListaPosicoes({ itens }: { itens: Item[] }) {
  const rest = itens.slice(3);
  const lastPos = itens.length;
  return (
    <div className="space-y-1.5">
      {rest.map((it, idx) => {
        const pct = it.media * (it.media < 1 ? 100 : 1);
        const color = TIER.perf(it.media);
        const isLast = it.posicao === lastPos;
        return (
          <motion.div
            key={it.unidade}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg border",
              isLast
                ? "bg-red-500/5 border-red-500/30"
                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]",
            )}
          >
            <span className="text-xs font-mono text-white/40 w-6 text-right">{it.posicao}º</span>
            <span className="text-sm text-white/90 w-20 truncate">{it.unidade}</span>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pct, 100)}%` }}
                transition={{ duration: 0.7, delay: idx * 0.03, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums w-14 text-right" style={{ color }}>
              {pct.toFixed(1)}%
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

function Coluna({ titulo, periodo, itens }: { titulo: string; periodo: string; itens: Item[] }) {
  return (
    <MetricCard className="!p-5">
      <SectionHeader title={titulo} badge={periodo || undefined} />
      {itens.length === 0 ? (
        <div className="text-xs text-white/40 py-8 text-center">Sem dados</div>
      ) : (
        <>
          <Podium itens={itens} />
          <ListaPosicoes itens={itens} />
        </>
      )}
    </MetricCard>
  );
}

export function SupervisoresRankingDashboard() {
  const [tab, setTab] = useState<"geral" | "gerenteBack" | "gerenteFront">("geral");
  return (
    <IndicadorDashboardShell<SupervisoresRanking>
      metaKey="ranking-supervisores"
      subtitle="Ranking de checklist por unidade e gerência"
      render={(d) => {
        const tabs: { id: typeof tab; label: string; data: typeof d.geral }[] = [
          { id: "geral", label: "Geral", data: d.geral },
          { id: "gerenteBack", label: "Gerente Back", data: d.gerenteBack },
          { id: "gerenteFront", label: "Gerente Front", data: d.gerenteFront },
        ];
        return (
          <>
            {/* Mobile tabs */}
            <div className="md:hidden mb-4">
              <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition",
                      tab === t.id ? "bg-amber-500 text-black" : "text-white/60",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Coluna
                      titulo={tabs.find((t) => t.id === tab)!.label}
                      periodo={tabs.find((t) => t.id === tab)!.data.periodo}
                      itens={tabs.find((t) => t.id === tab)!.data.itens}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            {/* Desktop 3-col */}
            <div className="hidden md:grid grid-cols-3 gap-4">
              {tabs.map((t) => (
                <Coluna key={t.id} titulo={t.label} periodo={t.data.periodo} itens={t.data.itens} />
              ))}
            </div>
          </>
        );
      }}
    />
  );
}
