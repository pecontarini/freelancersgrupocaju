import { useState } from "react";
import { cn } from "@/lib/utils";

interface InteractiveProgressProps {
  value: number | null;
  max?: number;
  /** Tailwind class for the filled bar color (e.g. "bg-emerald-500"). */
  fillClass?: string;
  /** Optional label inside the tooltip (e.g. "Score", "% pratos OK"). */
  label?: string;
  /** Optional unit suffix (e.g. "/100", "%"). */
  suffix?: string;
  className?: string;
}

/**
 * Touch- & hover-interactive progress bar.
 * - Shows a glass tooltip with exact value on hover/tap.
 * - Animated shimmer over the filled portion.
 * - Subtle scale-y on interaction for affordance.
 */
export function InteractiveProgress({
  value,
  max = 100,
  fillClass = "bg-primary",
  label,
  suffix = "",
  className,
}: InteractiveProgressProps) {
  const [active, setActive] = useState(false);
  const safeValue = value ?? 0;
  const pct = Math.max(0, Math.min(100, (safeValue / max) * 100));

  return (
    <div
      className={cn("group relative w-full select-none", className)}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => setTimeout(() => setActive(false), 1200)}
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? "progresso"}
    >
      <div
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-foreground/[0.07] transition-transform duration-200",
          active ? "scale-y-150" : "scale-y-100"
        )}
      >
        <div
          className={cn("relative h-full rounded-full transition-all duration-500 ease-out", fillClass)}
          style={{ width: `${pct}%` }}
        >
          {/* Shimmer */}
          <span
            aria-hidden
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
              animation: "vision-shimmer 2.4s linear infinite",
              backgroundSize: "200% 100%",
            }}
          />
        </div>
      </div>

      {/* Tooltip */}
      <div
        className={cn(
          "vision-glass-tooltip pointer-events-none absolute -top-2 left-1/2 z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap px-2.5 py-1 transition-all duration-200",
          active ? "opacity-100 translate-y-[-110%]" : "opacity-0 translate-y-[-90%]"
        )}
        style={{ left: `${pct}%` }}
      >
        {label && (
          <div className="text-[9px] font-semibold uppercase tracking-wider text-white/55">{label}</div>
        )}
        <div className="text-xs font-bold tabular-nums text-white">
          {value === null ? "—" : `${value.toFixed(1)}${suffix}`}
        </div>
      </div>
    </div>
  );
}
