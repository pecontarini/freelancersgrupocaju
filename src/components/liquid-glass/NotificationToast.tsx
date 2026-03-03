import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

const springEase = [0.16, 1, 0.3, 1] as const;

export function NotificationToast() {
  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: springEase, delay: 1.5 }}
    >
      <GlassPanel className="flex items-center gap-3 px-5 py-3.5" style={{ borderRadius: 50 }}>
        <CheckCircle size={20} style={{ color: "#34d399", filter: "drop-shadow(0 0 6px rgba(52,211,153,0.5))" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
            System Ready
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
            All components loaded successfully
          </p>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
