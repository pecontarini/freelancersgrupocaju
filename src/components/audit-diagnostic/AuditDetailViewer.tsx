import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle,
  ImageIcon,
  ExternalLink,
  XCircle,
  CheckCircle2,
  Shield,
  Trash2,
  Loader2,
  Camera,
} from "lucide-react";
import { PhotoLightbox } from "./PhotoLightbox";
import type { SupervisionAudit, SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { categorizeItemToSector, SECTOR_POSITION_MAP } from "@/lib/sectorPositionMapping";
import { AUDIT_TYPE_LABELS, type AuditChecklistType } from "@/lib/audit/auditTypes";

interface AuditDetailViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audit: SupervisionAudit | null;
  allAudits: SupervisionAudit[];
  failures: SupervisionFailure[];
  getLojaName: (id: string) => string;
  auditChecklistTypes?: Record<string, string[]>;
  onNavigate: (audit: SupervisionAudit) => void;
  onDeleteAudit?: (auditId: string) => Promise<void>;
  isDeletingAudit?: boolean;
  isAdmin?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 90) return "text-emerald-600";
  if (score >= 80) return "text-amber-600";
  return "text-destructive";
}

function getScoreBg(score: number) {
  if (score >= 90) return "bg-emerald-100 text-emerald-700 border-emerald-300";
  if (score >= 80) return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-red-100 text-red-700 border-red-300";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "validated":
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1"><Shield className="h-3 w-3" /> Validado</Badge>;
    case "resolved":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-300 gap-1"><CheckCircle2 className="h-3 w-3" /> Corrigido</Badge>;
    default:
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Pendente</Badge>;
  }
}

export function AuditDetailViewer({
  open,
  onOpenChange,
  audit,
  allAudits,
  failures,
  getLojaName,
  auditChecklistTypes = {},
  onNavigate,
  onDeleteAudit,
  isDeletingAudit = false,
  isAdmin = false,
}: AuditDetailViewerProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const currentIndex = audit ? allAudits.findIndex((a) => a.id === audit.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allAudits.length - 1;

  const auditFailures = useMemo(
    () => (audit ? failures.filter((f) => f.audit_id === audit.id) : []),
    [audit, failures]
  );

  const photos = useMemo(() => {
    const result: { url: string; label: string }[] = [];
    auditFailures.forEach((f) => {
      if (f.url_foto_evidencia) {
        result.push({ url: f.url_foto_evidencia, label: `Evidência: ${f.item_name}` });
      }
      if (f.resolution_photo_url) {
        result.push({ url: f.resolution_photo_url, label: `Correção: ${f.item_name}` });
      }
    });
    return result;
  }, [auditFailures]);

  const types = audit ? auditChecklistTypes[audit.id] || [] : [];

  if (!audit) return null;

  const handleDelete = async () => {
    if (audit && onDeleteAudit) {
      await onDeleteAudit(audit.id);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] p-0 gap-0 overflow-hidden">
          {/* Navigation bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasPrev}
              onClick={() => hasPrev && onNavigate(allAudits[currentIndex - 1])}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground font-medium">
              {currentIndex + 1} de {allAudits.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasNext}
              onClick={() => hasNext && onNavigate(allAudits[currentIndex + 1])}
              className="gap-1"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Header */}
          <DialogHeader className="px-6 pt-4 pb-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <DialogTitle className="text-lg font-bold truncate">
                  {getLojaName(audit.loja_id)}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <span>
                    {new Date(audit.audit_date + "T12:00:00").toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  {types.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {AUDIT_TYPE_LABELS[t as AuditChecklistType] || t}
                    </Badge>
                  ))}
                </DialogDescription>
              </div>
              <Badge
                variant="outline"
                className={`text-xl font-bold px-4 py-2 flex-shrink-0 ${getScoreBg(audit.global_score)}`}
              >
                {audit.global_score.toFixed(1)}%
              </Badge>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <Tabs defaultValue="pdf" className="flex-1 flex flex-col min-h-0">
            <div className="px-6">
              <TabsList className="w-full grid grid-cols-3 h-10">
                <TabsTrigger value="pdf" className="gap-1.5 text-xs sm:text-sm">
                  <FileText className="h-4 w-4" />
                  PDF
                </TabsTrigger>
                <TabsTrigger value="failures" className="gap-1.5 text-xs sm:text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Falhas ({auditFailures.length})
                </TabsTrigger>
                <TabsTrigger value="photos" className="gap-1.5 text-xs sm:text-sm">
                  <ImageIcon className="h-4 w-4" />
                  Fotos ({photos.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 px-6 pb-4">
              {/* PDF Tab */}
              <TabsContent value="pdf" className="mt-4 focus-visible:ring-0">
                {audit.pdf_url ? (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" className="gap-1.5" asChild>
                        <a href={audit.pdf_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir em nova aba
                        </a>
                      </Button>
                    </div>
                    <div className="rounded-lg border overflow-hidden bg-muted/20">
                      <iframe
                        src={audit.pdf_url}
                        className="w-full h-[500px]"
                        title="PDF da Auditoria"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">Nenhum PDF anexado a esta auditoria.</p>
                  </div>
                )}
              </TabsContent>

              {/* Failures Tab */}
              <TabsContent value="failures" className="mt-4 space-y-3 focus-visible:ring-0">
                {auditFailures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-3 text-emerald-500 opacity-50" />
                    <p className="text-sm">Nenhuma não conformidade nesta auditoria.</p>
                  </div>
                ) : (
                  auditFailures.map((f) => {
                    const sector = categorizeItemToSector(f.item_name, f.category);
                    const sectorName = SECTOR_POSITION_MAP[sector]?.displayName || sector;
                    return (
                      <div
                        key={f.id}
                        className="rounded-xl border bg-card p-4 space-y-2 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <XCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-medium">{f.item_name}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant="outline" className="text-[10px]">{sectorName}</Badge>
                            {getStatusBadge(f.status)}
                          </div>
                        </div>
                        {f.detalhes_falha && (
                          <p className="text-xs text-muted-foreground pl-6">{f.detalhes_falha}</p>
                        )}
                        {(f.url_foto_evidencia || f.resolution_photo_url) && (
                          <div className="flex gap-2 pl-6">
                            {f.url_foto_evidencia && (
                              <button
                                className="relative group rounded-lg overflow-hidden border w-16 h-16 flex-shrink-0"
                                onClick={() => {
                                  const idx = photos.findIndex((p) => p.url === f.url_foto_evidencia);
                                  if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                                }}
                              >
                                <img src={f.url_foto_evidencia} alt="Evidência" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            )}
                            {f.resolution_photo_url && (
                              <button
                                className="relative group rounded-lg overflow-hidden border border-emerald-300 w-16 h-16 flex-shrink-0"
                                onClick={() => {
                                  const idx = photos.findIndex((p) => p.url === f.resolution_photo_url);
                                  if (idx >= 0) { setLightboxIndex(idx); setLightboxOpen(true); }
                                }}
                              >
                                <img src={f.resolution_photo_url} alt="Correção" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Delete (admin) */}
                {isAdmin && onDeleteAudit && (
                  <>
                    <Separator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="w-full gap-2" disabled={isDeletingAudit}>
                          {isDeletingAudit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </TabsContent>

              {/* Photos Tab */}
              <TabsContent value="photos" className="mt-4 focus-visible:ring-0">
                {photos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma foto anexada a esta auditoria.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo, i) => (
                      <button
                        key={i}
                        className="relative group rounded-xl overflow-hidden border aspect-square"
                        onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                      >
                        <img src={photo.url} alt={photo.label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-[10px] truncate">{photo.label}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      <PhotoLightbox
        photos={photos}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </>
  );
}
