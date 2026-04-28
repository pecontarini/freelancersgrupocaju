import type { TooltipProps } from "recharts";

interface VisionGlassTooltipProps extends TooltipProps<number, string> {
  /** Optional value formatter (e.g. BRL, percent). */
  formatter?: (value: number, name: string) => string;
  /** Optional label formatter for the X-axis label. */
  labelFormatter?: (label: string | number) => string;
}

/**
 * Recharts tooltip in the Vision Pro liquid-glass style.
 * Works on both hover (desktop) and touch (mobile) — Recharts forwards
 * touch events to the tooltip system natively.
 */
export function VisionGlassTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: VisionGlassTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="vision-glass-tooltip pointer-events-none min-w-[140px] px-3 py-2">
      {label !== undefined && label !== "" && (
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/55">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, idx) => {
          const value = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
          const name = (entry.name ?? "") as string;
          const display = formatter ? formatter(value, name) : value.toLocaleString("pt-BR");
          return (
            <div key={idx} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full ring-2 ring-white/20"
                style={{ background: entry.color ?? "hsl(var(--primary))" }}
              />
              <span className="flex-1 text-[11px] text-white/70">{name}</span>
              <span className="text-sm font-bold tabular-nums text-white">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
