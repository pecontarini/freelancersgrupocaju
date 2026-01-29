import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X,
  Utensils,
  Truck,
  ZoomIn,
  Share2,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Edit3,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useActionPlans } from "@/hooks/useActionPlans";
import { ActionPlanStatusBadge } from "./ActionPlanStatusBadge";
import { ActionPlanResolutionForm } from "./ActionPlanResolutionForm";
import { ActionPlanTimeline } from "./ActionPlanTimeline";
import type { Reclamacao, FonteReclamacao } from "@/hooks/useReclamacoes";

interface ReclamacaoDetailViewProps {
  reclamacao: Reclamacao | null;
  lojaNome?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FONTE_LABELS: Record<FonteReclamacao, string> = {
  google: "Google",
  ifood: "iFood",
  tripadvisor: "TripAdvisor",
  getin: "Get In",
  manual: "Manual",
  sheets: "Planilha",
};

const FONTE_ICONS: Record<FonteReclamacao, string> = {
  google: "🔍",
  ifood: "🛵",
  tripadvisor: "🦉",
  getin: "📱",
  manual: "✍️",
  sheets: "📊",
};

export function ReclamacaoDetailView({
  reclamacao,
  lojaNome,
  open,
  onOpenChange,
}: ReclamacaoDetailViewProps) {
  const isMobile = useIsMobile();
  const { isAdmin, isGerenteUnidade } = useUserProfile();
  const [isImageZoomed, setIsImageZoomed] = useState(false);

  // Get action plan for this reclamacao's pain tags
  const painTag = reclamacao?.temas?.[0] || reclamacao?.palavras_chave?.[0] || null;
  const { actionPlans, updateActionPlan } = useActionPlans(
    reclamacao?.loja_id,
    reclamacao?.referencia_mes
  );

  // Find related action plan
  const relatedActionPlan = actionPlans.find(
    (ap) => ap.pain_tag === painTag && ap.loja_id === reclamacao?.loja_id
  );

  if (!reclamacao) return null;

  // Determine user capabilities
  const canManagerEdit = isGerenteUnidade && relatedActionPlan?.status === "pending";
  const canAdminValidate = isAdmin && relatedActionPlan?.status === "in_analysis";

  // WhatsApp share message
  const handleShareWhatsApp = () => {
    const message = `⚠️ *Alerta de Reclamação*
📍 Unidade: ${lojaNome || "—"}
📅 Data: ${format(new Date(reclamacao.data_reclamacao), "dd/MM/yyyy")}
📦 Canal: ${reclamacao.tipo_operacao === "delivery" ? "Delivery" : "Salão"}
⭐ Nota: ${reclamacao.nota_reclamacao}/5 ${reclamacao.is_grave ? "(GRAVE)" : ""}
📝 Fonte: ${FONTE_LABELS[reclamacao.fonte]}

${reclamacao.resumo_ia ? `*Resumo:*\n${reclamacao.resumo_ia}` : ""}
${reclamacao.temas?.length ? `\n*Tags:* ${reclamacao.temas.join(", ")}` : ""}

---
_Enviado do Portal da Liderança_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
  };

  // Open image in new tab
  const handleOpenImageNewTab = () => {
    if (reclamacao.anexo_url) {
      window.open(reclamacao.anexo_url, "_blank");
    }
  };

  const DetailContent = () => (
    <ScrollArea className="max-h-[80vh] pr-2">
      <div className="space-y-4 pb-4">
        {/* Header Info */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs font-semibold">
            {lojaNome || "Unidade"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {format(new Date(reclamacao.data_reclamacao), "dd 'de' MMMM", { locale: ptBR })}
          </Badge>
          <Badge 
            variant={reclamacao.tipo_operacao === "delivery" ? "default" : "secondary"}
            className="text-xs gap-1"
          >
            {reclamacao.tipo_operacao === "delivery" ? (
              <><Truck className="h-3 w-3" /> Delivery</>
            ) : (
              <><Utensils className="h-3 w-3" /> Salão</>
            )}
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            {FONTE_ICONS[reclamacao.fonte]} {FONTE_LABELS[reclamacao.fonte]}
          </Badge>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${
            reclamacao.nota_reclamacao <= 2 ? "text-destructive" :
            reclamacao.nota_reclamacao <= 3 ? "text-amber-500" :
            "text-muted-foreground"
          }`}>
            {reclamacao.nota_reclamacao}★
          </span>
          {reclamacao.is_grave && (
            <Badge variant="destructive" className="uppercase">
              Reclamação Grave
            </Badge>
          )}
        </div>

        <Separator />

        {/* Evidence Image - Prominent Display */}
        {reclamacao.anexo_url && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                Evidência (Print)
              </h4>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs gap-1"
                onClick={handleOpenImageNewTab}
              >
                <ExternalLink className="h-3 w-3" />
                Abrir em Nova Aba
              </Button>
            </div>
            <div 
              className="relative cursor-pointer group rounded-xl overflow-hidden border-2 border-muted bg-black/5 dark:bg-white/5"
              onClick={() => setIsImageZoomed(true)}
            >
              <AspectRatio ratio={16/10}>
                <img 
                  src={reclamacao.anexo_url} 
                  alt="Print da reclamação" 
                  className="object-contain w-full h-full"
                />
              </AspectRatio>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex items-center gap-2 text-white">
                  <ZoomIn className="h-6 w-6" />
                  <span className="text-sm font-medium">Ampliar</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis - Dores da Operação */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase">
            Dores da Operação (Análise IA)
          </h4>
          
          {/* Tags */}
          {(reclamacao.temas?.length > 0 || reclamacao.palavras_chave?.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {(reclamacao.temas?.length > 0 ? reclamacao.temas : reclamacao.palavras_chave)?.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs bg-primary/10 text-primary">
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </Badge>
              ))}
            </div>
          )}

          {/* AI Summary */}
          {reclamacao.resumo_ia && (
            <div className="bg-muted/50 rounded-lg p-3 border">
              <p className="text-sm leading-relaxed">{reclamacao.resumo_ia}</p>
            </div>
          )}

          {/* Original Text (OCR) */}
          {reclamacao.texto_original && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                <span>▸</span> Ver texto original (OCR)
              </summary>
              <p className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded p-2 whitespace-pre-wrap border">
                {reclamacao.texto_original}
              </p>
            </details>
          )}
        </div>

        <Separator />

        {/* Action Plan Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">
              Status do Plano de Ação
            </h4>
            {relatedActionPlan && (
              <ActionPlanStatusBadge 
                status={relatedActionPlan.status} 
                deadlineAt={relatedActionPlan.deadline_at}
              />
            )}
          </div>
          
          {!relatedActionPlan ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
              <MessageSquare className="h-4 w-4" />
              <span>Nenhum plano de ação vinculado ainda.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              {canManagerEdit && (
                <Badge variant="outline" className="gap-1 text-primary">
                  <Edit3 className="h-3 w-3" />
                  Você pode editar este plano
                </Badge>
              )}
              {canAdminValidate && (
                <Badge variant="outline" className="gap-1 text-emerald-600">
                  <ShieldCheck className="h-3 w-3" />
                  Aguardando sua validação
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Resolution Form */}
        {relatedActionPlan && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                Plano de Resolução
              </h4>
              <ActionPlanResolutionForm
                actionPlan={relatedActionPlan}
                onUpdate={async (data) => { await updateActionPlan.mutateAsync(data); }}
              />
            </div>
          </>
        )}

        {/* Actions Footer */}
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 flex-1 sm:flex-none"
            onClick={handleShareWhatsApp}
          >
            <Share2 className="h-4 w-4" />
            Enviar para WhatsApp
          </Button>
          {reclamacao.anexo_url && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleOpenImageNewTab}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Imagem
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  );

  // Zoomed Image Dialog - Full screen with dark overlay
  const ZoomedImageDialog = () => (
    <Dialog open={isImageZoomed} onOpenChange={setIsImageZoomed}>
      <DialogContent className="max-w-5xl p-0 bg-black/95 border-0">
        <DialogClose className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors">
          <X className="h-5 w-5 text-white" />
        </DialogClose>
        {reclamacao.anexo_url && (
          <div className="flex items-center justify-center min-h-[60vh] p-4">
            <img 
              src={reclamacao.anexo_url} 
              alt="Print da reclamação ampliado" 
              className="max-w-full max-h-[85vh] object-contain rounded"
            />
          </div>
        )}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={handleOpenImageNewTab}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir em Nova Aba
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Desktop: Dialog with semi-transparent overlay
  if (!isMobile) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-lg">Detalhes da Reclamação</span>
                {reclamacao.is_grave && (
                  <Badge variant="destructive" className="text-xs">GRAVE</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <DetailContent />
          </DialogContent>
        </Dialog>
        <ZoomedImageDialog />
      </>
    );
  }

  // Mobile: Drawer (slides from bottom)
  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-base flex items-center gap-2">
                Detalhes da Reclamação
                {reclamacao.is_grave && (
                  <Badge variant="destructive" className="text-xs">GRAVE</Badge>
                )}
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <DetailContent />
          </div>
        </DrawerContent>
      </Drawer>
      <ZoomedImageDialog />
    </>
  );
}
