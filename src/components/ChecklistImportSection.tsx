import { useState, useRef, useEffect } from "react";
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2, ClipboardList, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useSupervisionAudits } from "@/hooks/useSupervisionAudits";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizeExtractedFailures, parseChecklistSpreadsheet } from "@/lib/checklistSpreadsheetParser";

interface ExtractedData {
  global_score: number | null;
  audit_date: string | null;
  unit_name: string | null;
  failures: Array<{
    item_name: string;
    category: string | null;
    detalhes_falha?: string | null;
    url_foto_evidencia?: string | null;
  }>;
}

export function ChecklistImportSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { options: lojas } = useConfigLojas();
  const { createAudit, createFailures } = useSupervisionAudits();
  const { isAdmin, isGerenteUnidade, unidades, profile } = useUserProfile();

  // For gerentes, only show their assigned stores
  const availableLojas = isAdmin ? lojas : unidades;

  const [selectedLojaId, setSelectedLojaId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Auto-select the first available store for gerentes
  useEffect(() => {
    if (isGerenteUnidade && !isAdmin && availableLojas.length > 0 && !selectedLojaId) {
      setSelectedLojaId(availableLojas[0].id);
    }
  }, [isGerenteUnidade, isAdmin, availableLojas, selectedLojaId]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf";
    const isSpreadsheet = ext === "xlsx" || ext === "xls" || ext === "csv";

    if (!isPdf && !isSpreadsheet) {
      toast({
        title: "Formato inválido",
        description: "Envie um PDF, XLSX/XLS ou CSV do Checklist Fácil.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 15MB.",
        variant: "destructive",
      });
      return;
    }

    setPdfFile(isPdf ? file : null);
    setExtractedData(null);

    if (isPdf) {
      await processPdfFile(file);
    } else {
      await processSpreadsheetFile(file);
    }
  };

  const processPdfFile = async (file: File) => {
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

      // Call AI extraction backend function
      const { data, error } = await supabase.functions.invoke("process-checklist-pdf", {
        body: { pdfBase64: base64 },
      });

      setProgress(80);

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Falha na extração de dados");

      const normalizedFailures = normalizeExtractedFailures(data.data.failures || []);
      setExtractedData({ ...data.data, failures: normalizedFailures });

      setProgress(100);
      toast({
        title: "Arquivo processado com sucesso",
        description: `Extraídos ${normalizedFailures.length} itens não conformes.`,
      });
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({
        title: "Erro ao processar arquivo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processSpreadsheetFile = async (file: File) => {
    setIsProcessing(true);
    setProgress(15);

    try {
      setProgress(35);
      const data = await parseChecklistSpreadsheet(file);
      setProgress(90);

      setExtractedData(data);
      setProgress(100);

      toast({
        title: "Planilha processada com sucesso",
        description: `Extraídos ${data.failures?.length || 0} itens não conformes.`,
      });
    } catch (error) {
      console.error("Error processing spreadsheet:", error);
      toast({
        title: "Erro ao processar planilha",
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

      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      // Create audit record
      const audit = await createAudit({
        loja_id: selectedLojaId,
        audit_date: extractedData.audit_date || format(new Date(), "yyyy-MM-dd"),
        global_score: extractedData.global_score || 0,
        pdf_url: pdfUrl,
        created_by: userId,
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
          detalhes_falha: failure.detalhes_falha || null,
          url_foto_evidencia: failure.url_foto_evidencia || null,
        }));

        await createFailures(failureRecords);
      }

      // Log the upload for admin notification (especially for gerentes)
      if (userId) {
        const uploaderRole = isAdmin ? "admin" : isGerenteUnidade ? "gerente_unidade" : "user";
        await supabase.from("audit_upload_logs").insert({
          audit_id: audit.id,
          loja_id: selectedLojaId,
          uploaded_by: userId,
          uploader_name: profile?.full_name || user?.email || "Desconhecido",
          uploader_role: uploaderRole,
          global_score: extractedData.global_score,
          failure_count: extractedData.failures?.length || 0,
        });
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
          Faça upload do PDF ou exportação CSV/XLSX do Checklist Fácil para capturar nota, comentários e evidências.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manager info alert */}
        {isGerenteUnidade && !isAdmin && (
          <Alert className="border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-muted-foreground">
              O upload será registrado com sua identificação para controle do Admin Master.
            </AlertDescription>
          </Alert>
        )}

        {/* Store selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium uppercase">Unidade</label>
          <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {availableLojas.map((loja) => (
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
            accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
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
                {isProcessing ? "Processando arquivo..." : "Clique ou arraste o arquivo"}
              </p>
              <p className="text-sm text-muted-foreground">
                PDF, CSV ou XLSX • Máximo 15MB • Checklist Fácil
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progress < 30 ? "Preparando arquivo..." : progress < 80 ? "Extraindo dados..." : "Finalizando..."}
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
              <div className="flex items-center gap-2 text-primary">
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
