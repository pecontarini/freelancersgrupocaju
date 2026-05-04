import { motion } from "framer-motion";
import { Target, Sparkles } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { MetaCard, type MetaCardProps } from "@/components/metas/MetaCard";

// Mock — Supabase integration to be wired later.
const MOCK_METAS: MetaCardProps[] = [
  {
    titulo: "NPS Salão",
    tipo: "Experiência",
    valorAtual: 78,
    valorMeta: 80,
    percentual: 97,
    status: "bom",
    unidadeSufixo: "",
  },
  {
    titulo: "CMV Salmão",
    tipo: "Custo",
    valorAtual: 1.42,
    valorMeta: 1.2,
    percentual: 84,
    status: "regular",
    unidadeSufixo: "kg",
  },
  {
    titulo: "CMV Carnes",
    tipo: "Custo",
    valorAtual: 8.1,
    valorMeta: 5,
    percentual: 62,
    status: "redflag",
    redFlag: true,
    unidadeSufixo: "%",
  },
  {
    titulo: "Conformidade Auditoria",
    tipo: "Operação",
    valorAtual: 92,
    valorMeta: 90,
    percentual: 102,
    status: "excelente",
    unidadeSufixo: "%",
  },
  {
    titulo: "KDS · Tempo de Prato",
    tipo: "Cozinha",
    valorAtual: 71,
    valorMeta: 80,
    percentual: 89,
    status: "bom",
    unidadeSufixo: "%",
  },
  {
    titulo: "Reclamações Delivery",
    tipo: "Experiência",
    valorAtual: 12,
    valorMeta: 5,
    percentual: 41,
    status: "redflag",
    redFlag: true,
    unidadeSufixo: "",
  },
];

export default function MetasPage() {
  const { profile, roles, unidade, isLoading } = useUserProfile();
  const cargo = roles[0] ?? "employee";

  return (
    <div className="min-h-screen" style={{ background: "#0D0D0D" }}>
      {/* Aurora glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 40% at 20% 0%, rgba(245,158,11,0.12), transparent 60%), radial-gradient(50% 40% at 100% 10%, rgba(208,89,55,0.10), transparent 60%)",
        }}
      />

      <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card mb-8 flex flex-wrap items-center justify-between gap-4 p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(245,158,11,0.10), rgba(255,255,255,0.02))",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #F59E0B, #D05937)",
                boxShadow: "0 8px 24px -8px rgba(245,158,11,0.5)",
              }}
            >
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-[Sora] text-2xl font-bold tracking-tight text-white">
                Painel de Metas
              </h1>
              <p className="font-[DM_Sans] text-sm text-white/60">
                {isLoading
                  ? "Carregando perfil…"
                  : `${profile?.full_name ?? "Líder"} · ${cargo} ${unidade?.nome ? `· ${unidade.nome}` : ""}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-amber-300 ring-1 ring-amber-500/30">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="font-[DM_Sans]">Dados de demonstração</span>
          </div>
        </motion.header>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {MOCK_METAS.map((m, i) => (
            <motion.div
              key={m.titulo}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.4 }}
            >
              <MetaCard {...m} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
