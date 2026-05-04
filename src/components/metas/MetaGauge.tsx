import { motion } from "framer-motion";
import { useMemo } from "react";

export type MetaStatus = "excelente" | "bom" | "regular" | "redflag";

interface MetaGaugeProps {
  percentual: number; // 0-100+
  status: MetaStatus;
  size?: number;
  label?: string;
}

const STATUS_COLOR: Record<MetaStatus, string> = {
  excelente: "#10B981",
  bom: "#F59E0B",
  regular: "#F97316",
  redflag: "#EF4444",
};

export function MetaGauge({ percentual, status, size = 180, label }: MetaGaugeProps) {
  const clamped = Math.max(0, Math.min(100, percentual));
  const color = STATUS_COLOR[status];

  // Semicircle: radius, stroke
  const r = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const dashOffset = useMemo(
    () => circumference - (clamped / 100) * circumference,
    [circumference, clamped],
  );

  return (
    <div className="relative flex flex-col items-center" style={{ width: size, height: size / 1.6 }}>
      <svg width={size} height={size / 1.6} viewBox={`0 0 ${size} ${size / 1.6}`}>
        <defs>
          <linearGradient id={`gauge-grad-${status}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Progress */}
        <motion.path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#gauge-grad-${status})`}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 12px ${color}66)` }}
        />
      </svg>
      <div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{ bottom: 4 }}
      >
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-[Sora] text-3xl font-semibold tabular-nums"
          style={{ color }}
        >
          {Math.round(clamped)}%
        </motion.span>
        {label && (
          <span className="font-[DM_Sans] text-[11px] uppercase tracking-wider text-white/50">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
