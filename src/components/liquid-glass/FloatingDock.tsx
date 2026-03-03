import { useState } from "react";
import { motion } from "framer-motion";
import { Home, Compass, Zap, Heart, Music } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

const springEase = [0.16, 1, 0.3, 1] as const;

const dockItems = [
  { icon: Home, color: "#60a5fa" },
  { icon: Compass, color: "#a78bfa" },
  { icon: Zap, color: "#facc15" },
  { icon: Heart, color: "#f472b6" },
  { icon: Music, color: "#34d399" },
];

export function FloatingDock() {
  const [hovered, setHovered] = useState<number | null>(null);

  const getScale = (index: number) => {
    if (hovered === null) return 1;
    const dist = Math.abs(hovered - index);
    if (dist === 0) return 1.35;
    if (dist === 1) return 1.15;
    return 1;
  };

  return (
    <motion.div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: springEase, delay: 0.8 }}
    >
      <GlassPanel className="flex items-end gap-2 px-4 py-3" style={{ borderRadius: 28 }}>
        {dockItems.map((item, i) => (
          <motion.button
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            animate={{ scale: getScale(i), y: hovered === i ? -8 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex items-center justify-center rounded-2xl p-3 transition-colors duration-200"
            style={{
              background: hovered === i ? "rgba(255,255,255,0.12)" : "transparent",
            }}
          >
            <item.icon
              size={22}
              style={{
                color: item.color,
                filter: `drop-shadow(0 0 ${hovered === i ? 10 : 4}px ${item.color}60)`,
                transition: "filter 200ms ease-out",
              }}
            />
          </motion.button>
        ))}
      </GlassPanel>
    </motion.div>
  );
}
