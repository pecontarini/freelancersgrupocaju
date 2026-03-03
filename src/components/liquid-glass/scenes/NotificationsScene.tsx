import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle, Info, Bell, ChevronDown } from "lucide-react";
import { GlassPanel } from "../GlassPanel";

const notifications = [
  { id: 1, icon: AlertTriangle, color: "#facc15", title: "CMV acima da meta", time: "há 5 min", detail: "O CMV da unidade Centro atingiu 38.2%, ultrapassando a meta de 35%. Verificar compras recentes e desperdício.", read: false },
  { id: 2, icon: CheckCircle, color: "#34d399", title: "Auditoria aprovada", time: "há 23 min", detail: "A auditoria semanal da unidade Sul foi concluída com score de 96.3%. Parabéns à equipe!", read: false },
  { id: 3, icon: Info, color: "#60a5fa", title: "Escala atualizada", time: "há 1h", detail: "3 colaboradores confirmaram presença para o turno de amanhã. 1 pendente de confirmação.", read: true },
  { id: 4, icon: Bell, color: "#a78bfa", title: "Plano de ação vencendo", time: "há 2h", detail: "O plano de ação #PA-042 sobre higienização do setor cozinha vence em 24h. Ação necessária.", read: true },
];

export function NotificationsScene() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-center min-h-[70vh] px-4"
    >
      <div className="w-[480px] max-w-[90vw]">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold" style={{ color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
            Notificações
          </h2>
          <GlassPanel className="flex items-center gap-1.5 px-3 py-1.5" style={{ borderRadius: 50 }} intensity="strong">
            <Bell size={13} style={{ color: "#f472b6" }} />
            <span className="text-xs font-bold" style={{ color: "#fff" }}>
              {notifications.filter((n) => !n.read).length}
            </span>
          </GlassPanel>
        </div>

        <div className="space-y-3">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <GlassPanel
                className="cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                intensity={n.read ? "light" : "medium"}
                style={{ borderRadius: 18 }}
              >
                <button
                  className="flex w-full items-center gap-3 p-4 text-left"
                  onClick={() => setExpanded(expanded === n.id ? null : n.id)}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${n.color}18`, boxShadow: `0 0 10px ${n.color}20` }}
                  >
                    <n.icon size={16} style={{ color: n.color, filter: `drop-shadow(0 0 4px ${n.color}60)` }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                      {n.title}
                    </p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{n.time}</p>
                  </div>
                  {!n.read && (
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.color, boxShadow: `0 0 8px ${n.color}` }} />
                  )}
                  <motion.div animate={{ rotate: expanded === n.id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {expanded === n.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0">
                        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{n.detail}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
