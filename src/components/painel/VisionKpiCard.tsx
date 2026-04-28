import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { InteractiveProgress } from "./InteractiveProgress";
import type { LucideIcon } from "lucide-react";

interface VisionKpiCardProps {
  title: string;
  icon: LucideIcon;
  value: number | null;
  loading: boolean;
  showProgress?: boolean;
  integer?: boolean;
  suffix?: string;
  helper?: string;
  /** Optional accent (hsl color). Defaults to coral/primary. */
  accent?: string;
}

function progressFill(score: number | null): string {
  if (score === null) return "bg-muted-foreground/40";
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-amber-500";
  return "bg-red-500";
}

export function VisionKpiCard({
  title,
  icon: Icon,
  value,
  loading,
  showProgress,
  integer,
  suffix,
  helper,
  accent = "hsl(14 80% 55%)",
}: VisionKpiCardProps) {
  const display =
    value === null
      ? "—"
      : integer
      ? Math.round(value).toString()
      : value.toFixed(1);

  return (
    <div className="vision-glass relative p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div
          className="vision-glass-icon flex h-10 w-10 shrink-0 items-center justify-center"
          style={{ boxShadow: `0 4px 16px ${accent}33, inset 0 1px 0 rgba(255,255,255,0.4)` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <div className="mt-3 flex items-baseline gap-1">
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ textShadow: value !== null ? `0 0 24px ${accent}40` : undefined }}
          >
            {display}
          </span>
          {suffix && value !== null && (
            <span className="text-sm font-medium text-muted-foreground">{suffix}</span>
          )}
        </div>
      )}

      {showProgress && !loading && (
        <div className="mt-3">
          <InteractiveProgress
            value={value}
            fillClass={cn(progressFill(value))}
            label={title}
            suffix={suffix ?? ""}
          />
        </div>
      )}

      {helper && !loading && (
        <div className="mt-2 text-xs text-muted-foreground">{helper}</div>
      )}
    </div>
  );
}
