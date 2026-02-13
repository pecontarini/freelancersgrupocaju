import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, FileText, CheckCircle, Clock, ShieldCheck, Flame, ExternalLink } from "lucide-react";
import { SectorBadgeCompact } from "@/components/dashboard/SectorResponsibilityBadges";
import { categorizeItemToSector } from "@/lib/sectorPositionMapping";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";

export interface DrillDownConfig {
  type: "item" | "sector" | "unit" | "status";
  title: string;
  failures: SupervisionFailure[];
  getLojaName: (id: string) => string;
}

interface AuditDrillDownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: DrillDownConfig | null;
}

const statusConfig = {
  pending: { label: "Pendente", variant: "secondary" as const, icon: Clock },
  resolved: { label: "Corrigido", variant: "outline" as const, icon: ShieldCheck },
  validated: { label: "Validado", variant: "default" as const, icon: CheckCircle },
};

export function AuditDrillDownDialog({ open, onOpenChange, config }: AuditDrillDownDialogProps) {
  const failures = config?.failures ?? [];
  const getLojaName = config?.getLojaName ?? (() => "");
  const title = config?.title ?? "";

  const summary = useMemo(() => {
    const pending = failures.filter((f) => f.status === "pending").length;
    const resolved = failures.filter((f) => f.status === "resolved").length;
    const validated = failures.filter((f) => f.status === "validated").length;
    const recurring = failures.filter((f) => f.is_recurring).length;
    return { pending, resolved, validated, recurring, total: failures.length };
  }, [failures]);

  // Group by store
  const byStore = useMemo(() => {
    const groups: Record<string, SupervisionFailure[]> = {};
    failures.forEach((f) => {
      const name = getLojaName(f.loja_id);
      if (!groups[name]) groups[name] = [];
      groups[name].push(f);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [failures, getLojaName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 pb-2 border-b">
          <Badge variant="secondary" className="gap-1">
            Total: {summary.total}
          </Badge>
          <Badge variant="secondary" className="gap-1 text-amber-600">
            <Clock className="h-3 w-3" /> {summary.pending} pendentes
          </Badge>
          <Badge variant="secondary" className="gap-1 text-emerald-600">
            <CheckCircle className="h-3 w-3" /> {summary.validated} validados
          </Badge>
          {summary.recurring > 0 && (
            <Badge variant="destructive" className="gap-1">
              <Flame className="h-3 w-3" /> {summary.recurring} recorrentes
            </Badge>
          )}
        </div>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4">
            {byStore.map(([storeName, storeFailures]) => (
              <div key={storeName}>
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{storeName}</span>
                  <Badge variant="outline" className="text-[10px]">{storeFailures.length}</Badge>
                </div>
                <div className="space-y-1.5 pl-6">
                  {storeFailures.map((f) => {
                    const sector = categorizeItemToSector(f.item_name, f.category);
                    const st = statusConfig[f.status as keyof typeof statusConfig] || statusConfig.pending;
                    return (
                      <div
                        key={f.id}
                        className="flex items-start gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <p className="font-medium text-xs">{f.item_name}</p>
                            <SectorBadgeCompact sector={sector} />
                            <Badge variant={st.variant} className="text-[10px] h-4 gap-0.5">
                              <st.icon className="h-2.5 w-2.5" />
                              {st.label}
                            </Badge>
                            {f.is_recurring && (
                              <Badge variant="destructive" className="text-[10px] h-4 gap-0.5">
                                <Flame className="h-2.5 w-2.5" /> Recorrente
                              </Badge>
                            )}
                          </div>
                          {f.detalhes_falha && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {f.detalhes_falha}
                            </p>
                          )}
                          {f.url_foto_evidencia && (
                            <a
                              href={f.url_foto_evidencia}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary hover:underline mt-0.5 inline-flex items-center gap-0.5"
                            >
                              📷 Evidência <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
