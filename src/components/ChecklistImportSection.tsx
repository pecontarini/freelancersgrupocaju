import { useState, useRef } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExtractedData {
  global_score: number | null;
  audit_date: string | null;
  unit_name: string | null;
  failures: Array<{
    item_name: string;
    category: string | null;
  }>;
}

export function ChecklistImportSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { options: lojas } = useConfigLojas();
  const { createAudit, createFailures } = useSupervisionAudits();

  const [selectedLojaId, setSelectedLojaId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo PDF.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB.",
        variant: "destructive",
      });
      return;
    }

    setPdfFile(file);
    setExtractedData(null);
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setProgress(10);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress(30);

      // Call AI extraction edge function
      const { data, error } = await supabase.functions.invoke("process-checklist-pdf", {
        body: { pdfBase64: base64 },
      });

      setProgress(80);

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || "Falha na extração de dados");
      }

      setExtractedData(data.data);
      setProgress(100);

      toast({
        title: "PDF processado com sucesso",
        description: `Extraídos ${data.data.failures?.length || 0} itens não conformes.`,
      });
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({
        title: "Erro ao processar PDF",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!extractedData || !selectedLojaId) {
      toast({
        title: "Dados incompletos",
        description: "Selecione a unidade e processe um PDF primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);

      // Upload PDF to storage
      let pdfUrl: string | null = null;
      if (pdfFile) {
        const fileName = `${selectedLojaId}/${Date.now()}_${pdfFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("maintenance-attachments")
          .upload(fileName, pdfFile);

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from("maintenance-attachments")
            .getPublicUrl(uploadData.path);
          pdfUrl = urlData.publicUrl;
        }
      }

      // Create audit record
      const audit = await createAudit({
        loja_id: selectedLojaId,
        audit_date: extractedData.audit_date || format(new Date(), "yyyy-MM-dd"),
        global_score: extractedData.global_score || 0,
        pdf_url: pdfUrl,
        created_by: (await supabase.auth.getUser()).data.user?.id || null,
      });

      // Create failure records
      if (extractedData.failures && extractedData.failures.length > 0) {
        const failureRecords = extractedData.failures.map((failure) => ({
          audit_id: audit.id,
          loja_id: selectedLojaId,
          item_name: failure.item_name,
          category: failure.category,
          status: "pending" as const,
          is_recurring: false,
          resolution_photo_url: null,
          resolved_at: null,
          resolved_by: null,
          validated_at: null,
          validated_by: null,
        }));

        await createFailures(failureRecords);
      }

      toast({
        title: "Importação concluída",
        description: `Auditoria registrada com ${extractedData.failures?.length || 0} pendências.`,
      });

      // Reset state
      setExtractedData(null);
      setPdfFile(null);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error importing audit:", error);
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <ClipboardList className="h-5 w-5 text-primary" />
          Importar Checklist de Supervisão
        </CardTitle>
        <CardDescription>
          Faça upload de PDFs do Checklist Fácil para extração automática de dados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Store selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium uppercase">Unidade</label>
          <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
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

        {/* File upload area */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isProcessing ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex flex-col items-center gap-3">
            {isProcessing ? (
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {isProcessing ? "Processando PDF..." : "Clique ou arraste um PDF"}
              </p>
              <p className="text-sm text-muted-foreground">
                Máximo 10MB • Checklist Fácil
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progress < 30 ? "Preparando arquivo..." : progress < 80 ? "Extraindo dados com IA..." : "Finalizando..."}
            </p>
          </div>
        )}

        {/* Extracted data summary */}
        {extractedData && !isProcessing && (
          <div className="space-y-4 rounded-xl bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium uppercase text-sm">Resumo da Extração</h4>
              <Badge variant={extractedData.global_score && extractedData.global_score >= 80 ? "default" : "destructive"}>
                {extractedData.global_score !== null ? `${extractedData.global_score.toFixed(0)}%` : "N/A"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Unidade Detectada:</span>
                <p className="font-medium">{extractedData.unit_name || "Não identificada"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Data da Auditoria:</span>
                <p className="font-medium">
                  {extractedData.audit_date
                    ? format(new Date(extractedData.audit_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                    : "Não identificada"}
                </p>
              </div>
            </div>

            {/* Failures list */}
            {extractedData.failures && extractedData.failures.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="font-medium text-sm">
                    {extractedData.failures.length} Itens Não Conformes
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {extractedData.failures.map((failure, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-background rounded-lg">
                      <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{failure.item_name}</span>
                      {failure.category && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          {failure.category}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extractedData.failures?.length === 0 && (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Nenhuma não conformidade detectada</span>
              </div>
            )}

            {/* Confirm button */}
            <Button
              onClick={handleConfirmImport}
              disabled={!selectedLojaId || isProcessing}
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Importação
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
