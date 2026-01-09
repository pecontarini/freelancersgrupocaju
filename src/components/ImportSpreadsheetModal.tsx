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
import { toast } from "sonner";

import { validateAndParseFile, generateTemplate, ParsedEntry, ValidationError } from "@/lib/excelUtils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function ImportSpreadsheetModal() {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const queryClient = useQueryClient();

  const resetState = () => {
    setValidationErrors([]);
    setParsedEntries([]);
    setFileName("");
    setIsProcessing(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    setOpen(isOpen);
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
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleImport = async () => {
    if (parsedEntries.length === 0) return;

    setIsProcessing(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Add created_by to each entry
      const entriesWithUser = parsedEntries.map(entry => ({
        ...entry,
        created_by: user.id,
      }));

      const { error } = await supabase.from("freelancer_entries").insert(entriesWithUser);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["freelancer-entries"] });
      
      toast.success(`${parsedEntries.length} registros importados com sucesso!`);
      handleClose(false);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao salvar registros. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    generateTemplate();
    toast.success("Modelo baixado com sucesso!");
  };

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

          {/* Upload Area */}
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
                <p className="text-sm text-muted-foreground">Processando arquivo...</p>
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

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erros encontrados ({validationErrors.length})</AlertTitle>
              <AlertDescription>
                <ScrollArea className="mt-2 h-[120px]">
                  <ul className="space-y-1 text-xs">
                    {validationErrors.slice(0, 20).map((error, idx) => (
                      <li key={idx}>
                        <strong>Linha {error.row}</strong> - {error.field}: {error.message}
                      </li>
                    ))}
                    {validationErrors.length > 20 && (
                      <li className="text-muted-foreground">
                        ... e mais {validationErrors.length - 20} erros
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Success Preview */}
          {parsedEntries.length > 0 && (
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Pronto para importar</AlertTitle>
              <AlertDescription>
                {parsedEntries.length} registro(s) válido(s) encontrado(s).
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={parsedEntries.length === 0 || isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
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
