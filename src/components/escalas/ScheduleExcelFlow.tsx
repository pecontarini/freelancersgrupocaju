import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateScheduleTemplate,
  parseScheduleFile,
  type ScheduleEmployee,
  type ParsedScheduleEntry,
  type ScheduleParseError,
} from "@/lib/scheduleExcel";
import { useUpsertSchedule } from "@/hooks/useManualSchedules";
import { useQueryClient } from "@tanstack/react-query";

interface ScheduleExcelFlowProps {
  employees: ScheduleEmployee[];
  weekDays: Date[];
  sectorName: string;
  sectorId: string;
}

export function ScheduleExcelFlow({
  employees,
  weekDays,
  sectorName,
  sectorId,
}: ScheduleExcelFlowProps) {
  const [importModal, setImportModal] = useState(false);
  const [parseResult, setParseResult] = useState<{
    entries: ParsedScheduleEntry[];
    errors: ScheduleParseError[];
    workingCount: number;
    offCount: number;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upsert = useUpsertSchedule();
  const qc = useQueryClient();

  function handleDownloadTemplate() {
    if (employees.length === 0) {
      toast.error("Nenhum funcionário no setor para gerar modelo.");
      return;
    }
    generateScheduleTemplate(employees, weekDays, sectorName);
    toast.success("Modelo baixado!");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsParsing(true);
    setImportModal(true);
    try {
      const result = await parseScheduleFile(file);
      setParseResult(result);
    } catch (err: any) {
      toast.error(err.message);
      setImportModal(false);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleConfirmImport() {
    if (!parseResult || parseResult.entries.length === 0) return;

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const entry of parseResult.entries) {
      try {
        await upsert.mutateAsync({
          employee_id: entry.employee_id,
          schedule_date: entry.date,
          sector_id: sectorId,
          start_time: entry.start_time,
          end_time: entry.end_time,
          break_duration: entry.schedule_type === "working" ? 60 : 0,
          schedule_type: entry.schedule_type,
          agreed_rate: 0,
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsSaving(false);
    setImportModal(false);
    setParseResult(null);
    qc.invalidateQueries({ queryKey: ["manual-schedules"] });

    if (errorCount === 0) {
      toast.success(`${successCount} lançamento(s) importado(s) com sucesso!`);
    } else {
      toast.warning(`${successCount} importados, ${errorCount} com erro.`);
    }
  }

  return (
    <>
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleDownloadTemplate}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Baixar Modelo</span>
          <span className="sm:hidden">Modelo</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Importar Planilha</span>
          <span className="sm:hidden">Importar</span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Import Confirmation Modal */}
      <Dialog open={importModal} onOpenChange={(o) => { if (!o && !isSaving) { setImportModal(false); setParseResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Escala via Excel
            </DialogTitle>
          </DialogHeader>

          {isParsing && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando planilha...</p>
            </div>
          )}

          {parseResult && !isParsing && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 rounded-lg border p-3 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                      {parseResult.workingCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Turnos</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/50">
                  <Badge variant="secondary" className="text-sm font-bold">
                    {parseResult.offCount}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground">Folgas</p>
                </div>
                <div className={`flex items-center gap-2 rounded-lg border p-3 ${
                  parseResult.errors.length > 0
                    ? "bg-red-50 dark:bg-red-950/20"
                    : "bg-muted/50"
                }`}>
                  {parseResult.errors.length > 0 ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className={`text-lg font-bold ${
                      parseResult.errors.length > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    }`}>
                      {parseResult.errors.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Erros</p>
                  </div>
                </div>
              </div>

              {/* Errors list */}
              {parseResult.errors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Erros encontrados (serão ignorados):
                  </p>
                  <ScrollArea className="max-h-[160px]">
                    <div className="space-y-1">
                      {parseResult.errors.map((err, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-2 text-xs"
                        >
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium">{err.employeeName}</span>
                            {err.dateLabel && <span className="text-muted-foreground"> ({err.dateLabel})</span>}
                            <span className="text-muted-foreground">: </span>
                            <span>{err.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {parseResult.entries.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum lançamento válido encontrado na planilha.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setImportModal(false); setParseResult(null); }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            {parseResult && parseResult.entries.length > 0 && (
              <Button onClick={handleConfirmImport} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar Importação ({parseResult.entries.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
