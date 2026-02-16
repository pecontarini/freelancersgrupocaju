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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarIcon,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  generateScheduleTemplate,
  parseScheduleFile,
  type ScheduleEmployee,
  type ParsedScheduleEntry,
  type ScheduleParseError,
} from "@/lib/scheduleExcel";
import { supabase } from "@/integrations/supabase/client";
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
    originalMonday: string | null;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [targetMonday, setTargetMonday] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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

    // Store file and open modal — user will pick the target week before parsing
    setPendingFile(file);
    setImportModal(true);

    // Default target to current week's monday from the weekDays prop
    const defaultMonday = weekDays.length > 0
      ? startOfWeek(weekDays[0], { weekStartsOn: 1 })
      : startOfWeek(new Date(), { weekStartsOn: 1 });
    setTargetMonday(defaultMonday);

    // Auto-parse with default target
    await runParse(file, format(defaultMonday, "yyyy-MM-dd"));
  }

  async function runParse(file: File, mondayISO: string) {
    setIsParsing(true);
    setParseResult(null);
    try {
      const result = await parseScheduleFile(file, mondayISO);
      setParseResult(result);
    } catch (err: any) {
      toast.error(err.message);
      setImportModal(false);
      setPendingFile(null);
    } finally {
      setIsParsing(false);
    }
  }

  async function handleMondayChange(date: Date | undefined) {
    if (!date) return;
    const monday = startOfWeek(date, { weekStartsOn: 1 });
    setTargetMonday(monday);
    setCalendarOpen(false);
    if (pendingFile) {
      await runParse(pendingFile, format(monday, "yyyy-MM-dd"));
    }
  }

  function closeModal() {
    if (isSaving) return;
    setImportModal(false);
    setParseResult(null);
    setPendingFile(null);
    setTargetMonday(undefined);
  }

  const showDateWarning =
    parseResult?.originalMonday &&
    targetMonday &&
    parseResult.originalMonday !== format(targetMonday, "yyyy-MM-dd");

  const originalMondayFormatted = parseResult?.originalMonday
    ? format(new Date(parseResult.originalMonday + "T12:00:00"), "dd/MM", { locale: ptBR })
    : null;
  const targetMondayFormatted = targetMonday
    ? format(targetMonday, "dd/MM", { locale: ptBR })
    : null;

  async function handleConfirmImport() {
    if (!parseResult || parseResult.entries.length === 0) return;

    setIsSaving(true);

    try {
      // 1. Find a default shift_id for the inserts
      const { data: shifts } = await supabase.from("shifts").select("id").limit(1);
      if (!shifts || shifts.length === 0) {
        toast.error("Nenhum turno cadastrado. Cadastre ao menos um turno.");
        setIsSaving(false);
        return;
      }
      const shiftId = shifts[0].id;

      // 2. Build bulk payload — dates are already pure YYYY-MM-DD strings from the parser
      const rows = parseResult.entries.map((entry) => {
        console.log(
          `[Excel Import] Salvando ${entry.employee_name} para data ${entry.date}` +
          (showDateWarning ? " (Override Ativo)" : "")
        );
        return {
          employee_id: entry.employee_id,
          user_id: entry.employee_id,
          schedule_date: entry.date, // pure YYYY-MM-DD string, no timezone
          sector_id: sectorId,
          shift_id: shiftId,
          status: "scheduled",
          schedule_type: entry.schedule_type,
          start_time: entry.start_time || null,
          end_time: entry.end_time || null,
          break_duration: entry.break_duration ?? 60,
          agreed_rate: 0,
        };
      });

      // 3. Batch insert
      const { error, data } = await supabase.from("schedules").insert(rows).select("id");

      if (error) {
        console.error("[Excel Import] Erro ao salvar escalas:", error);
        toast.error(`Erro ao salvar escalas: ${error.message}`, { duration: 8000 });
        setIsSaving(false);
        return;
      }

      const savedCount = data?.length ?? rows.length;
      console.log(`[Excel Import] ${savedCount} escalas salvas com sucesso.`);

      setIsSaving(false);
      closeModal();
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      toast.success(`${savedCount} lançamento(s) importado(s) com sucesso!`);
    } catch (err: any) {
      console.error("[Excel Import] Erro inesperado:", err);
      toast.error(`Erro inesperado: ${err?.message || "erro desconhecido"}`, { duration: 8000 });
      setIsSaving(false);
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
      <Dialog open={importModal} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importar Escala via Excel
            </DialogTitle>
          </DialogHeader>

          {/* Target week picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Data de Início (Segunda-feira)</label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !targetMonday && "text-muted-foreground"
                  )}
                  disabled={isSaving}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetMonday
                    ? `${format(targetMonday, "dd/MM/yyyy")} — ${format(addDays(targetMonday, 6), "dd/MM/yyyy")}`
                    : "Selecione a semana"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targetMonday}
                  onSelect={handleMondayChange}
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date override warning */}
          {showDateWarning && !isParsing && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-300">
                A planilha é da semana de <strong>{originalMondayFormatted}</strong>, mas as
                escalas serão salvas na semana de <strong>{targetMondayFormatted}</strong> conforme selecionado.
              </p>
            </div>
          )}

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
            <Button variant="outline" onClick={closeModal} disabled={isSaving}>
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
