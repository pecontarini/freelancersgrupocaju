import { motion } from "framer-motion";
import { LogIn, LayoutDashboard, Bell, Layers, Smartphone } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

const scenes = [
  { id: "login", icon: LogIn, label: "Login", color: "#a78bfa" },
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", color: "#60a5fa" },
  { id: "notifications", icon: Bell, label: "Feed", color: "#facc15" },
  { id: "modal", icon: Layers, label: "Modal", color: "#f472b6" },
  { id: "bottomsheet", icon: Smartphone, label: "Sheet", color: "#34d399" },
] as const;

export type SceneId = (typeof scenes)[number]["id"];

interface SceneNavigatorProps {
  active: SceneId;
  onChange: (id: SceneId) => void;
}

export function SceneNavigator({ active, onChange }: SceneNavigatorProps) {
  return (
    <motion.div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
    >
      <GlassPanel className="flex items-center gap-1 px-3 py-2.5" style={{ borderRadius: 28 }}>
        {scenes.map((s) => {
          const isActive = active === s.id;
          return (
            <motion.button
              key={s.id}
              onClick={() => onChange(s.id)}
              className="relative flex flex-col items-center gap-0.5 rounded-2xl px-3.5 py-2 transition-colors duration-200"
              whileTap={{ scale: 0.92 }}
            >
              {isActive && (
                <motion.div
                  layoutId="scenePill"
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.1)", boxShadow: "inset 0 0 12px rgba(255,255,255,0.12)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <s.icon
                size={18}
                style={{
                  color: isActive ? s.color : "rgba(255,255,255,0.4)",
                  filter: isActive ? `drop-shadow(0 0 6px ${s.color}60)` : "none",
                  position: "relative",
                  zIndex: 10,
                  transition: "all 200ms",
                }}
              />
              <span
                className="relative z-10 text-[10px] font-semibold"
                style={{
                  color: isActive ? "#fff" : "rgba(255,255,255,0.35)",
                  textShadow: isActive ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                  transition: "all 200ms",
                }}
              >
                {s.label}
              </span>
            </motion.button>
          );
        })}
      </GlassPanel>
    </motion.div>
  );
}
