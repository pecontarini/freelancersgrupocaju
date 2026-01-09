import { useState, useCallback } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

import { validateAndParseFile, generateTemplate, ParsedEntry, ValidationError } from "@/lib/excelUtils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const CHUNK_SIZE = 50;

export function ImportSpreadsheetModal() {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const queryClient = useQueryClient();

  const resetState = () => {
    setValidationErrors([]);
    setParsedEntries([]);
    setFileName("");
    setIsProcessing(false);
    setIsImporting(false);
    setImportProgress({ current: 0, total: 0 });
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !isImporting) {
      resetState();
    }
    if (!isImporting) {
      setOpen(isOpen);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Formato inválido. Use arquivos .xlsx, .xls ou .csv");
      return;
    }

    setIsProcessing(true);
    setFileName(file.name);
    setValidationErrors([]);
    setParsedEntries([]);

    try {
      const { entries, errors } = await validateAndParseFile(file);
      setValidationErrors(errors);
      setParsedEntries(entries);

      if (errors.length > 0 && entries.length === 0) {
        toast.error("Todos os registros contêm erros. Corrija e tente novamente.");
      } else if (errors.length > 0) {
        toast.warning(`${entries.length} registros válidos, ${errors.length} erros encontrados.`);
      } else {
        toast.success(`${entries.length} registros prontos para importação.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao processar arquivo.");
      setValidationErrors([]);
      setParsedEntries([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = "";
  };

  const handleImport = async () => {
    if (parsedEntries.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: parsedEntries.length });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const entriesWithUser = parsedEntries.map(entry => ({
        ...entry,
        created_by: user.id,
      }));

      // Chunk the entries for bulk insert
      const chunks: typeof entriesWithUser[] = [];
      for (let i = 0; i < entriesWithUser.length; i += CHUNK_SIZE) {
        chunks.push(entriesWithUser.slice(i, i + CHUNK_SIZE));
      }

      let processedCount = 0;
      const failedChunks: { chunkIndex: number; error: string }[] = [];

      // Process chunks sequentially for progress feedback
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const { error } = await supabase
          .from("freelancer_entries")
          .insert(chunk);

        if (error) {
          failedChunks.push({ 
            chunkIndex: i, 
            error: error.message 
          });
          console.error(`Chunk ${i + 1} failed:`, error);
        } else {
          processedCount += chunk.length;
        }

        setImportProgress({ 
          current: Math.min((i + 1) * CHUNK_SIZE, parsedEntries.length), 
          total: parsedEntries.length 
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["freelancer-entries"] });

      if (failedChunks.length > 0) {
        const failedRecords = failedChunks.length * CHUNK_SIZE;
        toast.warning(
          `${processedCount} registros importados. ${failedRecords} registros falharam.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`${parsedEntries.length} registros importados com sucesso!`);
      }

      handleClose(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao salvar registros. Tente novamente.");
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const handleDownloadTemplate = () => {
    generateTemplate();
    toast.success("Modelo baixado com sucesso!");
  };

  const progressPercentage = importProgress.total > 0 
    ? Math.round((importProgress.current / importProgress.total) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha
          </DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha Excel (.xlsx) ou CSV com os lançamentos em massa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Baixar Modelo</p>
                <p className="text-xs text-muted-foreground">
                  Use o modelo com as colunas corretas
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
              Baixar
            </Button>
          </div>

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2 rounded-lg border bg-primary/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Processando registros...</span>
                <span className="text-muted-foreground">
                  {importProgress.current} de {importProgress.total}
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progressPercentage}% concluído
              </p>
            </div>
          )}

          {/* Upload Area */}
          {!isImporting && (
            <div
              className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Validando arquivo...</p>
                </div>
              ) : fileName ? (
                <div className="flex flex-col items-center gap-3">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <div className="text-center">
                    <p className="text-sm font-medium">{fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      Clique para selecionar outro arquivo
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Arraste o arquivo aqui</p>
                    <p className="text-xs text-muted-foreground">
                      ou clique para selecionar (.xlsx, .xls, .csv)
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && !isImporting && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erros encontrados ({validationErrors.length})</AlertTitle>
              <AlertDescription>
                <ScrollArea className="mt-2 h-[120px]">
                  <ul className="space-y-1 text-xs">
                    {validationErrors.slice(0, 50).map((error, idx) => (
                      <li key={idx}>
                        <strong>Linha {error.row}</strong> - {error.field}: {error.message}
                      </li>
                    ))}
                    {validationErrors.length > 50 && (
                      <li className="text-muted-foreground">
                        ... e mais {validationErrors.length - 50} erros
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Preview */}
          {parsedEntries.length > 0 && !isImporting && (
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Pronto para importar</AlertTitle>
              <AlertDescription>
                {parsedEntries.length} registro(s) válido(s) encontrado(s).
                {parsedEntries.length > CHUNK_SIZE && (
                  <span className="block mt-1 text-xs opacity-80">
                    Serão processados em lotes de {CHUNK_SIZE} registros.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={() => handleClose(false)} 
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={parsedEntries.length === 0 || isProcessing || isImporting}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {parsedEntries.length > 0 && `(${parsedEntries.length})`}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
