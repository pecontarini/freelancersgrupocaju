import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type FaixaTone = "excelente" | "bom" | "regular" | "redflag" | "neutral";

const TONE_CONFIG: Record<FaixaTone, { fill: string; text: string; ring: string }> = {
  excelente: {
    fill: "[&>div]:bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
  },
  bom: {
    fill: "[&>div]:bg-primary",
    text: "text-primary",
    ring: "ring-primary/20",
  },
  regular: {
    fill: "[&>div]:bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/20",
  },
  redflag: {
    fill: "[&>div]:bg-destructive",
    text: "text-destructive",
    ring: "ring-destructive/20",
  },
  neutral: {
    fill: "[&>div]:bg-muted-foreground/40",
    text: "text-muted-foreground",
    ring: "ring-muted/20",
  },
};

interface KpiByStoreCardProps {
  label: string;
  value: string;
  hint?: string;
  /** 0..100 — se omitido, não mostra a barra. */
  progress?: number;
  tone?: FaixaTone;
  icon?: LucideIcon;
  loading?: boolean;
}

export function KpiByStoreCard({
  label,
  value,
  hint,
  progress,
  tone = "neutral",
  icon: Icon,
  loading,
}: KpiByStoreCardProps) {
  const config = TONE_CONFIG[tone];

  return (
    <Card className={cn("glass-card hover-lift transition-all ring-1", config.ring)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          {Icon ? <Icon className={cn("h-4 w-4 shrink-0", config.text)} /> : null}
        </div>
        {loading ? (
          <Skeleton className="mt-3 h-8 w-24" />
        ) : (
          <div className="mt-2 text-2xl font-bold tabular-nums leading-none">{value}</div>
        )}
        {hint && !loading ? (
          <div className={cn("mt-1.5 text-[10px] font-medium", config.text)}>{hint}</div>
        ) : null}
        {typeof progress === "number" && !loading ? (
          <Progress
            value={Math.max(0, Math.min(100, progress))}
            className={cn("mt-3 h-1", config.fill)}
            aria-label={`${label} progresso`}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

interface KpiByStoreGridProps {
  children: React.ReactNode;
  /** Quantidade desejada de colunas no breakpoint XL. */
  cols?: 3 | 4;
}

export function KpiByStoreGrid({ children, cols = 4 }: KpiByStoreGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"
      )}
    >
      {children}
    </div>
  );
}
