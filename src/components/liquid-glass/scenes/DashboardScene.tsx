import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ShoppingCart, ChefHat, ClipboardCheck, Users } from "lucide-react";
import { GlassPanel } from "../GlassPanel";

const kpis = [
  { label: "Vendas", value: "R$ 48.2k", change: "+12.5%", up: true, icon: ShoppingCart, color: "#60a5fa", sparkline: [30, 45, 35, 55, 50, 65, 60] },
  { label: "CMV", value: "32.4%", change: "-2.1%", up: false, icon: ChefHat, color: "#34d399", sparkline: [40, 38, 42, 36, 34, 35, 32] },
  { label: "Auditoria", value: "94.7%", change: "+3.8%", up: true, icon: ClipboardCheck, color: "#a78bfa", sparkline: [80, 85, 82, 90, 88, 93, 95] },
  { label: "Equipe", value: "96%", change: "+1.2%", up: true, icon: Users, color: "#f472b6", sparkline: [90, 92, 91, 94, 93, 95, 96] },
];

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 28;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");

  return (
    <svg width={w} height={h} className="mt-2">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} style={{ filter: `drop-shadow(0 0 4px ${color}60)` }} />
    </svg>
  );
}

export function DashboardScene() {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-center min-h-[70vh] px-4"
    >
      <div className="grid grid-cols-2 gap-4 w-[560px] max-w-[90vw]">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassPanel
              className="p-5 cursor-pointer transition-all duration-200 hover:scale-[1.03] hover:-translate-y-1"
              intensity="light"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${kpi.color}20`, boxShadow: `0 0 12px ${kpi.color}30` }}
                >
                  <kpi.icon size={18} style={{ color: kpi.color, filter: `drop-shadow(0 0 4px ${kpi.color}60)` }} />
                </div>
                <div className="flex items-center gap-1" style={{ color: kpi.up ? "#34d399" : "#f87171" }}>
                  {kpi.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span className="text-xs font-semibold">{kpi.change}</span>
                </div>
              </div>
              <p className="mt-3 font-display text-2xl font-bold" style={{ color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
                {kpi.value}
              </p>
              <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>{kpi.label}</p>
              <MiniSparkline data={kpi.sparkline} color={kpi.color} />
            </GlassPanel>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
