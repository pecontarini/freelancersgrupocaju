import { Card, CardContent } from "@/components/ui/card";
import type { SheetBlock } from "@/hooks/useSheetBlocks";

type Kpi = {
  label: string;
  value: number;
  format?: "int" | "decimal" | "percent" | "currency";
  decimals?: number;
  suffix?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

function fmt(k: Kpi): string {
  const v = k.value;
  if (k.format === "percent") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: k.decimals ?? 2 })}%`;
  if (k.format === "currency") return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (k.format === "decimal") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: k.decimals ?? 2, minimumFractionDigits: k.decimals ?? 2 })}${k.suffix ? ` ${k.suffix}` : ""}`;
  return `${Math.round(v).toLocaleString("pt-BR")}${k.suffix ? ` ${k.suffix}` : ""}`;
}

const TONES: Record<string, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
};

export function KpiStripBlock({ block }: { block: SheetBlock }) {
  const payload = block.payload as { label?: string; kpis?: Kpi[] };
  const kpis = payload.kpis ?? [];
  if (!kpis.length) return null;

  return (
    <Card className="rounded-2xl md:col-span-2">
      <CardContent className="p-4">
        {payload.label && (
          <div className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">{payload.label}</div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {kpis.map((k, i) => (
            <div key={i} className="rounded-xl border bg-card/50 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${TONES[k.tone ?? "default"]}`}>{fmt(k)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
