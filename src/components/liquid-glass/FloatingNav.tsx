import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Bell, User } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

const springEase = [0.16, 1, 0.3, 1] as const;
const links = ["Home", "Products", "About", "Contact"];

export function FloatingNav() {
  const [active, setActive] = useState("Home");

  return (
    <motion.div
      className="fixed top-6 left-1/2 z-50 -translate-x-1/2"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: springEase }}
    >
      <GlassPanel className="flex items-center gap-6 px-6 py-3" style={{ borderRadius: 50 }}>
        {/* Logo */}
        <span className="font-display text-lg font-bold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
          ◆ Liquid
        </span>

        {/* Links */}
        <nav className="flex gap-1">
          {links.map((l) => (
            <button
              key={l}
              onClick={() => setActive(l)}
              className="relative rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200"
              style={{
                color: active === l ? "#fff" : "rgba(255,255,255,0.65)",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
            >
              {active === l && (
                <motion.div
                  layoutId="navPill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: "rgba(255,255,255,0.12)", boxShadow: "inset 0 0 12px rgba(255,255,255,0.15)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{l}</span>
            </button>
          ))}
        </nav>

        {/* Icons */}
        <div className="flex items-center gap-3 ml-2">
          {[Search, Bell, User].map((Icon, i) => (
            <button
              key={i}
              className="rounded-full p-2 text-white/70 transition-all duration-200 hover:text-white hover:bg-white/10"
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </GlassPanel>
    </motion.div>
  );
}
