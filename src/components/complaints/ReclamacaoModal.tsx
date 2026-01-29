import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Upload,
  Loader2,
  MessageSquare,
  Calendar,
  Store,
  Star,
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
import { Textarea } from "@/components/ui/textarea";
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

const FONTES: { value: FonteReclamacao; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "ifood", label: "iFood" },
  { value: "tripadvisor", label: "TripAdvisor" },
  { value: "getin", label: "Get In" },
  { value: "manual", label: "Manual" },
];

export function ReclamacaoModal({ selectedLojaId, trigger }: ReclamacaoModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Form state
  const [lojaId, setLojaId] = useState(selectedLojaId || "");
  const [fonte, setFonte] = useState<FonteReclamacao>("google");
  const [tipoOperacao, setTipoOperacao] = useState<TipoOperacao>("salao");
  const [dataReclamacao, setDataReclamacao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notaReclamacao, setNotaReclamacao] = useState(3);
  const [textoOriginal, setTextoOriginal] = useState("");
  const [resumoIA, setResumoIA] = useState("");
  const [temas, setTemas] = useState<string[]>([]);
  const [anexoFile, setAnexoFile] = useState<File | null>(null);

  const { options: lojas } = useConfigLojas();
  const { createReclamacao } = useReclamacoes();

  const isGrave = notaReclamacao <= 3;

  // Process text with AI
  const processWithAI = async () => {
    if (!textoOriginal.trim()) {
      toast.error("Digite o texto da reclamação primeiro.");
      return;
    }

    setIsProcessingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-reclamacao', {
        body: { texto: textoOriginal },
      });

      if (error) throw error;

      if (data) {
        setResumoIA(data.resumo || "");
        setTemas(data.temas || []);
        if (data.tipo_operacao) {
          setTipoOperacao(data.tipo_operacao as TipoOperacao);
        }
        if (data.nota_sugerida) {
          setNotaReclamacao(data.nota_sugerida);
        }
        toast.success("Texto processado pela IA!");
      }
    } catch (err) {
      console.error("AI processing error:", err);
      toast.error("Erro ao processar com IA. Preencha manualmente.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error("Apenas imagens ou PDFs são aceitos.");
        return;
      }
      // Check size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 5MB.");
        return;
      }
      setAnexoFile(file);
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!lojaId) {
      toast.error("Selecione uma unidade.");
      return;
    }

    setIsSubmitting(true);
    try {
      let anexoUrl: string | undefined;

      // Upload attachment if present
      if (anexoFile) {
        const fileName = `${Date.now()}-${anexoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("audit-photos") // Reusing existing bucket
          .upload(`reclamacoes/${fileName}`, anexoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("audit-photos")
          .getPublicUrl(`reclamacoes/${fileName}`);

        anexoUrl = urlData.publicUrl;
      }

      await createReclamacao.mutateAsync({
        loja_id: lojaId,
        fonte,
        tipo_operacao: tipoOperacao,
        data_reclamacao: dataReclamacao,
        nota_reclamacao: notaReclamacao,
        texto_original: textoOriginal || undefined,
        resumo_ia: resumoIA || undefined,
        temas: temas.length > 0 ? temas : undefined,
        anexo_url: anexoUrl,
      });

      // Reset form
      setTextoOriginal("");
      setResumoIA("");
      setTemas([]);
      setAnexoFile(null);
      setOpen(false);
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <AlertTriangle className="h-4 w-4" />
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
            Registre uma reclamação de cliente. Os dados serão usados nos rankings e cálculos de bônus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Unidade */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              Unidade
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

          {/* Fonte e Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fonte</Label>
              <Select value={fonte} onValueChange={(v) => setFonte(v as FonteReclamacao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONTES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Operação</Label>
              <Select value={tipoOperacao} onValueChange={(v) => setTipoOperacao(v as TipoOperacao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salao">Salão</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data e Nota */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data
              </Label>
              <Input
                type="date"
                value={dataReclamacao}
                onChange={(e) => setDataReclamacao(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Nota (1-5)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={notaReclamacao}
                  onChange={(e) => setNotaReclamacao(Number(e.target.value))}
                  className="w-20"
                />
                {isGrave ? (
                  <Badge variant="destructive">Grave</Badge>
                ) : (
                  <Badge variant="secondary">Não Grave</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Texto Original */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Texto da Reclamação (opcional)
            </Label>
            <Textarea
              placeholder="Cole ou digite o texto da reclamação..."
              value={textoOriginal}
              onChange={(e) => setTextoOriginal(e.target.value)}
              rows={4}
            />
            {textoOriginal.trim() && (
              <Button
                variant="outline"
                size="sm"
                onClick={processWithAI}
                disabled={isProcessingAI}
                className="w-full"
              >
                {isProcessingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando com IA...
                  </>
                ) : (
                  "Processar com IA"
                )}
              </Button>
            )}
          </div>

          {/* AI Results */}
          {resumoIA && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Resumo IA:</Label>
              <p className="text-sm">{resumoIA}</p>
              {temas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {temas.map((tema, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tema}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Anexo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Anexo (opcional)
            </Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
            />
            {anexoFile && (
              <p className="text-xs text-muted-foreground">
                Arquivo: {anexoFile.name}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !lojaId}
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
