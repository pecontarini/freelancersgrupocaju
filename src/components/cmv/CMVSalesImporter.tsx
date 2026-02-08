import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useDailySales, parseCSVSales, SalesImportResult } from "@/hooks/useDailySales";

export function CMVSalesImporter() {
  const { effectiveUnidadeId } = useUnidade();
  const { importSales } = useDailySales(effectiveUnidadeId || undefined);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<SalesImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!effectiveUnidadeId) {
      setError("Selecione uma unidade antes de importar");
      return;
    }

    if (!file.name.endsWith(".csv")) {
      setError("Apenas arquivos CSV são aceitos");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCSVSales(text);

      if (rows.length === 0) {
        throw new Error("Nenhum registro válido encontrado no arquivo");
      }

      const importResult = await importSales.mutateAsync({
        unitId: effectiveUnidadeId,
        rows,
      });

      setResult(importResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatDateBR = (dateStr: string): string => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Vendas (CSV)
        </CardTitle>
        <CardDescription>
          Faça upload do relatório de vendas. O sistema agrupa itens por data e 
          usa UPSERT para evitar duplicidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragging 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-primary/50"
            }
            ${isProcessing ? "pointer-events-none opacity-50" : ""}
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
            disabled={isProcessing}
          />
          
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Processando arquivo...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Arraste o arquivo CSV aqui</p>
              <p className="text-sm text-muted-foreground">
                ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Colunas esperadas: dt_contabil, material_descr, qtd
              </p>
            </div>
          )}
        </div>

        {/* Success Result */}
        {result && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <AlertTitle>Importação Concluída</AlertTitle>
            <AlertDescription>
              <p>
                <strong>Período:</strong> {formatDateBR(result.dateRange.start)} a{" "}
                {formatDateBR(result.dateRange.end)}
              </p>
              <p className="mt-1">
                <strong>{result.inserted}</strong> novos registros criados,{" "}
                <strong>{result.updated}</strong> registros atualizados.
              </p>
              <p className="text-sm mt-1 opacity-75">
                Total processado: {result.total} itens únicos (agrupados por data)
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro na Importação</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Help Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
          <p><strong>Dica:</strong> Você pode reimportar o mesmo arquivo ou o mês inteiro para corrigir dados passados.</p>
          <p>O sistema identifica registros existentes pela combinação (Data + Item) e atualiza a quantidade.</p>
        </div>
      </CardContent>
    </Card>
  );
}
