import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Loader2, X, Sparkles } from "lucide-react";
import { ImportJob, useImportJobs } from "@/hooks/useImportJobs";

interface Props {
  job: ImportJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DESTINO_LABEL: Record<string, string> = {
  store_performance: "Performance Mensal",
  store_performance_entries: "Lançamentos Diários",
  reclamacoes: "Reclamações Individuais",
};

export function ImportPreviewModal({ job, open, onOpenChange }: Props) {
  const { confirm, cancel } = useImportJobs();

  const previewRows = useMemo(() => {
    if (!job?.preview_data) return [];
    return Array.isArray(job.preview_data) ? job.preview_data.slice(0, 20) : [];
  }, [job]);

  const lojasNaoMapeadas = useMemo(() => {
    if (!job?.lojas_nao_mapeadas) return [];
    return Array.isArray(job.lojas_nao_mapeadas) ? job.lojas_nao_mapeadas : [];
  }, [job]);

  const columns = useMemo(() => {
    if (previewRows.length === 0) return [];
    return Object.keys(previewRows[0]);
  }, [previewRows]);

  if (!job) return null;

  const confianca = Math.round((job.ai_confianca || 0) * 100);
  const confiancaColor =
    confianca >= 85
      ? "text-emerald-600"
      : confianca >= 60
      ? "text-amber-600"
      : "text-destructive";

  const isProcessing = confirm.isPending || cancel.isPending;

  const handleConfirm = async () => {
    await confirm.mutateAsync(job.id);
    onOpenChange(false);
  };

  const handleCancel = async () => {
    await cancel.mutateAsync(job.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Preview da Importação IA
          </DialogTitle>
          <DialogDescription>
            Revise os dados extraídos antes de confirmar a importação
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 border-b pb-3">
          <Badge variant="outline" className="gap-1">
            Destino:{" "}
            <strong>{DESTINO_LABEL[job.tipo_destino || ""] || "—"}</strong>
          </Badge>
          <Badge variant="outline">
            {job.linhas_validas} / {job.total_linhas} linhas válidas
          </Badge>
          <Badge variant="outline" className={confiancaColor}>
            Confiança IA: {confianca}%
          </Badge>
          {job.ai_model && (
            <Badge variant="outline" className="text-muted-foreground">
              {job.ai_model}
            </Badge>
          )}
          {job.file_name && (
            <span className="text-xs text-muted-foreground truncate">
              {job.file_name}
            </span>
          )}
        </div>

        {lojasNaoMapeadas.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Lojas não mapeadas ({lojasNaoMapeadas.length})</AlertTitle>
            <AlertDescription>
              <div className="mt-1 flex flex-wrap gap-1">
                {lojasNaoMapeadas.map((loja: string, idx: number) => (
                  <Badge key={idx} variant="destructive" className="text-xs">
                    {loja}
                  </Badge>
                ))}
              </div>
              <p className="mt-2 text-xs">
                Estas linhas serão ignoradas na confirmação. Cadastre os nomes em
                <strong> Configurações → Lojas</strong> para incluí-las.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1 border rounded-md">
          {previewRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sem dados de preview disponíveis
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c} className="text-xs whitespace-nowrap">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row: any, idx: number) => (
                  <TableRow key={idx}>
                    {columns.map((c) => (
                      <TableCell key={c} className="text-xs whitespace-nowrap">
                        {row[c] === null || row[c] === undefined
                          ? "—"
                          : String(row[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {previewRows.length > 0 && job.total_linhas > previewRows.length && (
          <p className="text-xs text-muted-foreground text-center">
            Mostrando primeiras {previewRows.length} de {job.total_linhas} linhas
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            <X className="h-4 w-4 mr-1" />
            Cancelar Importação
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || job.linhas_validas === 0}
          >
            {confirm.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Confirmar Importação ({job.linhas_validas} linhas)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
