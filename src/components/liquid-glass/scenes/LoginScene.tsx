import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { GlassPanel } from "../GlassPanel";

export function LoginScene() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-center min-h-[70vh]"
    >
      <GlassPanel className="w-[420px] max-w-[90vw] p-8" intensity="medium">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.4), rgba(96,165,250,0.4))",
              boxShadow: "0 4px 20px rgba(139,92,246,0.3)",
            }}
          >
            <Lock size={24} style={{ color: "#fff", filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))" }} />
          </div>
          <h2 className="font-display text-2xl font-bold" style={{ color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
            Bem-vindo de volta
          </h2>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Acesse o portal da liderança
          </p>
        </div>

        <div className="space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.4)" }} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl py-3 pl-10 pr-4 text-sm font-medium outline-none placeholder:text-white/30"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                backdropFilter: "blur(8px)",
              }}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.4)" }} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl py-3 pl-10 pr-10 text-sm font-medium outline-none placeholder:text-white/30"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                backdropFilter: "blur(8px)",
              }}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(96,165,250,0.6))",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "0 4px 20px rgba(139,92,246,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            Entrar
          </motion.button>

          <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Esqueceu a senha? <span style={{ color: "rgba(139,92,246,0.8)", cursor: "pointer" }}>Recuperar</span>
          </p>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
