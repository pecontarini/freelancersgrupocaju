import { useState, useCallback } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Upload,
  Loader2,
  Camera,
  Store,
  Star,
  Check,
  X,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useReclamacoes, type FonteReclamacao, type TipoOperacao } from "@/hooks/useReclamacoes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReclamacaoModalProps {
  selectedLojaId?: string | null;
  trigger?: React.ReactNode;
}

interface ExtractedData {
  nota_estrelas: number;
  texto_reclamacao: string;
  fonte: FonteReclamacao;
  tipo_operacao: TipoOperacao;
  resumo: string;
  temas: string[];
  palavras_chave: string[];
  confianca: "alta" | "media" | "baixa";
}

const FONTE_LABELS: Record<FonteReclamacao, string> = {
  google: "Google",
  ifood: "iFood",
  tripadvisor: "TripAdvisor",
  getin: "Get In",
  manual: "Manual",
  sheets: "Planilha",
};

export function ReclamacaoModal({ selectedLojaId, trigger }: ReclamacaoModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Form state - only unidade is required from user
  const [lojaId, setLojaId] = useState(selectedLojaId || "");
  const [dataReclamacao, setDataReclamacao] = useState(format(new Date(), "yyyy-MM-dd"));
  
  // Optional manual override
  const [manualTipoOperacao, setManualTipoOperacao] = useState<TipoOperacao | null>(null);

  const { options: lojas } = useConfigLojas();
  const { createReclamacao } = useReclamacoes();

  const effectiveTipoOperacao = manualTipoOperacao || extractedData?.tipo_operacao || "salao";
  const isGrave = extractedData ? extractedData.nota_estrelas <= 3 : false;

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle image upload and AI processing
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são aceitas para extração automática.");
      return;
    }

    // Validate size (max 10MB for AI processing)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 10MB.");
      return;
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setImageFile(file);
    setExtractedData(null);

    // Process with AI
    setIsProcessingAI(true);
    try {
      const base64 = await fileToBase64(file);
      
      const { data, error } = await supabase.functions.invoke('process-reclamacao', {
        body: { 
          imageBase64: base64,
          mimeType: file.type,
        },
      });

      if (error) throw error;

      if (data.success) {
        setExtractedData(data);
        toast.success("Dados extraídos automaticamente!", {
          description: `Fonte: ${FONTE_LABELS[data.fonte as FonteReclamacao]} | ${data.nota_estrelas} estrelas`,
        });
      } else {
        toast.error(data.error || "Erro ao extrair dados da imagem.");
      }
    } catch (err) {
      console.error("AI processing error:", err);
      toast.error("Erro ao processar imagem. Tente novamente.");
    } finally {
      setIsProcessingAI(false);
    }
  }, []);

  // Reset form
  const resetForm = useCallback(() => {
    setExtractedData(null);
    setImagePreview(null);
    setImageFile(null);
    setManualTipoOperacao(null);
    setLojaId(selectedLojaId || "");
    setDataReclamacao(format(new Date(), "yyyy-MM-dd"));
  }, [selectedLojaId]);

  // Submit form
  const handleSubmit = async () => {
    if (!lojaId) {
      toast.error("Selecione uma unidade.");
      return;
    }

    if (!extractedData) {
      toast.error("Faça upload de uma imagem primeiro.");
      return;
    }

    setIsSubmitting(true);
    try {
      let anexoUrl: string | undefined;

      // Upload image if present
      if (imageFile) {
        const fileName = `${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("audit-photos")
          .upload(`reclamacoes/${fileName}`, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("audit-photos")
          .getPublicUrl(`reclamacoes/${fileName}`);

        anexoUrl = urlData.publicUrl;
      }

      await createReclamacao.mutateAsync({
        loja_id: lojaId,
        fonte: extractedData.fonte,
        tipo_operacao: effectiveTipoOperacao,
        data_reclamacao: dataReclamacao,
        nota_reclamacao: extractedData.nota_estrelas,
        texto_original: extractedData.texto_reclamacao || undefined,
        resumo_ia: extractedData.resumo || undefined,
        temas: extractedData.temas.length > 0 ? extractedData.temas : undefined,
        palavras_chave: extractedData.palavras_chave.length > 0 ? extractedData.palavras_chave : undefined,
        anexo_url: anexoUrl,
      });

      resetForm();
      setOpen(false);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Camera className="h-4 w-4" />
            Adicionar Reclamação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Nova Reclamação
          </DialogTitle>
          <DialogDescription>
            Faça upload de um screenshot da avaliação. O sistema extrairá automaticamente todas as informações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Image Upload - Primary Action */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 font-medium">
              <Camera className="h-4 w-4" />
              Screenshot da Avaliação
            </Label>
            
            {!imagePreview ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Clique para fazer upload</span> ou arraste a imagem
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG ou WEBP (máx. 10MB)
                  </p>
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={isProcessingAI}
                />
              </label>
            ) : (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-lg border"
                />
                {isProcessingAI && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-sm font-medium">Analisando imagem...</p>
                      <p className="text-xs text-muted-foreground">Extraindo dados automaticamente</p>
                    </div>
                  </div>
                )}
                {!isProcessingAI && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFile(null);
                      setExtractedData(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Extracted Data Display */}
          {extractedData && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Dados Extraídos
                </h4>
                <Badge variant={extractedData.confianca === "alta" ? "default" : "secondary"}>
                  Confiança {extractedData.confianca}
                </Badge>
              </div>

              {/* Stars and Severity */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= extractedData.nota_estrelas
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  ))}
                </div>
                {isGrave ? (
                  <Badge variant="destructive">Grave</Badge>
                ) : (
                  <Badge variant="secondary">Não Grave</Badge>
                )}
              </div>

              {/* Source and Operation Type */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Fonte:</span>{" "}
                  <span className="font-medium">{FONTE_LABELS[extractedData.fonte]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Operação:</span>{" "}
                  <span className="font-medium">
                    {effectiveTipoOperacao === "delivery" ? "Delivery" : "Salão"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setManualTipoOperacao(
                      effectiveTipoOperacao === "delivery" ? "salao" : "delivery"
                    )}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Summary */}
              {extractedData.resumo && (
                <div>
                  <span className="text-xs text-muted-foreground">Resumo:</span>
                  <p className="text-sm">{extractedData.resumo}</p>
                </div>
              )}

              {/* Themes */}
              {extractedData.temas.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {extractedData.temas.map((tema, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tema}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Extracted Text Preview */}
              {extractedData.texto_reclamacao && (
                <div className="text-xs text-muted-foreground bg-background rounded p-2 max-h-20 overflow-y-auto">
                  "{extractedData.texto_reclamacao.substring(0, 200)}
                  {extractedData.texto_reclamacao.length > 200 ? "..." : ""}"
                </div>
              )}
            </div>
          )}

          {/* Required: Unidade Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Unidade <span className="text-destructive">*</span>
            </Label>
            <Select value={lojaId} onValueChange={setLojaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                {lojas.map((loja) => (
                  <SelectItem key={loja.id} value={loja.id}>
                    {loja.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date (optional, defaults to today) */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Data da Reclamação</Label>
            <Input
              type="date"
              value={dataReclamacao}
              onChange={(e) => setDataReclamacao(e.target.value)}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !lojaId || !extractedData || isProcessingAI}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Registrar Reclamação"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
