import { useState, useRef, useCallback, useMemo } from "react";
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
  normalizeCpf,
  type ScheduleEmployee,
  type MultiSectorParseResult,
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
import {
  UnmatchedReviewDialog,
  type ReviewDecision,
} from "./UnmatchedReviewDialog";



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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDecisions, setReviewDecisions] = useState<ReviewDecision[] | null>(null);
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
    setReviewDecisions(null);
    try {
      const allEmps = allUnitEmployees || employees;
      const result = await parseScheduleFile(file, mondayISO, allEmps);
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
    setReviewDecisions(null);
    setReviewOpen(false);
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

  const unmatchedList = useMemo(
    () => parseResult?.unmatchedEmployees || [],
    [parseResult]
  );
  const hasUnmatched = unmatchedList.length > 0;
  const needsReview = hasUnmatched && !reviewDecisions;

  /**
   * Apply gestor's review decisions: link existing employees, create new ones (with explicit
   * gender + worker_type), or reactivate inactive matches by CPF. Returns a map: rowIndex → employee.
   * NO silent ghost creation. Decisions with action="ignore" are skipped entirely.
   */
  async function applyReviewDecisions(
    decisions: ReviewDecision[]
  ): Promise<Map<number, ScheduleEmployee>> {
    const resolved = new Map<number, ScheduleEmployee>();
    if (!unitId) return resolved;
    const existing = allUnitEmployees || employees;

    for (const d of decisions) {
      if (d.action === "ignore") continue;

      if (d.action === "link" && d.linkEmployeeId) {
        const emp = existing.find((e) => e.id === d.linkEmployeeId);
        if (emp) {
          resolved.set(d.rowIndex, emp);
        } else {
          const { data } = await supabase
            .from("employees")
            .select("id, name, job_title, worker_type, cpf")
            .eq("id", d.linkEmployeeId)
            .maybeSingle();
          if (data) resolved.set(d.rowIndex, data as ScheduleEmployee);
        }
        continue;
      }

      if (d.action === "create") {
        const cleanName = (d.newName || "").trim();
        const cleanCargo = (d.newCargo || "").trim();
        const cleanCpf = normalizeCpf(d.newCpf);
        if (!cleanName || !d.newGender || !d.newWorkerType) continue;

        // Reactivate inactive existing record (matched by CPF in the dialog)
        if (d.reactivateEmployeeId) {
          const { data: react, error: reactErr } = await supabase
            .from("employees")
            .update({ active: true, name: cleanName, job_title: cleanCargo || null })
            .eq("id", d.reactivateEmployeeId)
            .select("id, name, job_title, worker_type, cpf")
            .maybeSingle();
          if (!reactErr && react) {
            resolved.set(d.rowIndex, react as ScheduleEmployee);
            continue;
          }
          console.warn("[Excel Import] Falha ao reativar:", reactErr);
        }

        // Resolve / create job_title
        let jobTitleId: string | null = null;
        if (cleanCargo) {
          const { data: jt } = await supabase
            .from("job_titles")
            .select("id")
            .eq("unit_id", unitId)
            .ilike("name", cleanCargo)
            .limit(1);
          if (jt && jt.length > 0) jobTitleId = jt[0].id;
          else {
            const { data: newJt } = await supabase
              .from("job_titles")
              .insert({ name: cleanCargo, unit_id: unitId })
              .select("id")
              .single();
            if (newJt) jobTitleId = newJt.id;
          }
        }

        const insertPayload: any = {
          name: cleanName,
          unit_id: unitId,
          job_title: cleanCargo || null,
          job_title_id: jobTitleId,
          gender: d.newGender,
          worker_type: d.newWorkerType,
        };
        if (cleanCpf) insertPayload.cpf = cleanCpf;

        const { data: newEmp, error: empErr } = await supabase
          .from("employees")
          .insert(insertPayload)
          .select("id, name, job_title, worker_type, cpf")
          .single();

        if (empErr) {
          console.error("[Excel Import] Falha ao cadastrar:", empErr);
          toast.error(`Erro ao cadastrar ${cleanName}: ${empErr.message}`);
          continue;
        }
        if (newEmp) resolved.set(d.rowIndex, newEmp as ScheduleEmployee);
      }
    }
    return resolved;
  }



  /**
   * Cancel all active schedules in the target week for this unit, then re-run the import.
   * Triggered from the conflict toast action so the user has a one-click recovery path.
   */
  const clearWeekAndReimport = useCallback(async () => {
    if (!unitId || !targetMonday) {
      toast.error("Não foi possível identificar unidade/semana para zerar.");
      return;
    }
    const startStr = format(startOfWeek(targetMonday, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const endStr = format(addDays(startOfWeek(targetMonday, { weekStartsOn: 1 }), 6), "yyyy-MM-dd");
    try {
      // Resolve sectors for this unit so the cancel only targets the right sector_ids
      const { data: sectorRows, error: secErr } = await supabase
        .from("sectors")
        .select("id")
        .eq("unit_id", unitId);
      if (secErr) throw secErr;
      const sectorIds = (sectorRows || []).map((s) => s.id);
      if (sectorIds.length === 0) {
        toast.warning("Nenhum setor encontrado nesta unidade.");
        return;
      }
      const { error: updErr } = await supabase
        .from("schedules")
        .update({ status: "cancelled" })
        .in("sector_id", sectorIds)
        .gte("schedule_date", startStr)
        .lte("schedule_date", endStr)
        .neq("status", "cancelled");
      if (updErr) throw updErr;
      toast.success("Semana zerada. Reiniciando importação…");
      qc.invalidateQueries({ queryKey: ["manual-schedules"] });
      // Re-run the same import with the same parsed file
      await handleConfirmImport();
    } catch (err: any) {
      console.error("[Excel Import] Falha ao zerar semana:", err);
      toast.error(`Não foi possível zerar a semana: ${err?.message || err}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, targetMonday, qc]);

  async function handleConfirmImport() {
    if (!parseResult) return;

    // If unmatched rows exist and the gestor hasn't decided yet → open review modal and STOP.
    if (needsReview) {
      setReviewOpen(true);
      return;
    }

    setIsSaving(true);

    // Manual decision tallies for the final toast
    let linkedManuallyCount = 0;
    let createdManuallyCount = 0;
    let ignoredManuallyCount = 0;

    try {
      let finalParseResult = parseResult;

      // Step 1: Apply gestor's decisions (link / create / ignore) → resolve employees
      if (reviewDecisions && reviewDecisions.length > 0 && pendingFile && targetMonday) {
        for (const d of reviewDecisions) {
          if (d.action === "ignore") ignoredManuallyCount++;
          else if (d.action === "link") linkedManuallyCount++;
          else if (d.action === "create") createdManuallyCount++;
        }
        const resolved = await applyReviewDecisions(reviewDecisions);

        // Build synthetic aliases keyed by the planilha name so the re-parse
        // produces entries for the previously unmatched rows.
        const synthetics: ScheduleEmployee[] = [];
        for (const u of parseResult.unmatchedEmployees) {
          const emp = resolved.get(u.rowIndex);
          if (emp) synthetics.push({ ...emp, name: u.name });
        }

        const allEmps = [...(allUnitEmployees || employees), ...synthetics];
        const mondayISO = format(targetMonday, "yyyy-MM-dd");
        finalParseResult = await parseScheduleFile(pendingFile, mondayISO, allEmps);
        qc.invalidateQueries({ queryKey: ["employees"] });
      }

      if (finalParseResult.entries.length === 0) {
        toast.info("Nenhum lançamento válido após a revisão.");
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
        const errStr = [
          (error as any).code,
          error.message,
          (error as any).details,
          (error as any).hint,
          (error as any).error_description,
        ]
          .filter(Boolean)
          .join(" | ");
        const isUnique =
          (error as any).code === "23505" ||
          /unique_active_schedule|duplicate key/i.test(errStr);
        if (isUnique) {
          // Parse up to 5 conflicts from error details — Postgres format:
          // Key (employee_id, schedule_date, sector_id)=(uuid, date, uuid)
          const matches = [...errStr.matchAll(/\(([0-9a-f-]+),\s*(\d{4}-\d{2}-\d{2}),\s*([0-9a-f-]+)\)/gi)];
          const empList = allUnitEmployees || employees;
          // Try to look up sector names
          const conflictSectorIds = [...new Set(matches.map((m) => m[3]))];
          let sectorNameMap = new Map<string, string>();
          if (conflictSectorIds.length > 0) {
            const { data: secRows } = await supabase
              .from("sectors")
              .select("id, name")
              .in("id", conflictSectorIds);
            for (const s of secRows || []) sectorNameMap.set(s.id, s.name);
          }
          const conflictLines = matches.slice(0, 5).map(([, eid, dt, sid]) => {
            const empName = empList.find((e) => e.id === eid)?.name || eid.slice(0, 8);
            const dtFormatted = format(new Date(dt + "T12:00:00"), "dd/MM");
            const secName = sectorNameMap.get(sid);
            return secName ? `• ${empName} em ${dtFormatted} (${secName})` : `• ${empName} em ${dtFormatted}`;
          });
          const totalConflicts = matches.length || newRows.length;
          const more = matches.length > 5 ? `\n…e mais ${matches.length - 5} conflito(s).` : "";
          const conflictMsg = conflictLines.length
            ? `${totalConflicts} conflito(s) detectado(s):\n${conflictLines.join("\n")}${more}\n\nClique em "Zerar semana e reimportar" para limpar e tentar de novo.`
            : `Conflito de escala detectado. Clique em "Zerar semana e reimportar" para resolver.`;
          toast.error(conflictMsg, {
            duration: 20000,
            action: unitId && targetMonday
              ? {
                  label: "Zerar semana e reimportar",
                  onClick: () => clearWeekAndReimport(),
                }
              : undefined,
          });
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
