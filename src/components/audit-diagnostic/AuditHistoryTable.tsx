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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import type { SupervisionAudit, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { categorizeItemToSector, SECTOR_POSITION_MAP } from "@/lib/sectorPositionMapping";
import { AUDIT_TYPE_LABELS, type AuditChecklistType } from "@/lib/audit/auditTypes";

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

  const auditFailures = selectedAudit
    ? failures.filter((f) => f.audit_id === selectedAudit.id)
    : [];

  const handleDelete = async () => {
    if (selectedAudit && onDeleteAudit) {
      await onDeleteAudit(selectedAudit.id);
      setSelectedAudit(null);
    }
  };

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

      {/* Drill-Down Sheet (Espelho do Checklist) */}
      <Sheet open={!!selectedAudit} onOpenChange={(open) => !open && setSelectedAudit(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              Espelho do Checklist
            </SheetTitle>
          </SheetHeader>

          {selectedAudit && (
            <div className="mt-4 space-y-4">
              {/* Audit header info */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{getLojaName(selectedAudit.loja_id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedAudit.audit_date + "T12:00:00").toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {/* Checklist type badges */}
                  {(auditChecklistTypes[selectedAudit.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(auditChecklistTypes[selectedAudit.id] || []).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {AUDIT_TYPE_LABELS[t as AuditChecklistType] || t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`text-lg font-bold px-3 py-1 ${getScoreBadgeClass(selectedAudit.global_score)}`}
                >
                  {selectedAudit.global_score.toFixed(1)}%
                </Badge>
              </div>

              <Separator />

              {/* Failures list - "espelho" */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {auditFailures.length} item(ns) com perda de ponto
                </p>
                {auditFailures.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <CheckCircle className="h-10 w-10 text-emerald-500 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma não conformidade registrada nesta auditoria.
                    </p>
                  </div>
                ) : (
                  auditFailures.map((f) => {
                    const sector = categorizeItemToSector(f.item_name, f.category);
                    const sectorName = SECTOR_POSITION_MAP[sector]?.displayName || sector;
                    return (
                      <div
                        key={f.id}
                        className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-medium">{f.item_name}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">
                            {sectorName}
                          </Badge>
                        </div>
                        {f.detalhes_falha && (
                          <p className="text-xs text-muted-foreground pl-6">{f.detalhes_falha}</p>
                        )}
                        {f.url_foto_evidencia && (
                          <a
                            href={f.url_foto_evidencia}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline pl-6 inline-flex items-center gap-1"
                          >
                            📷 Evidência <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Delete button (admin only) */}
              {isAdmin && onDeleteAudit && (
                <>
                  <Separator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2"
                        disabled={isDeletingAudit}
                      >
                        {isDeletingAudit ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Excluir Auditoria
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir auditoria?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação é irreversível. A auditoria, suas falhas e scores setoriais serão permanentemente excluídos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
