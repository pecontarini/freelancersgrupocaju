import { useState, useRef } from "react";
import {
  CheckCircle,
  Clock,
  Camera,
  RefreshCw,
  X,
  Loader2,
  History,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface RecurrenceInfo {
  count: number;
  history: SupervisionFailure[];
}

interface ActionPlanListProps {
  failures: SupervisionFailure[];
  isAdmin: boolean;
  isRecurring: (failure: SupervisionFailure) => boolean;
  getRecurrenceInfo?: (failure: SupervisionFailure) => RecurrenceInfo;
  onResolve: (params: { failureId: string; photoUrl?: string }) => Promise<any>;
  onValidate: (failureId: string) => Promise<any>;
}

export function ActionPlanList({
  failures,
  isAdmin,
  isRecurring,
  getRecurrenceInfo,
  onResolve,
  onValidate,
}: ActionPlanListProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFailure, setSelectedFailure] = useState<SupervisionFailure | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [expandedHistories, setExpandedHistories] = useState<Set<string>>(new Set());

  const toggleHistory = (failureId: string) => {
    setExpandedHistories((prev) => {
      const next = new Set(prev);
      if (next.has(failureId)) {
        next.delete(failureId);
      } else {
        next.add(failureId);
      }
      return next;
    });
  };

  const handleOpenResolveModal = (failure: SupervisionFailure) => {
    setSelectedFailure(failure);
    setIsResolveModalOpen(true);
    setPhotoPreview(null);
    setPhotoFile(null);
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleResolveItem = async () => {
    if (!selectedFailure) return;

    setIsUploading(true);

    try {
      let photoUrl: string | undefined;

      if (photoFile) {
        const fileName = `resolutions/${selectedFailure.id}/${Date.now()}_${photoFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("audit-photos")
          .upload(fileName, photoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("audit-photos")
          .getPublicUrl(uploadData.path);
        photoUrl = urlData.publicUrl;
      }

      await onResolve({ failureId: selectedFailure.id, photoUrl });

      setIsResolveModalOpen(false);
      setSelectedFailure(null);
    } catch (error) {
      console.error("Error resolving item:", error);
      toast({
        title: "Erro ao resolver item",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleValidateItem = async (failure: SupervisionFailure) => {
    try {
      await onValidate(failure.id);
    } catch (error) {
      console.error("Error validating item:", error);
    }
  };

  if (failures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
        <h3 className="font-medium text-lg">Nenhuma pendência</h3>
        <p className="text-muted-foreground text-sm">
          Não há itens de supervisão para os filtros selecionados.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {failures.map((failure) => {
          const recurring = isRecurring(failure);
          const recurrenceInfo = getRecurrenceInfo?.(failure);
          const isHistoryExpanded = expandedHistories.has(failure.id);
          
          return (
            <div key={failure.id} className="space-y-0">
              <div
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                  recurring
                    ? "border-destructive/50 bg-destructive/5"
                    : failure.status === "resolved"
                    ? "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
                    : "border-border bg-background"
                }`}
              >
                {/* Status indicator */}
                <div className="flex-shrink-0 mt-1">
                  {failure.status === "pending" ? (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-amber-500" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="font-medium text-sm leading-tight">{failure.item_name}</p>
                    {recurring && recurrenceInfo && (
                      <Badge variant="destructive" className="flex-shrink-0 text-xs gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Reincidente: {recurrenceInfo.count}x
                      </Badge>
                    )}
                  </div>
                  {failure.category && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      #{failure.category}
                    </Badge>
                  )}
                  {failure.status === "resolved" && failure.resolved_at && (
                    <p className="text-xs text-amber-600 mt-2">
                      Corrigido em{" "}
                      {format(new Date(failure.resolved_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  )}
                  {failure.resolution_photo_url && (
                    <a
                      href={failure.resolution_photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline mt-1 inline-block"
                    >
                      Ver foto anexada
                    </a>
                  )}

                  {/* History drill-down for recurring items */}
                  {recurring && recurrenceInfo && recurrenceInfo.history.length > 1 && (
                    <Collapsible open={isHistoryExpanded} onOpenChange={() => toggleHistory(failure.id)}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                          <History className="h-3.5 w-3.5" />
                          Ver histórico ({recurrenceInfo.history.length - 1} ocorrências anteriores)
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isHistoryExpanded ? 'rotate-90' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="border-l-2 border-muted pl-3 space-y-2">
                          {recurrenceInfo.history
                            .filter((h) => h.id !== failure.id)
                            .slice(0, 5)
                            .map((historyItem) => (
                              <div
                                key={historyItem.id}
                                className="text-xs p-2 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant={
                                      historyItem.status === "validated"
                                        ? "default"
                                        : historyItem.status === "resolved"
                                        ? "secondary"
                                        : "outline"
                                    }
                                    className="text-[10px] h-5"
                                  >
                                    {historyItem.status === "validated"
                                      ? "Validado"
                                      : historyItem.status === "resolved"
                                      ? "Corrigido"
                                      : "Pendente"}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {format(new Date(historyItem.created_at), "dd/MM/yyyy", {
                                      locale: ptBR,
                                    })}
                                  </span>
                                </div>
                                {historyItem.resolution_photo_url && (
                                  <a
                                    href={historyItem.resolution_photo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary underline"
                                  >
                                    Ver evidência
                                  </a>
                                )}
                              </div>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0">
                  {failure.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenResolveModal(failure)}
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Resolver
                    </Button>
                  )}
                  {failure.status === "resolved" && isAdmin && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleValidateItem(failure)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Validar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resolve Modal */}
      <Dialog open={isResolveModalOpen} onOpenChange={setIsResolveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Corrigido</DialogTitle>
            <DialogDescription>
              {selectedFailure?.item_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anexe uma foto da correção para validação do Admin (opcional).
            </p>

            {/* Photo upload area */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                photoPreview ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="max-h-40 mx-auto rounded-lg"
                  />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-0 right-0 h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoPreview(null);
                      setPhotoFile(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm">Tirar foto ou selecionar</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsResolveModalOpen(false)}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button onClick={handleResolveItem} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Correção
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}