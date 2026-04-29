import { Badge } from "@/components/ui/badge";
import { SECTOR_LABELS, type SectorKey } from "@/lib/holding/sectors";
import type { ProposedPayload } from "@/hooks/usePOPWizard";
import type { HoldingStaffingConfigRow } from "@/hooks/useHoldingConfig";
import { cn } from "@/lib/utils";

const DAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

interface POPWizardPreviewProps {
  proposed: ProposedPayload;
  currentConfig: HoldingStaffingConfigRow[];
}

function findCurrent(
  cfg: HoldingStaffingConfigRow[],
  sector: string,
  day: number,
  shift: string,
) {
  return cfg.find(
    (r) => r.sector_key === sector && r.day_of_week === day && r.shift_type === shift,
  );
}

function diffBadge(curr: number | undefined, next: number) {
  if (curr === undefined) {
    return (
      <Badge variant="outline" className="border-blue-500/40 text-blue-700 bg-blue-50">
        novo: {next}
      </Badge>
    );
  }
  if (curr === next) {
    return <span className="text-muted-foreground text-xs">= {next}</span>;
  }
  const isUp = next > curr;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isUp ? "text-emerald-700" : "text-red-700",
      )}
    >
      {curr} → <strong>{next}</strong>
    </span>
  );
}

export function POPWizardPreview({ proposed, currentConfig }: POPWizardPreviewProps) {
  if (!proposed?.changes?.length) {
    return (
      <div className="text-xs text-muted-foreground italic text-center py-6">
        Nenhuma mudança proposta ainda. Converse com o assistente acima.
      </div>
    );
  }

  // Group by sector
  const bySector = new Map<string, typeof proposed.changes>();
  for (const c of proposed.changes) {
    const arr = bySector.get(c.sector_key) ?? [];
    arr.push(c);
    bySector.set(c.sector_key, arr);
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        <strong className="text-foreground">{proposed.changes.length}</strong> célula(s)
        serão alteradas.
        {proposed.summary && <p className="mt-1 italic">{proposed.summary}</p>}
      </div>

      <div className="space-y-2">
        {Array.from(bySector.entries()).map(([sector, items]) => (
          <div
            key={sector}
            className="rounded-lg border border-border/50 bg-background/60 backdrop-blur-sm p-2"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-1.5">
              {SECTOR_LABELS[sector as SectorKey] ?? sector}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {items
                .sort((a, b) => a.day_of_week - b.day_of_week || a.shift_type.localeCompare(b.shift_type))
                .map((c, i) => {
                  const curr = findCurrent(currentConfig, c.sector_key, c.day_of_week, c.shift_type);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/30 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-[10px] px-1.5">
                          {DAY_SHORT[c.day_of_week]}
                        </Badge>
                        <span className="capitalize text-muted-foreground">{c.shift_type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">mín</span>
                          {diffBadge(curr?.required_count, c.required_count)}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">dobras</span>
                          {diffBadge(curr?.extras_count, c.extras_count)}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
