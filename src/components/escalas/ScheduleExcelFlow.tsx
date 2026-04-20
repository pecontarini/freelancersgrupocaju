import { useState, useRef, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  UserX,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  generateScheduleTemplate,
  generateMultiSectorTemplate,
  parseScheduleFile,
  type ScheduleEmployee,
  type MultiSectorParseResult,
  type UnmatchedEmployee,
  type SectorInfo,
  type SectorJobTitleMapping,
} from "@/lib/scheduleExcel";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UnmatchedRegistration {
  selected: boolean;
  editedName: string;
  cargo: string;
}

interface ScheduleExcelFlowProps {
  employees: ScheduleEmployee[];
  weekDays: Date[];
  sectorName: string;
  sectorId: string;
  unitName?: string;
  unitId?: string;
  /** All employees in the unit, used for fuzzy-matching external spreadsheets */
  allUnitEmployees?: ScheduleEmployee[];
  /** All sectors in the unit — needed for multi-sector template */
  sectors?: SectorInfo[];
  /** Sector↔job_title mappings — needed for multi-sector template */
  sectorJobTitles?: SectorJobTitleMapping[];
}

export function ScheduleExcelFlow({
  employees,
  weekDays,
  sectorName,
  sectorId,
  unitName,
  unitId,
  allUnitEmployees,
  sectors,
  sectorJobTitles,
}: ScheduleExcelFlowProps) {
  const [importModal, setImportModal] = useState(false);
  const [parseResult, setParseResult] = useState<MultiSectorParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [targetMonday, setTargetMonday] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [unmatchedRegs, setUnmatchedRegs] = useState<UnmatchedRegistration[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  function handleDownloadSingleSector() {
    generateScheduleTemplate(employees, weekDays, sectorName, unitName);
    toast.success("Modelo baixado!");
  }

  function handleDownloadAllSectors() {
    if (!sectors?.length || !allUnitEmployees?.length || !sectorJobTitles) {
      toast.error("Dados de setores não disponíveis.");
      return;
    }
    generateMultiSectorTemplate(sectors, allUnitEmployees, sectorJobTitles, weekDays, unitName);
    toast.success("Modelo multi-setor baixado!");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setPendingFile(file);
    setImportModal(true);

    const defaultMonday =
      weekDays.length > 0
        ? startOfWeek(weekDays[0], { weekStartsOn: 1 })
        : startOfWeek(new Date(), { weekStartsOn: 1 });
    setTargetMonday(defaultMonday);

    await runParse(file, format(defaultMonday, "yyyy-MM-dd"));
  }

  async function runParse(file: File, mondayISO: string) {
    setIsParsing(true);
    setParseResult(null);
    setUnmatchedRegs([]);
    try {
      const allEmps = allUnitEmployees || employees;
      const result = await parseScheduleFile(file, mondayISO, allEmps);
      setParseResult(result);
      // Initialize registration state for unmatched employees
      setUnmatchedRegs(
        (result.unmatchedEmployees || []).map((u) => ({
          selected: true,
          editedName: u.name,
          cargo: u.cargo || "",
        }))
      );
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
    setUnmatchedRegs([]);
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

  const selectedUnmatchedCount = unmatchedRegs.filter((r) => r.selected).length;

  async function registerUnmatchedEmployees(): Promise<ScheduleEmployee[]> {
    if (!unitId) return [];
    const toRegister = unmatchedRegs.filter((r) => r.selected && r.editedName.trim());
    if (toRegister.length === 0) return [];

    const newEmployees: ScheduleEmployee[] = [];

    for (const reg of toRegister) {
      const cleanName = reg.editedName.trim();
      const cleanCargo = reg.cargo.trim();

      // Defensive lookup: reuse existing active employee with the same name in this unit
      // to avoid creating homonyms that later trigger unique_active_schedule conflicts.
      const { data: existingEmp } = await supabase
        .from("employees")
        .select("id, name, job_title, worker_type")
        .eq("unit_id", unitId)
        .eq("active", true)
        .ilike("name", cleanName)
        .order("created_at", { ascending: true })
        .limit(1);

      if (existingEmp && existingEmp.length > 0) {
        const e = existingEmp[0];
        newEmployees.push({
          id: e.id,
          name: e.name,
          job_title: e.job_title,
          worker_type: e.worker_type,
        });
        continue;
      }

      let jobTitleId: string | null = null;

      if (cleanCargo) {
        // Try to find existing job_title for this unit
        const { data: existing } = await supabase
          .from("job_titles")
          .select("id")
          .eq("unit_id", unitId)
          .ilike("name", cleanCargo)
          .limit(1);

        if (existing && existing.length > 0) {
          jobTitleId = existing[0].id;
        } else {
          // Create new job_title
          const { data: newJt } = await supabase
            .from("job_titles")
            .insert({ name: cleanCargo, unit_id: unitId })
            .select("id")
            .single();
          if (newJt) jobTitleId = newJt.id;
        }
      }

      const { data: newEmp, error: empErr } = await supabase
        .from("employees")
        .insert({
          name: cleanName,
          unit_id: unitId,
          job_title: cleanCargo || null,
          job_title_id: jobTitleId,
          gender: "M",
          worker_type: "clt" as const,
        })
        .select("id, name, job_title, worker_type")
        .single();

      if (empErr) {
        // unique_active_employee_no_cpf race: someone else just created it → re-fetch
        const { data: raceEmp } = await supabase
          .from("employees")
          .select("id, name, job_title, worker_type")
          .eq("unit_id", unitId)
          .eq("active", true)
          .ilike("name", cleanName)
          .order("created_at", { ascending: true })
          .limit(1);
        if (raceEmp && raceEmp.length > 0) {
          newEmployees.push({
            id: raceEmp[0].id,
            name: raceEmp[0].name,
            job_title: raceEmp[0].job_title,
            worker_type: raceEmp[0].worker_type,
          });
          continue;
        }
        console.error("[Excel Import] Falha ao cadastrar funcionário:", empErr);
        continue;
      }

      if (newEmp) {
        newEmployees.push({
          id: newEmp.id,
          name: newEmp.name,
          job_title: newEmp.job_title,
          worker_type: newEmp.worker_type,
        });
      }
    }

    return newEmployees;
  }

  async function handleConfirmImport() {
    if (!parseResult) return;

    setIsSaving(true);

    try {
      // Step 1: Register selected unmatched employees
      let finalParseResult = parseResult;
      if (selectedUnmatchedCount > 0 && pendingFile && targetMonday) {
        const newEmps = await registerUnmatchedEmployees();
        if (newEmps.length > 0) {
          toast.success(`${newEmps.length} funcionário(s) cadastrado(s)!`);
          // Re-parse with updated employee list
          const allEmps = [...(allUnitEmployees || employees), ...newEmps];
          const mondayISO = format(targetMonday, "yyyy-MM-dd");
          const reParsed = await parseScheduleFile(pendingFile, mondayISO, allEmps);
          finalParseResult = reParsed;
          // Invalidate employees cache
          qc.invalidateQueries({ queryKey: ["employees"] });
        }
      }

      if (finalParseResult.entries.length === 0) {
        toast.info("Nenhum lançamento válido após o cadastro.");
        setIsSaving(false);
        return;
      }

      const { data: shifts } = await supabase.from("shifts").select("id").limit(1);
      if (!shifts || shifts.length === 0) {
        toast.error("Nenhum turno cadastrado. Cadastre ao menos um turno.");
        setIsSaving(false);
        return;
      }
      const shiftId = shifts[0].id;

      const employeeIds = [...new Set(finalParseResult.entries.map((e) => e.employee_id))];
      const { data: empData } = await supabase
        .from("employees")
        .select("id, job_title_id")
        .in("id", employeeIds);

      const empJobTitleMap = new Map<string, string>();
      for (const emp of empData || []) {
        if (emp.job_title_id) empJobTitleMap.set(emp.id, emp.job_title_id);
      }

      const jobTitleIds = [...new Set(Array.from(empJobTitleMap.values()))];
      const { data: sjtData } = await supabase
        .from("sector_job_titles")
        .select("job_title_id, sector_id")
        .in("job_title_id", jobTitleIds.length > 0 ? jobTitleIds : ["__none__"]);

      const jobTitleToSector = new Map<string, string>();
      for (const sjt of sjtData || []) {
        if (!jobTitleToSector.has(sjt.job_title_id)) {
          jobTitleToSector.set(sjt.job_title_id, sjt.sector_id);
        }
      }

      const rows = finalParseResult.entries.map((entry) => {
        const jtId = empJobTitleMap.get(entry.employee_id);
        // If the entry has a sector_id from multi-sector parse, use it
        const resolvedSectorId = entry.sector_id || (jtId ? jobTitleToSector.get(jtId) || sectorId : sectorId);

        return {
          employee_id: entry.employee_id,
          user_id: entry.employee_id,
          schedule_date: entry.date,
          sector_id: resolvedSectorId,
          shift_id: shiftId,
          status: "scheduled",
          schedule_type: entry.schedule_type,
          start_time: entry.start_time || null,
          end_time: entry.end_time || null,
          break_duration: entry.break_duration ?? 60,
          agreed_rate: 0,
        };
      });

      // 1) Dedup intra-batch: collapse duplicate (employee, date, sector) within the spreadsheet itself
      const intraBatchMap = new Map<string, typeof rows[number]>();
      for (const r of rows) {
        const key = `${r.employee_id}|${r.schedule_date}|${r.sector_id}`;
        // prefer 'working' over 'off' if conflict
        const prev = intraBatchMap.get(key);
        if (!prev || (prev.schedule_type === "off" && r.schedule_type === "working")) {
          intraBatchMap.set(key, r);
        }
      }
      let dedupedRows = Array.from(intraBatchMap.values());
      const intraBatchCollapsed = rows.length - dedupedRows.length;

      // 1b) Dedup by (employee_id, date) IGNORING sector — same person can only be
      // in ONE sector on the same day. Keeps first occurrence (or 'working' over 'off').
      const empDayMap = new Map<string, typeof dedupedRows[number]>();
      for (const r of dedupedRows) {
        const key = `${r.employee_id}|${r.schedule_date}`;
        const prev = empDayMap.get(key);
        if (!prev || (prev.schedule_type === "off" && r.schedule_type === "working")) {
          empDayMap.set(key, r);
        }
      }
      const beforeEmpDay = dedupedRows.length;
      dedupedRows = Array.from(empDayMap.values());
      const empDayCollapsed = beforeEmpDay - dedupedRows.length;

      const totalCollapsed = intraBatchCollapsed + empDayCollapsed;
      if (totalCollapsed > 0) {
        toast.info(
          `${totalCollapsed} linha(s) unificada(s) (mesmo funcionário em múltiplos setores/horários no mesmo dia).`
        );
      }

      // 2) Dedup vs DB: load all active schedules for these employees in this date range,
      // and filter by BOTH (employee|date|sector) AND (employee|date) — same person should
      // not be scheduled in two sectors on the same day.
      const uniqueDates = [...new Set(dedupedRows.map((r) => r.schedule_date))].sort();
      const uniqueEmpIds = [...new Set(dedupedRows.map((r) => r.employee_id))];

      const loadExistingKeys = async () => {
        const { data: existingSchedules } = await supabase
          .from("schedules")
          .select("employee_id, schedule_date, sector_id")
          .in("employee_id", uniqueEmpIds)
          .gte("schedule_date", uniqueDates[0])
          .lte("schedule_date", uniqueDates[uniqueDates.length - 1])
          .neq("status", "cancelled");
        const tripleKeys = new Set<string>();
        const dayKeys = new Set<string>();
        for (const s of existingSchedules || []) {
          tripleKeys.add(`${s.employee_id}|${s.schedule_date}|${s.sector_id}`);
          dayKeys.add(`${s.employee_id}|${s.schedule_date}`);
        }
        return { tripleKeys, dayKeys };
      };

      let { tripleKeys, dayKeys } = await loadExistingKeys();

      const filterNewRows = (
        rows: typeof dedupedRows,
        tk: Set<string>,
        dk: Set<string>
      ) =>
        rows.filter(
          (r) =>
            !tk.has(`${r.employee_id}|${r.schedule_date}|${r.sector_id}`) &&
            !dk.has(`${r.employee_id}|${r.schedule_date}`)
        );

      let newRows = filterNewRows(dedupedRows, tripleKeys, dayKeys);
      let ignoredCount = dedupedRows.length - newRows.length;

      if (newRows.length === 0) {
        toast.warning(
          ignoredCount > 0
            ? `Todas as ${ignoredCount} escalas já existem. Nenhuma nova inserida.`
            : "Nenhuma escala para importar."
        );
        setIsSaving(false);
        return;
      }

      // 3) INSERT puro (dedup completa já feita no front). Se mesmo assim cair em
      // conflito (race condition), tentamos refazer 1 vez com SELECT atualizado.
      const tryInsert = async (rows: typeof newRows) => {
        return await supabase.from("schedules").insert(rows).select("id");
      };

      let { error, data } = await tryInsert(newRows);
      let conflictResolved = 0;

      if (error && ((error as any).code === "23505" || error.message?.includes("unique_active_schedule"))) {
        console.warn("[Excel Import] Conflito 23505 detectado, recarregando estado e tentando novamente…", error);
        const refreshed = await loadExistingKeys();
        tripleKeys = refreshed.tripleKeys;
        dayKeys = refreshed.dayKeys;
        const beforeRetry = newRows.length;
        newRows = filterNewRows(newRows, tripleKeys, dayKeys);
        conflictResolved = beforeRetry - newRows.length;
        ignoredCount += conflictResolved;
        if (newRows.length > 0) {
          ({ error, data } = await tryInsert(newRows));
        } else {
          error = null;
          data = [];
        }
      }

      if (error) {
        console.error("[Excel Import] Erro ao salvar escalas:", error);
        const isUnique =
          error.message?.includes("unique_active_schedule") || (error as any).code === "23505";
        if (isUnique) {
          // Parse up to 5 conflicts from error.details — Postgres format: Key (employee_id, schedule_date, sector_id)=(uuid, date, uuid)
          const details = (error as any).details || error.message || "";
          const matches = [...String(details).matchAll(/\(([0-9a-f-]+),\s*(\d{4}-\d{2}-\d{2}),\s*([0-9a-f-]+)\)/gi)];
          const empList = allUnitEmployees || employees;
          const conflictLines = matches.slice(0, 5).map(([, eid, dt]) => {
            const empName = empList.find((e) => e.id === eid)?.name || eid.slice(0, 8);
            const dtFormatted = format(new Date(dt + "T12:00:00"), "dd/MM");
            return `• ${empName} em ${dtFormatted}`;
          });
          const conflictMsg = conflictLines.length
            ? `Conflitos detectados:\n${conflictLines.join("\n")}\n\nUse "Zerar Escalas" para limpar a semana antes de reimportar.`
            : `Conflito de escala. Use "Zerar Escalas" antes de reimportar, ou ajuste no editor.`;
          toast.error(conflictMsg, { duration: 12000 });
        } else {
          toast.error(`Erro ao salvar escalas: ${error.message}`, { duration: 8000 });
        }
        setIsSaving(false);
        return;
      }

      const savedCount = data?.length ?? newRows.length;

      setIsSaving(false);
      closeModal();
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });

      const parts = [`${savedCount} importado(s)`];
      if (ignoredCount > 0) parts.push(`${ignoredCount} já existia(m)`);
      if (conflictResolved > 0) parts.push(`${conflictResolved} conflito(s) resolvido(s)`);
      toast.success(parts.join(" · "));
    } catch (err: any) {
      console.error("[Excel Import] Erro inesperado:", err);
      toast.error(`Erro inesperado: ${err?.message || "erro desconhecido"}`, { duration: 8000 });
      setIsSaving(false);
    }
  }

  const hasUnmatched = (parseResult?.unmatchedEmployees?.length ?? 0) > 0;
  const canConfirm = parseResult && (parseResult.entries.length > 0 || selectedUnmatchedCount > 0);

  return (
    <>
      <div className="flex gap-1.5">
        {sectors && sectors.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Baixar Modelo</span>
                <span className="sm:hidden">Modelo</span>
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleDownloadSingleSector}>
                Só este setor ({sectorName})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadAllSectors}>
                Todos os setores
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleDownloadSingleSector}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Baixar Modelo</span>
            <span className="sm:hidden">Modelo</span>
          </Button>
        )}
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

              {/* Unmatched employees — interactive registration */}
              {hasUnmatched && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <UserPlus className="h-4 w-4" />
                      Funcionários não encontrados ({parseResult.unmatchedEmployees.length})
                    </p>
                    {unitId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => {
                          const allSelected = unmatchedRegs.every((r) => r.selected);
                          setUnmatchedRegs((prev) =>
                            prev.map((r) => ({ ...r, selected: !allSelected }))
                          );
                        }}
                      >
                        {unmatchedRegs.every((r) => r.selected) ? "Desmarcar todos" : "Marcar todos"}
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="max-h-[160px]">
                    <div className="space-y-1.5">
                      {parseResult.unmatchedEmployees.map((u, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-50/50 dark:bg-amber-950/10 p-2 text-xs"
                        >
                          {unitId && (
                            <Checkbox
                              checked={unmatchedRegs[i]?.selected ?? false}
                              onCheckedChange={(checked) => {
                                setUnmatchedRegs((prev) =>
                                  prev.map((r, idx) =>
                                    idx === i ? { ...r, selected: !!checked } : r
                                  )
                                );
                              }}
                              disabled={isSaving}
                            />
                          )}
                          <Input
                            value={unmatchedRegs[i]?.editedName ?? u.name}
                            onChange={(e) => {
                              setUnmatchedRegs((prev) =>
                                prev.map((r, idx) =>
                                  idx === i ? { ...r, editedName: e.target.value } : r
                                )
                              );
                            }}
                            className="h-6 text-xs flex-1 min-w-0"
                            disabled={isSaving || !(unmatchedRegs[i]?.selected)}
                          />
                          {u.cargo && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {u.cargo}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-[11px] text-muted-foreground">
                    {unitId
                      ? `Marque para cadastrar automaticamente. ${selectedUnmatchedCount} selecionado(s).`
                      : "Selecione uma unidade para poder cadastrar automaticamente."}
                  </p>
                </div>
              )}

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

              {parseResult.entries.length === 0 && !hasUnmatched && (
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
            {canConfirm && (
              <Button onClick={handleConfirmImport} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {selectedUnmatchedCount > 0
                  ? `Cadastrar (${selectedUnmatchedCount}) e Importar`
                  : `Confirmar Importação (${parseResult?.entries.length || 0})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
