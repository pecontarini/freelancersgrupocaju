import { useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Upload, 
  ImageIcon, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/useUserProfile";
import { type ActionPlan, type UpdateActionPlanInput } from "@/hooks/useActionPlans";
import { ActionPlanStatusBadge } from "./ActionPlanStatusBadge";
import { ActionPlanTimeline } from "./ActionPlanTimeline";
import { VoiceInputButton } from "./VoiceInputButton";

interface ActionPlanResolutionFormProps {
  actionPlan: ActionPlan;
  onUpdate: (input: UpdateActionPlanInput) => Promise<void>;
}

export function ActionPlanResolutionForm({ actionPlan, onUpdate }: ActionPlanResolutionFormProps) {
  const { isAdmin } = useUserProfile();
  const { toast } = useToast();
  
  const [causaRaiz, setCausaRaiz] = useState(actionPlan.causa_raiz || "");
  const [medidaTomada, setMedidaTomada] = useState(actionPlan.medida_tomada || "");
  const [acaoPreventiva, setAcaoPreventiva] = useState(actionPlan.acao_preventiva || "");
  const [evidenciaUrl, setEvidenciaUrl] = useState(actionPlan.evidencia_url || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isLate = new Date(actionPlan.deadline_at) < new Date() && actionPlan.status === "pending";
  const canEdit = actionPlan.status !== "resolved";
  const canValidate = isAdmin && actionPlan.status === "in_analysis";

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop();
      const fileName = `${user.id}/${actionPlan.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("action-plan-evidence")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("action-plan-evidence")
        .getPublicUrl(fileName);

      setEvidenciaUrl(publicUrl);
      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível enviar a imagem.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [actionPlan.id, toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({
        id: actionPlan.id,
        causa_raiz: causaRaiz,
        medida_tomada: medidaTomada,
        acao_preventiva: acaoPreventiva,
        evidencia_url: evidenciaUrl,
        // If filling out the form, move to in_analysis
        status: actionPlan.status === "pending" && (causaRaiz || medidaTomada || acaoPreventiva)
          ? "in_analysis"
          : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    setIsSaving(true);
    try {
      await onUpdate({
        id: actionPlan.id,
        status: "resolved",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const appendToField = (setter: React.Dispatch<React.SetStateAction<string>>) => (text: string) => {
    setter(prev => prev ? `${prev} ${text}` : text);
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={actionPlan.id} className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 text-left">
              <span className="font-semibold text-primary">{actionPlan.pain_tag}</span>
              <div className="flex items-center gap-2 mt-1">
                <ActionPlanStatusBadge 
                  status={actionPlan.status} 
                  deadlineAt={actionPlan.deadline_at}
                />
                {actionPlan.status === "pending" && (
                  <span className={`text-xs ${isLate ? "text-destructive" : "text-muted-foreground"}`}>
                    <Clock className="h-3 w-3 inline mr-1" />
                    {isLate ? "Prazo expirado" : `Prazo: ${formatDistanceToNow(new Date(actionPlan.deadline_at), { locale: ptBR, addSuffix: true })}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </AccordionTrigger>
        
        <AccordionContent className="px-4 pb-4 space-y-4">
          {/* Causa Raiz */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Causa Raiz
            </Label>
            <p className="text-xs text-muted-foreground">Por que este problema ocorreu?</p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Descreva a causa raiz do problema..."
                value={causaRaiz}
                onChange={(e) => setCausaRaiz(e.target.value)}
                disabled={!canEdit}
                className="min-h-[80px]"
              />
              {canEdit && (
                <VoiceInputButton 
                  onTranscript={appendToField(setCausaRaiz)} 
                  disabled={!canEdit}
                />
              )}
            </div>
          </div>

          {/* Medida Tomada */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              Medida Tomada
            </Label>
            <p className="text-xs text-muted-foreground">O que foi feito para resolver agora?</p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Descreva as ações imediatas tomadas..."
                value={medidaTomada}
                onChange={(e) => setMedidaTomada(e.target.value)}
                disabled={!canEdit}
                className="min-h-[80px]"
              />
              {canEdit && (
                <VoiceInputButton 
                  onTranscript={appendToField(setMedidaTomada)} 
                  disabled={!canEdit}
                />
              )}
            </div>
          </div>

          {/* Ação Preventiva */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              Ação Preventiva
            </Label>
            <p className="text-xs text-muted-foreground">O que foi alterado no processo para não repetir?</p>
            <div className="flex gap-2">
              <Textarea
                placeholder="Descreva mudanças de processo para prevenção..."
                value={acaoPreventiva}
                onChange={(e) => setAcaoPreventiva(e.target.value)}
                disabled={!canEdit}
                className="min-h-[80px]"
              />
              {canEdit && (
                <VoiceInputButton 
                  onTranscript={appendToField(setAcaoPreventiva)} 
                  disabled={!canEdit}
                />
              )}
            </div>
          </div>

          {/* Evidence Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-purple-500" />
              Evidência da Correção
            </Label>
            
            {evidenciaUrl ? (
              <div className="relative rounded-lg overflow-hidden border">
                <img 
                  src={evidenciaUrl} 
                  alt="Evidência" 
                  className="w-full h-32 object-cover"
                />
                {canEdit && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setEvidenciaUrl("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : canEdit ? (
              <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                {isUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Anexar foto</span>
                  </>
                )}
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma evidência anexada.</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {canEdit && (
              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {actionPlan.status === "pending" ? "Enviar para Análise" : "Salvar Alterações"}
              </Button>
            )}
            
            {canValidate && (
              <Button 
                onClick={handleValidate}
                disabled={isSaving}
                variant="default"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Validar Resolução
              </Button>
            )}
          </div>

          {/* Timeline */}
          <ActionPlanTimeline actionPlanId={actionPlan.id} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
