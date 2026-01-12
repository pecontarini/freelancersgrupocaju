import { useState, useCallback, useMemo, useEffect } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import { validateAndParseFile, generateTemplate, ParsedEntry, ValidationError, normalizeForDatabase } from "@/lib/excelUtils";
import { mapValuesToOptions, MappingEntry, areMappingsComplete, normalizeString } from "@/lib/fuzzyMatch";
import { FunctionMappingReview } from "@/components/FunctionMappingReview";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useConfigLojas, useConfigFuncoes, useConfigGerencias } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";

const CHUNK_SIZE = 50;

type ImportStep = "upload" | "mapping" | "importing";

export function ImportSpreadsheetModal() {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [selectedLojaId, setSelectedLojaId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<ImportStep>("upload");
  
  // Mapping states
  const [funcaoMappings, setFuncaoMappings] = useState<MappingEntry[]>([]);
  const [gerenciaMappings, setGerenciaMappings] = useState<MappingEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"funcao" | "gerencia">("funcao");

  const queryClient = useQueryClient();
  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();
  const { options: funcoes } = useConfigFuncoes();
  const { options: gerencias } = useConfigGerencias();
  const { isAdmin, unidades, isGerenteUnidade } = useUserProfile();

  // For gerente with single store, use that store
  const singleUnidade = isGerenteUnidade && !isAdmin && unidades.length === 1 ? unidades[0] : null;
  // Available lojas for selection
  const availableLojas = isAdmin ? lojas : (isGerenteUnidade ? unidades : []);

  // Set default loja for gerente_unidade with single store
  const effectiveLojaId = singleUnidade ? singleUnidade.id : selectedLojaId;
  const effectiveLojaName = singleUnidade 
    ? singleUnidade.nome 
    : availableLojas.find(l => l.id === selectedLojaId)?.nome || "";

  // Check if all mappings are complete
  const isFuncaoMappingComplete = useMemo(
    () => areMappingsComplete(funcaoMappings),
    [funcaoMappings]
  );
  const isGerenciaMappingComplete = useMemo(
    () => areMappingsComplete(gerenciaMappings),
    [gerenciaMappings]
  );
  const isMappingComplete = isFuncaoMappingComplete && isGerenciaMappingComplete;

  // Count items needing review
  const funcaoReviewCount = useMemo(
    () => funcaoMappings.filter(m => m.needsReview && !m.selectedMatchId).length,
    [funcaoMappings]
  );
  const gerenciaReviewCount = useMemo(
    () => gerenciaMappings.filter(m => m.needsReview && !m.selectedMatchId).length,
    [gerenciaMappings]
  );
  const hasItemsNeedingReview = funcaoReviewCount > 0 || gerenciaReviewCount > 0;

  const resetState = () => {
    setValidationErrors([]);
    setParsedEntries([]);
    setFileName("");
    setIsProcessing(false);
    setIsImporting(false);
    setImportProgress({ current: 0, total: 0 });
    setCurrentStep("upload");
    setFuncaoMappings([]);
    setGerenciaMappings([]);
    setActiveTab("funcao");
    if (!singleUnidade) {
      setSelectedLojaId("");
    }
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
        toast.success(`${entries.length} registros prontos para validação.`);
      }

      // If we have valid entries, create mappings
      if (entries.length > 0) {
        // Create funcao mappings
        const funcaoValues = entries.map((entry, idx) => ({
          rowIndex: idx,
          value: entry.funcao,
        }));
        const funcaoMap = mapValuesToOptions(funcaoValues, funcoes);
        setFuncaoMappings(funcaoMap);

        // Create gerencia mappings
        const gerenciaValues = entries.map((entry, idx) => ({
          rowIndex: idx,
          value: entry.gerencia,
        }));
        const gerenciaMap = mapValuesToOptions(gerenciaValues, gerencias);
        setGerenciaMappings(gerenciaMap);
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
  }, [funcoes, gerencias]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = "";
  };

  const handleFuncaoMappingChange = useCallback((
    rowIndex: number,
    selectedId: string,
    selectedName: string
  ) => {
    setFuncaoMappings(prev => prev.map(m => {
      // Update all rows with same normalized value
      const currentNormalized = normalizeString(m.original);
      const targetNormalized = normalizeString(
        prev.find(p => p.rowIndex === rowIndex)?.original || ""
      );
      
      if (currentNormalized === targetNormalized) {
        return {
          ...m,
          selectedMatchId: selectedId,
          selectedMatch: selectedName,
          needsReview: false,
        };
      }
      return m;
    }));
  }, []);

  const handleGerenciaMappingChange = useCallback((
    rowIndex: number,
    selectedId: string,
    selectedName: string
  ) => {
    setGerenciaMappings(prev => prev.map(m => {
      const currentNormalized = normalizeString(m.original);
      const targetNormalized = normalizeString(
        prev.find(p => p.rowIndex === rowIndex)?.original || ""
      );
      
      if (currentNormalized === targetNormalized) {
        return {
          ...m,
          selectedMatchId: selectedId,
          selectedMatch: selectedName,
          needsReview: false,
        };
      }
      return m;
    }));
  }, []);

  const handleProceedToMapping = () => {
    if (!effectiveLojaId) {
      toast.error("Selecione uma loja para importar os registros.");
      return;
    }
    
    // Check if mapping is needed
    if (!hasItemsNeedingReview && isMappingComplete) {
      // All items mapped automatically, skip to import
      handleImport();
    } else {
      setCurrentStep("mapping");
    }
  };

  const handleBackToUpload = () => {
    setCurrentStep("upload");
  };

  const handleImport = async () => {
    if (parsedEntries.length === 0) return;
    
    if (!effectiveLojaId) {
      toast.error("Selecione uma loja para importar os registros.");
      return;
    }

    if (!isMappingComplete) {
      toast.error("Mapeie todas as funções e gerências antes de importar.");
      return;
    }

    setIsImporting(true);
    setCurrentStep("importing");
    setImportProgress({ current: 0, total: parsedEntries.length });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Apply mappings and normalize values
      const entriesWithMappings = parsedEntries.map((entry, idx) => {
        const funcaoMapping = funcaoMappings.find(m => m.rowIndex === idx);
        const gerenciaMapping = gerenciaMappings.find(m => m.rowIndex === idx);

        return {
          ...entry,
          // Use the official system name (normalized/uppercase)
          funcao: normalizeForDatabase(funcaoMapping?.selectedMatch || entry.funcao),
          gerencia: normalizeForDatabase(gerenciaMapping?.selectedMatch || entry.gerencia),
          created_by: user.id,
          loja_id: effectiveLojaId,
          loja: effectiveLojaName || entry.loja,
        };
      });

      // Chunk the entries for bulk insert
      const chunks: typeof entriesWithMappings[] = [];
      for (let i = 0; i < entriesWithMappings.length; i += CHUNK_SIZE) {
        chunks.push(entriesWithMappings.slice(i, i + CHUNK_SIZE));
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
    const funcaoNames = funcoes.map(f => f.nome);
    const gerenciaNames = gerencias.map(g => g.nome);
    generateTemplate(funcaoNames, gerenciaNames);
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Planilha
            {currentStep === "mapping" && " - Revisão de Mapeamento"}
            {currentStep === "importing" && " - Importando"}
          </DialogTitle>
          <DialogDescription>
            {currentStep === "upload" && "Faça upload de uma planilha Excel (.xlsx) ou CSV com os lançamentos em massa."}
            {currentStep === "mapping" && "Revise e corrija o mapeamento de funções e gerências antes de importar."}
            {currentStep === "importing" && "Aguarde enquanto os registros são importados."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Step: Upload */}
          {currentStep === "upload" && (
            <>
              {/* Download Template */}
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Baixar Modelo</p>
                    <p className="text-xs text-muted-foreground">
                      Inclui lista de funções e gerências oficiais
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
                  Baixar
                </Button>
              </div>

              {/* Loja Selection */}
              {!singleUnidade && (
                <div className="space-y-2">
                  <Label>Loja para importação</Label>
                  <Select 
                    value={selectedLojaId} 
                    onValueChange={setSelectedLojaId}
                    disabled={isLoadingLojas}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingLojas ? "Carregando..." : "Selecione a loja"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLojas.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Todos os registros serão vinculados a esta loja.
                  </p>
                </div>
              )}

              {/* Show selected unidade for gerente with single store */}
              {singleUnidade && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    Importando para: <span className="font-medium text-foreground">{singleUnidade.nome}</span>
                  </p>
                </div>
              )}

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

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
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
              {parsedEntries.length > 0 && (
                <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Arquivo processado</AlertTitle>
                  <AlertDescription>
                    {parsedEntries.length} registro(s) válido(s) encontrado(s).
                    {hasItemsNeedingReview && (
                      <span className="block mt-1 text-xs opacity-80">
                        ⚠️ Algumas funções/gerências precisam de mapeamento manual.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Step: Mapping */}
          {currentStep === "mapping" && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "funcao" | "gerencia")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="funcao" className="gap-2">
                  Funções
                  {funcaoReviewCount > 0 && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                      {funcaoReviewCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="gerencia" className="gap-2">
                  Gerências
                  {gerenciaReviewCount > 0 && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                      {gerenciaReviewCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="funcao" className="mt-4">
                <FunctionMappingReview
                  mappings={funcaoMappings}
                  options={funcoes}
                  onMappingChange={handleFuncaoMappingChange}
                  fieldLabel="Função"
                />
              </TabsContent>
              <TabsContent value="gerencia" className="mt-4">
                <FunctionMappingReview
                  mappings={gerenciaMappings}
                  options={gerencias}
                  onMappingChange={handleGerenciaMappingChange}
                  fieldLabel="Gerência"
                />
              </TabsContent>
            </Tabs>
          )}

          {/* Step: Importing */}
          {currentStep === "importing" && (
            <div className="space-y-4 py-8">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <p className="text-lg font-medium">Importando registros...</p>
                  <p className="text-sm text-muted-foreground">
                    {importProgress.current} de {importProgress.total}
                  </p>
                </div>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progressPercentage}% concluído
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {currentStep !== "importing" && (
          <div className="flex justify-between gap-3 pt-4 border-t">
            {currentStep === "mapping" ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleBackToUpload}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => handleClose(false)} 
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!isMappingComplete}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Confirmar e Salvar ({parsedEntries.length})
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => handleClose(false)} 
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleProceedToMapping}
                  disabled={parsedEntries.length === 0 || isProcessing || !effectiveLojaId}
                  className="gap-2"
                >
                  {hasItemsNeedingReview ? (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Revisar Mapeamento
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Importar ({parsedEntries.length})
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
