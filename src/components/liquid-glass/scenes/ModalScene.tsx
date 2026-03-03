import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, AlertCircle } from "lucide-react";
import { GlassPanel } from "../GlassPanel";

export function ModalScene() {
  const [open, setOpen] = useState(false);

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
          Modal Glass
        </h2>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Clique no botão para ver o dialog</p>
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="rounded-2xl px-8 py-3.5 font-display text-sm font-semibold"
        style={{
          background: "linear-gradient(135deg, rgba(244,114,182,0.5), rgba(139,92,246,0.5))",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 4px 24px rgba(244,114,182,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}
      >
        Abrir Modal
      </motion.button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Dialog */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-[440px] max-w-[90vw]"
            >
              <GlassPanel className="p-6" intensity="strong">
                {/* Close */}
                <button
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-4 rounded-full p-1.5 transition-colors hover:bg-white/10"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <X size={16} />
                </button>

                {/* Icon */}
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(248,113,113,0.15)", boxShadow: "0 0 20px rgba(248,113,113,0.2)" }}
                >
                  <AlertCircle size={22} style={{ color: "#f87171", filter: "drop-shadow(0 0 6px rgba(248,113,113,0.5))" }} />
                </div>

                <h3 className="text-center font-display text-lg font-bold" style={{ color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
                  Confirmar exclusão?
                </h3>
                <p className="mt-2 text-center text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Esta ação não pode ser desfeita. Todos os dados associados serão permanentemente removidos.
                </p>

                <div className="mt-6 flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setOpen(false)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
                    style={{
                      background: "linear-gradient(135deg, rgba(248,113,113,0.5), rgba(239,68,68,0.5))",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.15)",
                      boxShadow: "0 4px 16px rgba(239,68,68,0.3)",
                      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    }}
                  >
                    <Trash2 size={14} /> Excluir
                  </motion.button>
                </div>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
