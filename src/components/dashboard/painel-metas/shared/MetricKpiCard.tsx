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

const STATUS_CLASS: Record<string, string> = {
  excelente: "kpi-status-excelente",
  bom: "kpi-status-bom",
  regular: "kpi-status-regular",
  redflag: "kpi-status-redflag",
  neutro: "kpi-status-neutro",
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
        "kpi-glass group relative flex w-full flex-col gap-3 p-4 text-left",
        STATUS_CLASS[status],
        onClick && "cursor-pointer",
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="status-dot" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        {icon && (
          <span className="vision-glass-icon flex h-8 w-8 items-center justify-center text-foreground/70">
            {icon}
          </span>
        )}
      </div>

      <div className="relative flex items-baseline gap-1.5">
        <span className="display-number font-display text-3xl font-bold tabular-nums text-foreground">
          {value}
        </span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px]">
          {hasDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums ring-1",
                isGood
                  ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300"
                  : "bg-red-500/10 text-red-600 ring-red-500/30 dark:text-red-300",
              )}
            >
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta as number).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted-foreground/70">
              <Minus className="h-3 w-3" /> sem dados
            </span>
          )}
          {hint && <span className="text-muted-foreground/70">{hint}</span>}
        </div>
        {onClick && (
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
        )}
      </div>
    </motion.button>
  );
}
