import { motion } from "framer-motion";
import { GlassPanel } from "./GlassPanel";
import { ArrowRight } from "lucide-react";

const springEase = [0.16, 1, 0.3, 1] as const;

export function HeroCard() {
  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.9, ease: springEase, delay: 0.3 }}
      className="relative"
    >
      <GlassPanel
        className="group w-[600px] max-w-[90vw] cursor-pointer p-10 transition-all duration-200 hover:scale-[1.015]"
        style={{
          minHeight: 340,
          boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)",
        }}
      >
        {/* Shimmer */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ borderRadius: 24 }}
        >
          <div
            className="absolute -left-full top-0 h-full w-1/2 skew-x-[-20deg]"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
              animation: "shimmerSweep 4s ease-in-out infinite",
            }}
          />
        </div>

        <div className="relative z-10 flex h-full min-h-[260px] flex-col justify-between">
          <div>
            <p
              className="mb-2 text-sm font-medium uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.5)", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
            >
              Apple Design System
            </p>
            <h1
              className="font-display text-5xl font-bold leading-tight"
              style={{ color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
            >
              Liquid
              <br />
              Interface
            </h1>
            <p
              className="mt-4 max-w-sm text-base leading-relaxed"
              style={{ color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
            >
              A glass morphism design language that breathes with light, motion, and depth.
            </p>
          </div>

          <div className="mt-8">
            <button
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110"
              style={{
                backdropFilter: "blur(20px)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)",
                textShadow: "0 1px 2px rgba(0,0,0,0.3)",
              }}
            >
              Explore <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <style>{`
          @keyframes shimmerSweep {
            0%, 70% { left: -50%; }
            100% { left: 150%; }
          }
          .group:hover {
            box-shadow: 0 16px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35) !important;
          }
        `}</style>
      </GlassPanel>
    </motion.div>
  );
}
