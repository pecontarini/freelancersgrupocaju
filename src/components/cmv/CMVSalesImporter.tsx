import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useDailySales, parseCSVSales, parseExcelSales, SalesImportResult } from "@/hooks/useDailySales";
import { CMVImportSummaryModal } from "./CMVImportSummaryModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ACCEPTED_EXTENSIONS = [".csv", ".xls", ".xlsx"];
const ACCEPTED_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

function getFileType(file: File): "csv" | "excel" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "excel";
  return null;
}

export function CMVSalesImporter() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, isPartner } = useUserProfile();
  const { importSales } = useDailySales(effectiveUnidadeId || undefined);
  const queryClient = useQueryClient();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [result, setResult] = useState<SalesImportResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canClearSales = isAdmin || isPartner;

  const handleClearSales = async () => {
    if (!effectiveUnidadeId) return;
    setIsClearing(true);
    try {
      const { error: deleteError } = await supabase
        .from("daily_sales")
        .delete()
        .eq("unit_id", effectiveUnidadeId);
      if (deleteError) throw deleteError;
      queryClient.invalidateQueries({ queryKey: ["daily-sales"] });
      toast({ title: "Base de vendas limpa com sucesso", description: "Seus vínculos foram preservados. Pode iniciar a nova importação." });
    } catch (err) {
      toast({ title: "Erro ao limpar vendas", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" });
    } finally {
      setIsClearing(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!effectiveUnidadeId) {
      setError("Selecione uma unidade antes de importar");
      return;
    }

    const fileType = getFileType(file);
    if (!fileType) {
      setError("Formato não suportado. Aceitos: CSV, XLS, XLSX");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      let parseResult;
      
      if (fileType === "csv") {
        const text = await file.text();
        parseResult = parseCSVSales(text);
      } else {
        const buffer = await file.arrayBuffer();
        parseResult = parseExcelSales(buffer);
      }

      const importResult = await importSales.mutateAsync({
        unitId: effectiveUnidadeId,
        rows: parseResult.rows,
        parseFailures: parseResult.failures,
        totalFileLines: parseResult.totalLines,
      });

      setResult(importResult);
      setShowModal(true);
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Vendas (CSV / Excel)
          </CardTitle>
          <CardDescription>
            Faça upload do relatório de vendas. Suporta CSV, XLS e XLSX.
            Modo bruto: todas as linhas com nome de item válido são processadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              accept=".csv,.xls,.xlsx"
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
                <p className="font-medium">Arraste o arquivo aqui</p>
                <p className="text-sm text-muted-foreground">
                  ou clique para selecionar
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">CSV</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">XLS</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">XLSX</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Colunas: dt_contabil, material_descr, qtd
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <strong>Erro:</strong> {error}
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
            <p><strong>Modo Bruto:</strong> Todas as linhas com nome de item são importadas, incluindo qtd zero.</p>
            <p>Ao final, um relatório mostra exatamente quantas linhas foram processadas vs. falharam.</p>
          </div>
          {canClearSales && effectiveUnidadeId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={isClearing}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isClearing ? "Limpando..." : "Limpar Histórico de Vendas"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Atenção: Ação Irreversível</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso apagará TODAS as vendas importadas desta unidade. O cálculo do CMV será zerado.
                    Os vínculos de produtos (De-Para) SERÃO MANTIDOS. Deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearSales} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sim, apagar vendas
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      {result && (
        <CMVImportSummaryModal
          open={showModal}
          onOpenChange={setShowModal}
          result={result}
        />
      )}
    </>
  );
}
