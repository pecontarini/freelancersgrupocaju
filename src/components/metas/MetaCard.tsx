import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { MetaGauge, type MetaStatus } from "./MetaGauge";
import { cn } from "@/lib/utils";

export interface MetaCardProps {
  titulo: string;
  tipo: string;
  valorAtual: number;
  valorMeta: number;
  percentual: number;
  status: MetaStatus;
  redFlag?: boolean;
  unidadeSufixo?: string;
  formatValor?: (n: number) => string;
  formatMeta?: (n: number) => string;
}

const STATUS_LABEL: Record<MetaStatus, string> = {
  excelente: "Excelente",
  bom: "Bom",
  regular: "Regular",
  redflag: "Crítico",
};

const STATUS_RING: Record<MetaStatus, string> = {
  excelente: "ring-emerald-500/30",
  bom: "ring-amber-500/30",
  regular: "ring-orange-500/30",
  redflag: "ring-red-500/40",
};

export function MetaCard({
  titulo,
  tipo,
  valorAtual,
  valorMeta,
  percentual,
  status,
  redFlag,
  unidadeSufixo = "",
  formatValor,
  formatMeta,
}: MetaCardProps) {
  const positiveTrend = percentual >= 100;
  const valorAtualText = formatValor ? formatValor(valorAtual) : valorAtual.toLocaleString("pt-BR");
  const valorMetaText = formatMeta ? formatMeta(valorMeta) : valorMeta.toLocaleString("pt-BR");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={cn(
        "glass-card relative overflow-hidden p-6 ring-1 transition-shadow",
        STATUS_RING[status],
      )}
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
      }}
    >
      {redFlag && (
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-[10px] font-medium text-red-300 ring-1 ring-red-500/30">
          <AlertTriangle className="h-3 w-3" />
          RED FLAG
        </div>
      )}

      <div className="mb-4">
        <p className="font-[DM_Sans] text-[11px] uppercase tracking-[0.14em] text-white/50">
          {tipo}
        </p>
        <h3 className="mt-1 font-[Sora] text-lg font-semibold text-white/90">
          {titulo}
        </h3>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-1">
            <span className="font-[Sora] text-3xl font-bold tabular-nums text-white">
              {valorAtualText}
            </span>
            <span className="font-[DM_Sans] text-sm text-white/50">
              {unidadeSufixo}
            </span>
          </div>
          <p className="mt-1 font-[DM_Sans] text-xs text-white/50">
            Meta: <span className="text-white/70">{valorMetaText}{unidadeSufixo}</span>
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/70 ring-1 ring-white/10">
            {positiveTrend ? (
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-400" />
            )}
            <span className="font-[DM_Sans]">{STATUS_LABEL[status]}</span>
          </div>
        </div>

        <MetaGauge percentual={percentual} status={status} size={140} />
      </div>
    </motion.div>
  );
}
