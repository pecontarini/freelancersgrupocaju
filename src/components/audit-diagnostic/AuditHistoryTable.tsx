import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ClipboardList, ExternalLink, CheckCircle, XCircle, Eye, Trash2, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SupervisionAudit, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { AUDIT_TYPE_LABELS, type AuditChecklistType } from "@/lib/audit/auditTypes";
import { AuditDetailViewer } from "./AuditDetailViewer";

interface AuditHistoryTableProps {
  audits: SupervisionAudit[];
  failures: SupervisionFailure[];
  getLojaName: (id: string) => string;
  auditChecklistTypes?: Record<string, string[]>;
  onDeleteAudit?: (auditId: string) => Promise<void>;
  isDeletingAudit?: boolean;
  isAdmin?: boolean;
}

function getScoreBadgeClass(score: number): string {
  if (score >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (score >= 80) return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-red-100 text-red-700 border-red-300";
}

function getChecklistTypeLabel(types: string[]): string {
  return types
    .map((t) => AUDIT_TYPE_LABELS[t as AuditChecklistType] || t)
    .join(", ");
}

export function AuditHistoryTable({
  audits,
  failures,
  getLojaName,
  auditChecklistTypes = {},
  onDeleteAudit,
  isDeletingAudit = false,
  isAdmin = false,
}: AuditHistoryTableProps) {
  const [selectedAudit, setSelectedAudit] = useState<SupervisionAudit | null>(null);

  return (
    <>
      <Card className="rounded-2xl shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm uppercase">
            <ClipboardList className="h-4 w-4 text-primary" />
            Histórico de Auditorias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Nenhuma auditoria importada no período.
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Nota Final</TableHead>
                    <TableHead className="text-center">Falhas</TableHead>
                    <TableHead className="text-center w-[60px]">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audits.map((audit) => {
                    const auditFailureCount = failures.filter(
                      (f) => f.audit_id === audit.id
                    ).length;
                    const types = auditChecklistTypes[audit.id] || [];
                    return (
                      <TableRow
                        key={audit.id}
                        className="cursor-pointer hover:bg-muted/70 transition-colors"
                        onClick={() => setSelectedAudit(audit)}
                      >
                        <TableCell className="font-medium">
                          {new Date(audit.audit_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getLojaName(audit.loja_id)}
                        </TableCell>
                        <TableCell>
                          {types.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {types.map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px]">
                                  {AUDIT_TYPE_LABELS[t as AuditChecklistType] || t}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={`font-bold ${getScoreBadgeClass(audit.global_score)}`}
                          >
                            {audit.global_score.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {auditFailureCount}
                        </TableCell>
                        <TableCell className="text-center">
                          <Eye className="h-4 w-4 text-muted-foreground mx-auto" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

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
