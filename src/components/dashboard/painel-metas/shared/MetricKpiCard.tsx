import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  hint?: string;
  value: string;
  suffix?: string;
  delta?: number | null;
  deltaPositiveIsGood?: boolean;
  status?: "excelente" | "bom" | "regular" | "redflag" | "neutro";
  icon?: React.ReactNode;
  onClick?: () => void;
}

const STATUS_RING: Record<string, string> = {
  excelente: "ring-emerald-400/30 from-emerald-500/15",
  bom: "ring-amber-400/30 from-amber-500/15",
  regular: "ring-orange-400/30 from-orange-500/15",
  redflag: "ring-red-400/40 from-red-500/20",
  neutro: "ring-white/10 from-white/5",
};

const STATUS_DOT: Record<string, string> = {
  excelente: "bg-emerald-400",
  bom: "bg-amber-400",
  regular: "bg-orange-400",
  redflag: "bg-red-400",
  neutro: "bg-white/30",
};

export function MetricKpiCard({
  label,
  hint,
  value,
  suffix,
  delta,
  deltaPositiveIsGood = true,
  status = "neutro",
  icon,
  onClick,
}: Props) {
  const hasDelta = typeof delta === "number" && !Number.isNaN(delta) && Math.abs(delta) > 0.001;
  const isUp = hasDelta && (delta as number) > 0;
  const isGood = hasDelta && ((isUp && deltaPositiveIsGood) || (!isUp && !deltaPositiveIsGood));

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative flex w-full flex-col gap-3 rounded-2xl bg-gradient-to-br to-transparent p-4 text-left ring-1 backdrop-blur-md transition-all",
        STATUS_RING[status],
        onClick && "cursor-pointer hover:ring-2",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full ring-2 ring-white/10", STATUS_DOT[status])} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
            {label}
          </span>
        </div>
        {icon && <span className="text-white/40">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-[Sora] text-3xl font-bold tabular-nums text-white">
          {value}
        </span>
        {suffix && <span className="text-xs text-white/50">{suffix}</span>}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px]">
          {hasDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums ring-1",
                isGood
                  ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                  : "bg-red-500/10 text-red-300 ring-red-500/30",
              )}
            >
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta as number).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-white/40">
              <Minus className="h-3 w-3" /> sem dados
            </span>
          )}
          {hint && <span className="text-white/40">{hint}</span>}
        </div>
        {onClick && (
          <ArrowRight className="h-3.5 w-3.5 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        )}
      </div>
    </motion.button>
  );
}
