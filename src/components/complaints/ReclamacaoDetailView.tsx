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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useIsMobile } from "@/hooks/use-mobile";
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

        {/* Evidence Image */}
        {reclamacao.anexo_url && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase">
              Evidência
            </h4>
            <div 
              className="relative cursor-pointer group rounded-lg overflow-hidden border"
              onClick={() => setIsImageZoomed(true)}
            >
              <AspectRatio ratio={16/9}>
                <img 
                  src={reclamacao.anexo_url} 
                  alt="Print da reclamação" 
                  className="object-cover w-full h-full"
                />
              </AspectRatio>
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase">
            Análise da IA (Dores da Operação)
          </h4>
          
          {/* Tags */}
          {(reclamacao.temas?.length > 0 || reclamacao.palavras_chave?.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {(reclamacao.temas?.length > 0 ? reclamacao.temas : reclamacao.palavras_chave)?.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag.startsWith("#") ? tag : `#${tag}`}
                </Badge>
              ))}
            </div>
          )}

          {/* AI Summary */}
          {reclamacao.resumo_ia && (
            <p className="text-sm bg-muted/50 rounded-lg p-3">
              {reclamacao.resumo_ia}
            </p>
          )}

          {/* Original Text (OCR) */}
          {reclamacao.texto_original && (
            <details className="group">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Ver texto original (OCR)
              </summary>
              <p className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded p-2 whitespace-pre-wrap">
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
          
          {!relatedActionPlan && (
            <p className="text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4 inline mr-1" />
              Nenhum plano de ação vinculado ainda.
            </p>
          )}
        </div>

        {/* Resolution Form */}
        {relatedActionPlan && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                Resolução do Problema
              </h4>
              <ActionPlanResolutionForm
                actionPlan={relatedActionPlan}
                onUpdate={async (data) => { await updateActionPlan.mutateAsync(data); }}
              />
            </div>

            {/* Timeline */}
            <Separator />
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase">
                Linha do Tempo
              </h4>
              <ActionPlanTimeline actionPlanId={relatedActionPlan.id} />
            </div>
          </>
        )}

        {/* Actions */}
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleShareWhatsApp}
          >
            <Share2 className="h-4 w-4" />
            Compartilhar no WhatsApp
          </Button>
          {reclamacao.anexo_url && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              asChild
            >
              <a href={reclamacao.anexo_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Abrir Imagem
              </a>
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  );

  // Zoomed Image Dialog
  const ZoomedImageDialog = () => (
    <Dialog open={isImageZoomed} onOpenChange={setIsImageZoomed}>
      <DialogContent className="max-w-4xl p-2">
        <DialogClose className="absolute right-2 top-2 z-10">
          <X className="h-5 w-5" />
        </DialogClose>
        {reclamacao.anexo_url && (
          <img 
            src={reclamacao.anexo_url} 
            alt="Print da reclamação ampliado" 
            className="w-full h-auto max-h-[85vh] object-contain rounded"
          />
        )}
      </DialogContent>
    </Dialog>
  );

  // Desktop: Dialog
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

  // Mobile: Drawer
  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-base">
                Detalhes da Reclamação
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
