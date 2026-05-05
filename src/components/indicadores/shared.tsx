import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const TIER = {
  perf: (p: number) => {
    const n = p < 1 ? p * 100 : p;
    if (n >= 90) return "#10B981";
    if (n >= 80) return "#FBBF24";
    if (n >= 70) return "#F97316";
    return "#EF4444";
  },
  nps: (n: number) => {
    if (n >= 4.8) return "#10B981";
    if (n >= 4.6) return "#6EE7B7";
    if (n >= 4.4) return "#FBBF24";
    return "#EF4444";
  },
  pctNeg: (p: number) => {
    const n = p < 1 ? p * 100 : p;
    if (n < 2) return "#10B981";
    if (n < 5) return "#FBBF24";
    return "#EF4444";
  },
  rsAval: (v: number) => {
    if (v > 120000) return "#10B981";
    if (v > 90000) return "#6EE7B7";
    if (v > 70000) return "#FBBF24";
    return "#EF4444";
  },
  kds: (p: number) => {
    const n = p < 1 ? p * 100 : p;
    if (n >= 15) return "#EF4444";
    if (n >= 8) return "#FBBF24";
    return "#10B981";
  },
};

export function MetricCard({
  children,
  className,
  index = 0,
  hoverable = true,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  hoverable?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: "easeOut" }}
      whileHover={hoverable ? { scale: 1.005 } : undefined}
      className={cn(
        "group relative rounded-2xl p-6 border transition-all",
        "bg-white/[0.04] border-white/10 backdrop-blur-md",
        hoverable && "hover:border-amber-500/30 hover:shadow-[0_8px_32px_rgba(245,158,11,0.08)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  badge,
  right,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="font-semibold text-white text-lg tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
            {badge}
          </span>
        )}
        {right}
      </div>
    </div>
  );
}

export function KpiBlock({
  label,
  value,
  hint,
  color = "#F59E0B",
  index = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  color?: string;
  index?: number;
}) {
  return (
    <MetricCard index={index}>
      <div className="text-[11px] uppercase tracking-widest text-white/40 font-medium">{label}</div>
      <div className="mt-2 text-3xl md:text-4xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-white/50">{hint}</div>}
    </MetricCard>
  );
}

export function CountUp({ value, decimals = 0, duration = 1.2, suffix = "", prefix = "" }: {
  value: number; decimals?: number; duration?: number; suffix?: string; prefix?: string;
}) {
  // simple non-animated fallback if motion is heavy; light motion via CSS-less rAF
  // Implementing minimal: just render formatted; framer-motion animated counter via useMotionValue would be heavier
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {prefix}{formatted}{suffix}
    </motion.span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  onUpload,
}: {
  icon: any;
  title: string;
  onUpload?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-md p-12 text-center">
      <Icon className="h-10 w-10 text-amber-400 mx-auto mb-3" />
      <p className="text-sm text-white/60">{title}</p>
      {onUpload && (
        <button
          onClick={onUpload}
          className="mt-4 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold transition"
        >
          + Fazer upload
        </button>
      )}
    </div>
  );
}

export const tooltipStyle = {
  background: "#1a1a1a",
  border: "1px solid rgba(245,158,11,0.3)",
  borderRadius: 8,
  color: "#F9FAFB",
  fontSize: 12,
};

export const axisTick = { fill: "rgba(255,255,255,0.5)", fontSize: 11 };
