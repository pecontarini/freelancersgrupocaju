import { useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Share, Bookmark, Flag, Copy, MessageSquare, MoreHorizontal } from "lucide-react";
import { GlassPanel } from "../GlassPanel";

const menuItems = [
  { icon: Share, label: "Compartilhar", color: "#60a5fa" },
  { icon: Bookmark, label: "Salvar nos favoritos", color: "#facc15" },
  { icon: Copy, label: "Copiar link", color: "#34d399" },
  { icon: MessageSquare, label: "Enviar feedback", color: "#a78bfa" },
  { icon: Flag, label: "Reportar problema", color: "#f87171" },
];

export function BottomSheetScene() {
  const [open, setOpen] = useState(false);
  const dragControls = useDragControls();

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4"
    >
      <div className="text-center mb-2">
        <h2 className="font-display text-2xl font-bold" style={{ color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
          Bottom Sheet
        </h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Estilo iOS — arraste para fechar</p>
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-2xl px-8 py-3.5 font-display text-sm font-semibold"
        style={{
          background: "linear-gradient(135deg, rgba(52,211,153,0.5), rgba(96,165,250,0.5))",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 4px 24px rgba(52,211,153,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        <MoreHorizontal size={16} /> Abrir Menu
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Sheet */}
            <motion.div
              className="relative z-10 w-full max-w-[480px]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              drag="y"
              dragControls={dragControls}
              dragConstraints={{ top: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setOpen(false);
              }}
            >
              <GlassPanel
                className="pb-8 pt-3"
                intensity="strong"
                style={{ borderRadius: "24px 24px 0 0" }}
              >
                {/* Handle */}
                <div className="flex justify-center mb-4">
                  <div
                    className="h-1 w-10 rounded-full cursor-grab active:cursor-grabbing"
                    style={{ background: "rgba(255,255,255,0.25)" }}
                    onPointerDown={(e) => dragControls.start(e)}
                  />
                </div>

                <div className="px-5 space-y-1">
                  {menuItems.map((item, i) => (
                    <motion.button
                      key={item.label}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      onClick={() => setOpen(false)}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 hover:bg-white/8"
                      style={{ color: "#fff" }}
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: `${item.color}15` }}
                      >
                        <item.icon size={17} style={{ color: item.color, filter: `drop-shadow(0 0 4px ${item.color}50)` }} />
                      </div>
                      <span className="text-sm font-medium" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                        {item.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
