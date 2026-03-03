import { useState } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, Layers, Settings, Sparkles } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

const springEase = [0.16, 1, 0.3, 1] as const;

const items = [
  { icon: LayoutDashboard, label: "Dashboard", color: "#60a5fa" },
  { icon: Layers, label: "Components", color: "#a78bfa" },
  { icon: Sparkles, label: "Effects", color: "#f472b6" },
  { icon: Settings, label: "Settings", color: "#34d399" },
];

export function SidebarPanel() {
  const [selected, setSelected] = useState("Dashboard");

  return (
    <motion.div
      className="fixed left-6 top-1/2 z-40 -translate-y-1/2"
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: springEase, delay: 0.5 }}
    >
      <GlassPanel intensity="light" className="flex flex-col gap-1 p-3" style={{ borderRadius: 20, width: 180 }}>
        {items.map((item, i) => (
          <motion.button
            key={item.label}
            onClick={() => setSelected(item.label)}
            className="relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-200"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: springEase, delay: 0.6 + i * 0.1 }}
          >
            {selected === item.label && (
              <motion.div
                layoutId="sidebarPill"
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  boxShadow: "inset 0 0 10px rgba(255,255,255,0.1)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <item.icon
              size={18}
              style={{
                color: selected === item.label ? item.color : "rgba(255,255,255,0.5)",
                filter: selected === item.label ? `drop-shadow(0 0 6px ${item.color}60)` : "none",
                position: "relative",
                zIndex: 10,
              }}
            />
            <span
              className="relative z-10 text-sm font-medium"
              style={{
                color: selected === item.label ? "#fff" : "rgba(255,255,255,0.55)",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
            >
              {item.label}
            </span>
          </motion.button>
        ))}
      </GlassPanel>
    </motion.div>
  );
}
