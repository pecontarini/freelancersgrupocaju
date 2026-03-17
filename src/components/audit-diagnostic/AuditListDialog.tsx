import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, FileText, AlertTriangle } from "lucide-react";
import type { SupervisionAudit, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { AuditDetailViewer } from "./AuditDetailViewer";
import { AUDIT_TYPE_LABELS, type AuditChecklistType } from "@/lib/audit/auditTypes";

interface AuditListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audits: SupervisionAudit[];
  failures: SupervisionFailure[];
  getLojaName: (id: string) => string;
  auditChecklistTypes?: Record<string, string[]>;
  onDeleteAudit?: (auditId: string) => Promise<void>;
  isDeletingAudit?: boolean;
  isAdmin?: boolean;
}

function getScoreBg(score: number) {
  if (score >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (score >= 80) return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-red-100 text-red-700 border-red-300";
}

export function AuditListDialog({
  open,
  onOpenChange,
  audits,
  failures,
  getLojaName,
  auditChecklistTypes = {},
  onDeleteAudit,
  isDeletingAudit,
  isAdmin,
}: AuditListDialogProps) {
  const [selectedAudit, setSelectedAudit] = useState<SupervisionAudit | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl h-[85vh] max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Auditorias Realizadas ({audits.length})
            </DialogTitle>
            <DialogDescription className="text-sm">
              Clique em uma auditoria para ver detalhes, PDF e fotos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            {audits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Nenhuma auditoria no período.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {audits.map((audit) => {
                  const auditFailureCount = failures.filter((f) => f.audit_id === audit.id).length;
                  const types = auditChecklistTypes[audit.id] || [];
                  const hasPdf = !!audit.pdf_url;

                  return (
                    <button
                      key={audit.id}
                      className="w-full text-left rounded-xl border bg-card p-4 hover:bg-muted/50 transition-all hover:shadow-md active:scale-[0.99] group"
                      onClick={() => setSelectedAudit(audit)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                            {getLojaName(audit.loja_id)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {new Date(audit.audit_date + "T12:00:00").toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            {hasPdf && (
                              <span className="flex items-center gap-0.5 text-primary">
                                <FileText className="h-3 w-3" /> PDF
                              </span>
                            )}
                            {auditFailureCount > 0 && (
                              <span className="flex items-center gap-0.5 text-destructive">
                                <AlertTriangle className="h-3 w-3" /> {auditFailureCount} falha{auditFailureCount > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {types.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {types.map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px]">
                                  {AUDIT_TYPE_LABELS[t as AuditChecklistType] || t}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-base font-bold px-3 py-1 flex-shrink-0 ${getScoreBg(audit.global_score)}`}
                        >
                          {audit.global_score.toFixed(1)}%
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AuditDetailViewer
        open={!!selectedAudit}
        onOpenChange={(o) => !o && setSelectedAudit(null)}
        audit={selectedAudit}
        allAudits={audits}
        failures={failures}
        getLojaName={getLojaName}
        auditChecklistTypes={auditChecklistTypes}
        onNavigate={setSelectedAudit}
        onDeleteAudit={onDeleteAudit}
        isDeletingAudit={isDeletingAudit}
        isAdmin={isAdmin}
      />
    </>
  );
}
