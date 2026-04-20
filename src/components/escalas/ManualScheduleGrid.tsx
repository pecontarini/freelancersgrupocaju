import React, { useState, useMemo, useEffect } from "react";
import { format, addDays, startOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyPlus,
  CalendarPlus,
  UserPlus,
  Pencil,
  Loader2,
  Coffee,
  Users,
  Eye,
  Sun,
  Moon,
  DollarSign,
  Trash2,
  ChevronDown,
  Link2,
  ArrowRight,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useAccessibleStores } from "@/hooks/useAccessibleStores";
import { useEmployees } from "@/hooks/useEmployees";
import { useManualSchedules, useCopyPreviousDay, useCancelEmployeeWeek, useCopyEmployeeWeek, useCopyEmployeeToNextWeek, useCopyWeekToNextWeek, type ManualSchedule } from "@/hooks/useManualSchedules";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDailyBudgets, useUpsertDailyBudget } from "@/hooks/useDailyBudgets";
import { useSectors, useStaffingMatrix } from "@/hooks/useStaffingMatrix";
import { useSectorJobTitles } from "@/hooks/useSectorJobTitles";
import { useSectorPartner } from "@/hooks/useSectorPartnerships";
import { jsDayToPopDay } from "@/lib/popConventions";
import { ScheduleEditModal } from "./ScheduleEditModal";
import { FreelancerAddModal } from "./FreelancerAddModal";
import { EditEmployeeQuickModal } from "./EditEmployeeQuickModal";
import { useEmployeeSundaysOff, monthRefFromDate } from "@/hooks/useSundayOff";
import { formatCurrency } from "@/lib/formatters";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { calculateDailyMetrics } from "@/lib/peakHours";
import { ScheduleExcelFlow } from "./ScheduleExcelFlow";
import { MasterExportButton } from "./MasterExportButton";
import { WeeklyHoursSummary } from "./WeeklyHoursSummary";
import { ClearSchedulesModal } from "./ClearSchedulesModal";
import { supabase } from "@/integrations/supabase/client";
import { PracaBadge } from "./PracaBadge";
import { PlanoChaoStatus } from "./PlanoChaoStatus";
import { usePracasByUnit } from "@/hooks/usePracas";

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getWeekDays(baseDate: Date): Date[] {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function ManualScheduleGrid() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, isOperator, isGerenteUnidade } = useUserProfile();
  const lojas = useConfigLojas();
  const { stores: accessibleStores } = useAccessibleStores();
  const canManage = isAdmin || isOperator || isGerenteUnidade;

  const [localUnitId, setLocalUnitId] = useState<string | null>(null);
  const selectedUnit = canManage ? (localUnitId || effectiveUnidadeId) : effectiveUnidadeId;

  // Reset local state when global context changes
  useEffect(() => {
    setLocalUnitId(null);
    setSelectedSectorId(null);
  }, [effectiveUnidadeId]);

  const [currentWeekBase, setCurrentWeekBase] = useState(new Date());
  const weekDays = useMemo(() => getWeekDays(currentWeekBase), [currentWeekBase]);
  const weekStart = format(weekDays[0], "yyyy-MM-dd");
  const weekEnd = format(weekDays[6], "yyyy-MM-dd");

  // Sector selection
  const { data: sectors = [], isLoading: loadingSectors } = useSectors(selectedUnit);
  const { data: pracasOfUnit = [] } = usePracasByUnit(selectedUnit);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [showAllEmployees, setShowAllEmployees] = useState(false);

  const activeSectorId = selectedSectorId || (sectors.length > 0 ? sectors[0].id : null);

  // Partnership for active sector (loja casada)
  const { data: partnerInfo } = useSectorPartner(activeSectorId);
  const [partnerSectorMeta, setPartnerSectorMeta] = useState<{
    sectorName: string;
    unitId: string;
    unitName: string;
  } | null>(null);

  // Resolve partner sector → name + unit info
  useEffect(() => {
    let cancelled = false;
    if (!partnerInfo?.partnerSectorId) {
      setPartnerSectorMeta(null);
      return;
    }
    (async () => {
      const { data: partnerSector } = await supabase
        .from("sectors")
        .select("name, unit_id")
        .eq("id", partnerInfo.partnerSectorId)
        .maybeSingle();
      if (!partnerSector || cancelled) return;
      const unitName =
        accessibleStores.find((s) => s.id === partnerSector.unit_id)?.nome ||
        lojas.options.find((l) => l.id === partnerSector.unit_id)?.nome ||
        "Loja parceira";
      if (!cancelled) {
        setPartnerSectorMeta({
          sectorName: partnerSector.name,
          unitId: partnerSector.unit_id,
          unitName,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerInfo?.partnerSectorId, accessibleStores, lojas.options]);

  // Effective sector ids: local sector + partner (when shared)
  const partnerSectorId = partnerInfo?.partnerSectorId || null;
  const effectiveSectorIds = useMemo(() => {
    const ids = new Set<string>();
    if (activeSectorId) ids.add(activeSectorId);
    if (partnerSectorId) ids.add(partnerSectorId);
    return Array.from(ids);
  }, [activeSectorId, partnerSectorId]);

  // Sector job title mappings — include partner sector to unify base team
  const sectorIds = useMemo(() => sectors.map((s) => s.id), [sectors]);
  const sectorJobTitleQueryIds = useMemo(() => {
    const all = new Set<string>(sectorIds);
    if (partnerSectorId) all.add(partnerSectorId);
    return Array.from(all);
  }, [sectorIds, partnerSectorId]);
  const { data: sectorJobTitles = [] } = useSectorJobTitles(sectorJobTitleQueryIds);

  // Staffing matrix for POP — include partner sector for unified efetivo
  const { data: staffingMatrix = [] } = useStaffingMatrix(sectorJobTitleQueryIds);

  const additionalUnitIds = partnerSectorMeta ? [partnerSectorMeta.unitId] : [];

  const { data: employees = [], isLoading: loadingEmp } = useEmployees(selectedUnit, additionalUnitIds);
  const { data: schedules = [], isLoading: loadingSch } = useManualSchedules(selectedUnit, weekStart, weekEnd);
  const { data: budgets = [] } = useDailyBudgets(selectedUnit, weekStart, weekEnd);
  const upsertBudget = useUpsertDailyBudget();
  const copyDay = useCopyPreviousDay();
  const cancelEmployeeWeek = useCancelEmployeeWeek();
  const copyEmployeeWeek = useCopyEmployeeWeek();
  const copyEmployeeToNextWeek = useCopyEmployeeToNextWeek();
  const copyWeekToNextWeek = useCopyWeekToNextWeek();

  // Delete employee from week state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    employeeId: string;
    employeeName: string;
  } | null>(null);
  const [isDeletingWeek, setIsDeletingWeek] = useState(false);

  // Copy schedule between employees
  const [copyMode, setCopyMode] = useState<{
    sourceId: string;
    sourceName: string;
  } | null>(null);
  const [copyConfirm, setCopyConfirm] = useState<{
    sourceId: string;
    sourceName: string;
    targetId: string;
    targetName: string;
  } | null>(null);
  const [overwriteCopy, setOverwriteCopy] = useState(false);
  const [isCopyingWeek, setIsCopyingWeek] = useState(false);

  // Copy employee schedule to NEXT week
  const [nextWeekConfirm, setNextWeekConfirm] = useState<{
    employeeId: string;
    employeeName: string;
  } | null>(null);
  const [overwriteNextWeek, setOverwriteNextWeek] = useState(false);
  const [isCopyingNextWeek, setIsCopyingNextWeek] = useState(false);

  // Replicate ENTIRE week to next
  const [replicateWeekOpen, setReplicateWeekOpen] = useState(false);
  const [overwriteReplicate, setOverwriteReplicate] = useState(false);
  const [isReplicatingWeek, setIsReplicatingWeek] = useState(false);
  const [showSectorBase, setShowSectorBase] = useState(false);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    isFreelancer: boolean;
    date: string;
    sectorId: string;
    existing: ManualSchedule | null;
  } | null>(null);

  // Freelancer modal
  const [freelancerModal, setFreelancerModal] = useState<{
    open: boolean;
    date: string;
  } | null>(null);

  // Quick edit employee modal
  const [editEmployeeModal, setEditEmployeeModal] = useState<{
    id: string;
    name: string;
    gender: string;
    phone: string | null;
    job_title: string | null;
    job_title_id: string | null;
    unit_id: string;
  } | null>(null);

  // Budget edit popover state
  const [editingBudgetDate, setEditingBudgetDate] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");

  const effectiveSectorIdSet = useMemo(
    () => new Set(effectiveSectorIds),
    [effectiveSectorIds]
  );

  // Filter employees by sector's linked job titles (across local + partner sector mappings)
  const sectorLinkedJobTitleIds = useMemo(() => {
    if (!activeSectorId) return new Set<string>();
    return new Set(
      sectorJobTitles
        .filter((sjt) => effectiveSectorIdSet.has(sjt.sector_id))
        .map((sjt) => sjt.job_title_id)
    );
  }, [sectorJobTitles, activeSectorId, effectiveSectorIdSet]);

  // Employees with active schedules in this sector+week (local OR partner sector)
  const scheduledEmployeeIds = useMemo(() => {
    if (!activeSectorId) return new Set<string>();
    return new Set(
      schedules
        .filter(
          (s) =>
            effectiveSectorIdSet.has(s.sector_id) &&
            s.status !== "cancelled" &&
            s.employee_id
        )
        .map((s) => s.employee_id!)
    );
  }, [schedules, activeSectorId, effectiveSectorIdSet]);

  // Primary: employees actually scheduled this week
  const scheduledEmployees = useMemo(() => {
    const active = employees.filter(Boolean);
    if (showAllEmployees || !activeSectorId) return active;
    return active.filter((emp) => scheduledEmployeeIds.has(emp.id));
  }, [employees, showAllEmployees, activeSectorId, scheduledEmployeeIds]);

  // Secondary: CLT employees linked to sector but NOT scheduled (base do setor)
  const sectorBaseEmployees = useMemo(() => {
    if (showAllEmployees || !activeSectorId || sectorLinkedJobTitleIds.size === 0) return [];
    return employees.filter((emp) => {
      if (emp.worker_type === "freelancer") return false;
      if (scheduledEmployeeIds.has(emp.id)) return false;
      return emp.job_title_id && sectorLinkedJobTitleIds.has(emp.job_title_id);
    });
  }, [employees, showAllEmployees, activeSectorId, sectorLinkedJobTitleIds, scheduledEmployeeIds]);

  // Sort mode + job title filter
  const [sortMode, setSortMode] = useState<"function" | "alpha">("function");
  const [filterJobTitleIds, setFilterJobTitleIds] = useState<Set<string>>(new Set());

  // Apply job title filter (if any)
  const filteredScheduled = useMemo(() => {
    if (filterJobTitleIds.size === 0) return scheduledEmployees;
    return scheduledEmployees.filter(
      (e: any) => e.job_title_id && filterJobTitleIds.has(e.job_title_id)
    );
  }, [scheduledEmployees, filterJobTitleIds]);

  const filteredBase = useMemo(() => {
    if (filterJobTitleIds.size === 0) return sectorBaseEmployees;
    return sectorBaseEmployees.filter(
      (e: any) => e.job_title_id && filterJobTitleIds.has(e.job_title_id)
    );
  }, [sectorBaseEmployees, filterJobTitleIds]);

  // Sort: CLT first, then freelancers (legacy alpha sort)
  const sortedScheduled = useMemo(() => {
    return [...filteredScheduled].sort((a, b) => {
      const aType = a.worker_type || "clt";
      const bType = b.worker_type || "clt";
      if (aType === bType) return a.name.localeCompare(b.name);
      return aType === "clt" ? -1 : 1;
    });
  }, [filteredScheduled]);

  const sortedBase = useMemo(() => {
    return [...filteredBase].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredBase]);

  // Group employees by job title for "function" sort mode
  type EmpGroup = { jobTitle: string; jobTitleId: string | null; employees: typeof sortedScheduled };
  const groupedScheduled = useMemo<EmpGroup[]>(() => {
    if (sortMode !== "function") {
      return [{ jobTitle: "", jobTitleId: null, employees: sortedScheduled }];
    }
    const map = new Map<string, EmpGroup>();
    for (const emp of sortedScheduled) {
      const key = emp.job_title_id || "__no_title__";
      const label = emp.job_title || "Sem cargo definido";
      if (!map.has(key)) {
        map.set(key, { jobTitle: label, jobTitleId: emp.job_title_id || null, employees: [] });
      }
      map.get(key)!.employees.push(emp);
    }
    // Sort groups: alphabetic by job title name; within each, CLT then freelancer then alpha
    const groups = Array.from(map.values());
    groups.sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));
    for (const g of groups) {
      g.employees.sort((a, b) => {
        const aType = a.worker_type || "clt";
        const bType = b.worker_type || "clt";
        if (aType === bType) return a.name.localeCompare(b.name);
        return aType === "clt" ? -1 : 1;
      });
    }
    return groups;
  }, [sortedScheduled, sortMode]);

  // Available job titles in this view (from scheduled + base) for the filter chips
  const availableJobTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of [...scheduledEmployees, ...sectorBaseEmployees]) {
      if (e.job_title_id) map.set(e.job_title_id, e.job_title || "Sem nome");
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [scheduledEmployees, sectorBaseEmployees]);

  function toggleJobTitleFilter(id: string) {
    setFilterJobTitleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Build employee map for worker_type + unit_id lookup
  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.worker_type || "clt"));
    return m;
  }, [employees]);

  const employeeUnitMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.unit_id));
    return m;
  }, [employees]);

  // Resolve which sector_id should hold a given employee's schedule (own unit's sector)
  function resolveSectorForEmployee(employeeId: string): string {
    if (!partnerSectorId || !partnerSectorMeta) return activeSectorId || "";
    const empUnitId = employeeUnitMap.get(employeeId);
    if (empUnitId === partnerSectorMeta.unitId) return partnerSectorId;
    return activeSectorId || "";
  }

  // POP quota of extras per day (from staffing matrix)
  const extrasQuotaPerDay = useMemo(() => {
    const map = new Map<string, number>();
    if (!activeSectorId) return map;
    for (const day of weekDays) {
      const dow = jsDayToPopDay(day.getDay());
      const entries = staffingMatrix.filter(
        (m) => effectiveSectorIdSet.has(m.sector_id) && m.day_of_week === dow
      );
      map.set(format(day, "yyyy-MM-dd"), entries.reduce((sum, e) => sum + (e.extras_count ?? 0), 0));
    }
    return map;
  }, [activeSectorId, staffingMatrix, weekDays, effectiveSectorIdSet]);

  // Count freelancers scheduled per day (across both sectors)
  const freelancerCountPerDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const day of weekDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      const count = schedules.filter(
        (s) =>
          s.schedule_date === dateStr &&
          effectiveSectorIdSet.has(s.sector_id) &&
          s.employee_id &&
          employeeMap.get(s.employee_id) === "freelancer"
      ).length;
      counts.set(dateStr, count);
    }
    return counts;
  }, [schedules, effectiveSectorIdSet, weekDays, employeeMap]);

  // Slots per day (POP quota OR freelancers already scheduled OR 1 free slot — whichever is largest)
  const slotsPerDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of weekDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      const quota = extrasQuotaPerDay.get(dateStr) ?? 0;
      const filled = freelancerCountPerDay.get(dateStr) ?? 0;
      map.set(dateStr, Math.max(quota, filled, 1));
    }
    return map;
  }, [weekDays, extrasQuotaPerDay, freelancerCountPerDay]);

  // Number of extra rows to render = max slots across the week
  const extraSlots = useMemo(() => {
    let max = 0;
    for (const v of slotsPerDay.values()) if (v > max) max = v;
    return activeSectorId ? max : 0;
  }, [slotsPerDay, activeSectorId]);

  // Daily metrics — sum across both sectors
  function getDayMetrics(dateStr: string) {
    const daySchedules = schedules
      .filter(
        (s) => s.schedule_date === dateStr && effectiveSectorIdSet.has(s.sector_id)
      )
      .map((s) => ({
        ...s,
        worker_type: s.employee_id ? employeeMap.get(s.employee_id) || "clt" : "clt",
      }));
    return calculateDailyMetrics(daySchedules);
  }

  // POP target — sum required + extras across local + partner sector
  function getPopTarget(dayOfWeek: number, shiftType: string): { efetivos: number; extras: number; total: number } {
    if (!activeSectorId) return { efetivos: 0, extras: 0, total: 0 };
    const entries = staffingMatrix.filter(
      (m) =>
        effectiveSectorIdSet.has(m.sector_id) &&
        m.day_of_week === dayOfWeek &&
        m.shift_type === shiftType
    );
    const efetivos = entries.reduce((s, e) => s + (e.required_count ?? 0), 0);
    const extras = entries.reduce((s, e) => s + (e.extras_count ?? 0), 0);
    return { efetivos, extras, total: efetivos + extras };
  }

  function getScheduleForCell(employeeId: string, dateStr: string): ManualSchedule | undefined {
    return schedules.find(
      (s) =>
        s.employee_id === employeeId &&
        s.schedule_date === dateStr &&
        effectiveSectorIdSet.has(s.sector_id)
    );
  }

  function getBudgetForDay(dateStr: string) {
    return budgets.find((b) => b.date === dateStr);
  }

  function handleCellClick(emp: any, dateStr: string) {
    const existing = getScheduleForCell(emp.id, dateStr) || null;
    // Honor existing record's sector. For new entries, route to the employee's own sector.
    const targetSectorId = existing?.sector_id || resolveSectorForEmployee(emp.id);
    setEditModal({
      open: true,
      employeeId: emp.id,
      employeeName: emp.name,
      isFreelancer: emp.worker_type === "freelancer",
      date: dateStr,
      sectorId: targetSectorId,
      existing,
    });
  }

  function handleSaveBudget(dateStr: string) {
    if (!selectedUnit) return;
    upsertBudget.mutate({
      date: dateStr,
      unit_id: selectedUnit,
      budget_amount: parseFloat(budgetValue) || 0,
    });
    setEditingBudgetDate(null);
  }

  function handleCopyPreviousDay(dateStr: string) {
    if (!selectedUnit) return;
    const prevDate = format(subDays(new Date(dateStr + "T12:00:00"), 1), "yyyy-MM-dd");
    copyDay.mutate({ sourceDate: prevDate, targetDate: dateStr, unitId: selectedUnit });
  }

  const navigateWeek = (dir: number) => {
    setCurrentWeekBase((prev) => addDays(prev, dir * 7));
  };

  const isLoading = loadingEmp || loadingSch || loadingSectors;
  const hasSectorMappings = sectorLinkedJobTitleIds.size > 0;

  return (
    <div className="space-y-4 fade-in">
      {/* Copy mode banner */}
      {copyMode && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Copy className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">
              Copiando escala de <strong className="uppercase">{copyMode.sourceName}</strong>. Clique em outro colaborador para definir o destino.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0"
            onClick={() => setCopyMode(null)}
          >
            Cancelar
          </Button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Editor de Escalas</h2>
          <p className="text-muted-foreground text-sm">
            Lançamento único por dia — o POP é calculado automaticamente pelo horário.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {canManage && selectedUnit && sectors.length > 0 && (
            <ClearSchedulesModal
              unitId={selectedUnit}
              sectors={sectors}
              weekStart={weekStart}
              weekEnd={weekEnd}
              weekLabel={`${format(weekDays[0], "dd/MM")} — ${format(weekDays[6], "dd/MM/yyyy")}`}
            />
          )}
          {canManage && selectedUnit && (
            <MasterExportButton
              unitId={selectedUnit}
              unitName={lojas.options.find((l) => l.id === selectedUnit)?.nome || "Unidade"}
              weekStart={currentWeekBase}
            />
          )}
          {activeSectorId && (
            <ScheduleExcelFlow
              employees={[
                ...sortedScheduled.map((e) => ({
                  id: e.id,
                  name: e.name,
                  job_title: e.job_title,
                  job_title_id: e.job_title_id,
                  worker_type: e.worker_type || "clt",
                })),
                ...sortedBase
                  .filter((e) => !sortedScheduled.some((s) => s.id === e.id))
                  .map((e) => ({
                    id: e.id,
                    name: e.name,
                    job_title: e.job_title,
                    job_title_id: e.job_title_id,
                    worker_type: e.worker_type || "clt",
                  })),
              ]}
              weekDays={weekDays}
              sectorName={sectors.find((s) => s.id === activeSectorId)?.name || "Setor"}
              sectorId={activeSectorId}
              unitName={lojas.options.find((l) => l.id === selectedUnit)?.nome || ""}
              unitId={selectedUnit || undefined}
              allUnitEmployees={(employees || []).map((e) => ({
                id: e.id,
                name: e.name,
                job_title: e.job_title,
                job_title_id: e.job_title_id,
                worker_type: e.worker_type || "clt",
              }))}
              sectors={sectors.map((s) => ({ id: s.id, name: s.name }))}
              sectorJobTitles={sectorJobTitles.map((sjt) => ({ sector_id: sjt.sector_id, job_title_id: sjt.job_title_id }))}
            />
          )}
        </div>
      </div>

      {/* Unit selector for admin/partner */}
      {canManage && (
        <Card>
          <CardContent className="pt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Unidade</label>
              <Select value={selectedUnit || ""} onValueChange={setLocalUnitId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accessibleStores.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedUnit && (
        <>
          {/* Sector Tabs */}
          {sectors.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <Tabs
                value={activeSectorId || ""}
                onValueChange={(v) => setSelectedSectorId(v)}
                className="flex-1"
              >
                <TabsList className="flex-wrap h-auto gap-1">
                  {sectors.map((sector) => (
                    <TabsTrigger key={sector.id} value={sector.id} className="gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {sector.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {hasSectorMappings && (
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    id="show-all"
                    checked={showAllEmployees}
                    onCheckedChange={setShowAllEmployees}
                  />
                  <Label htmlFor="show-all" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                    <Eye className="h-3 w-3" />
                    Todos
                  </Label>
                </div>
              )}
            </div>
          )}

          {sectors.length === 0 && !loadingSectors && (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Nenhum setor cadastrado.</p>
                <p className="text-xs mt-1">Configure setores na aba "Configurações" para usar a segmentação.</p>
              </CardContent>
            </Card>
          )}

          {/* Week Navigation */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
              <span className="font-semibold text-sm truncate">
                {format(weekDays[0], "dd MMM", { locale: ptBR })} — {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
              </span>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 hidden sm:inline-flex"
                  onClick={() => {
                    setOverwriteReplicate(false);
                    setReplicateWeekOpen(true);
                  }}
                  title="Replicar todas as escalas desta semana para a próxima"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span className="text-xs">Replicar → próxima</span>
                </Button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 sm:hidden w-full"
              onClick={() => {
                setOverwriteReplicate(false);
                setReplicateWeekOpen(true);
              }}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span className="text-xs">Replicar semana → próxima</span>
            </Button>
          )}

          {/* Shared sector banner (loja casada) */}
          {partnerSectorMeta && activeSectorId && (
            <div className="flex items-center gap-2 rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <p className="text-xs sm:text-sm">
                <span className="font-semibold text-primary">Setor compartilhado</span>
                <span className="text-muted-foreground"> com </span>
                <span className="font-semibold uppercase">{partnerSectorMeta.unitName} / {partnerSectorMeta.sectorName}</span>
                <span className="text-muted-foreground"> — funcionários e escalas das duas lojas aparecem aqui.</span>
              </p>
            </div>
          )}

          {/* Sort + Job Title filter */}
          {activeSectorId && (sortedScheduled.length > 0 || sortedBase.length > 0 || availableJobTitles.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 px-1">
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Ordenar:</span>
                <Tabs value={sortMode} onValueChange={(v) => setSortMode(v as "function" | "alpha")}>
                  <TabsList className="h-7">
                    <TabsTrigger value="function" className="text-[11px] h-5 px-2">Por função</TabsTrigger>
                    <TabsTrigger value="alpha" className="text-[11px] h-5 px-2">Alfabético</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {availableJobTitles.length > 1 && (
                <div className="flex flex-wrap items-center gap-1 ml-auto">
                  <span className="text-xs text-muted-foreground">Filtrar:</span>
                  {availableJobTitles.map((jt) => {
                    const active = filterJobTitleIds.has(jt.id);
                    return (
                      <button
                        key={jt.id}
                        onClick={() => toggleJobTitleFilter(jt.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors uppercase ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {jt.name}
                      </button>
                    );
                  })}
                  {filterJobTitleIds.size > 0 && (
                    <button
                      onClick={() => setFilterJobTitleIds(new Set())}
                      className="text-[10px] px-2 py-0.5 rounded-full text-muted-foreground hover:text-foreground underline"
                    >
                      limpar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Grid */}
          <Card>
            <CardContent className="pt-4 px-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : sortedScheduled.length === 0 && sortedBase.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {hasSectorMappings && !showAllEmployees ? (
                    <>
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p>Nenhum funcionário vinculado a este setor.</p>
                      <p className="text-xs mt-1">
                        Configure os cargos do setor na aba{" "}
                        <span className="font-medium text-foreground">"Cargos e Setores"</span>{" "}
                        ou ative o toggle{" "}
                        <span className="font-medium text-foreground">"Todos"</span>.
                      </p>
                    </>
                  ) : (
                    <p>Nenhum funcionário cadastrado. Adicione na aba "Equipe".</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px] sticky left-0 bg-background z-20 border-r">
                          Funcionário
                        </TableHead>
                        {weekDays.map((day, i) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const budget = getBudgetForDay(dateStr);
                          const jsDow = jsDayToPopDay(day.getDay());
                          const popLunch = getPopTarget(jsDow, "almoco");
                          const popDinner = getPopTarget(jsDow, "jantar");
                          const metrics = getDayMetrics(dateStr);

                          return (
                            <TableHead key={i} className="text-center min-w-[140px] p-1">
                              <div className="space-y-0.5">
                                <div className="font-semibold">{DAY_LABELS[i]}</div>
                                <div className="text-[10px] font-normal text-muted-foreground">
                                  {format(day, "dd/MM")}
                                </div>

                                {/* Bloco A: Dual POP Indicators */}
                                {activeSectorId && (
                                  <div className="flex gap-1 justify-center mt-1">
                                    <MiniPopBadge
                                      icon={<Sun className="h-2.5 w-2.5" />}
                                      scheduled={metrics.lunchCount}
                                      efetivos={popLunch.efetivos}
                                      extras={popLunch.extras}
                                      label="Alm"
                                    />
                                    <MiniPopBadge
                                      icon={<Moon className="h-2.5 w-2.5" />}
                                      scheduled={metrics.dinnerCount}
                                      efetivos={popDinner.efetivos}
                                      extras={popDinner.extras}
                                      label="Jan"
                                    />
                                  </div>
                                )}

                                {/* Bloco B: Financial Control */}
                                <div className="text-[9px] font-normal space-y-0.5 mt-0.5">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <DollarSign className="h-2.5 w-2.5 text-muted-foreground" />
                                    <span className="text-muted-foreground">Verba:</span>
                                    <Popover
                                      open={editingBudgetDate === dateStr}
                                      onOpenChange={(o) => {
                                        if (o) {
                                          setEditingBudgetDate(dateStr);
                                          setBudgetValue(String(budget?.budget_amount || ""));
                                        } else {
                                          setEditingBudgetDate(null);
                                        }
                                      }}
                                    >
                                      <PopoverTrigger asChild>
                                        <button className="font-medium hover:underline inline-flex items-center gap-0.5">
                                          {budget ? formatCurrency(budget.budget_amount) : "—"}
                                          <Pencil className="h-2 w-2 text-muted-foreground" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-48 p-2" align="center">
                                        <div className="space-y-2">
                                          <Input
                                            type="number"
                                            min={0}
                                            step={50}
                                            value={budgetValue}
                                            onChange={(e) => setBudgetValue(e.target.value)}
                                            placeholder="Valor"
                                            className="h-8 text-sm"
                                          />
                                          <Button size="sm" className="w-full h-7 text-xs" onClick={() => handleSaveBudget(dateStr)}>
                                            Salvar
                                          </Button>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </div>
                                  {metrics.freelancerCost > 0 && (
                                    <div className={`font-medium ${
                                      budget && metrics.freelancerCost > budget.budget_amount
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-green-600 dark:text-green-400"
                                    }`}>
                                      Gasto: {formatCurrency(metrics.freelancerCost)}
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-center gap-0.5 mt-1">
                                  <button
                                    onClick={() => setFreelancerModal({ open: true, date: dateStr })}
                                    className="p-0.5 rounded hover:bg-muted text-orange-500"
                                    title="+ Freelancer"
                                  >
                                    <UserPlus className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => handleCopyPreviousDay(dateStr)}
                                    className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                                    title="Copiar dia anterior"
                                    disabled={copyDay.isPending}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedScheduled.map((group, gIdx) => (
                        <React.Fragment key={`group-frag-${gIdx}`}>
                          {sortMode === "function" && group.employees.length > 0 && (
                            <TableRow key={`group-${gIdx}`} className="bg-muted/40 hover:bg-muted/40">
                              <TableCell
                                colSpan={8}
                                className="py-1 px-3 sticky left-0 bg-muted/40 border-r"
                              >
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  <Briefcase className="h-3 w-3" />
                                  <span>{group.jobTitle}</span>
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                    {group.employees.length}
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {group.employees.map((emp) => {
                            const isFreelancer = emp.worker_type === "freelancer";
                            const isFromPartner = partnerSectorMeta && emp.unit_id === partnerSectorMeta.unitId;
                            const isCopySource = copyMode?.sourceId === emp.id;
                            const isCopyTarget = !!copyMode && copyMode.sourceId !== emp.id;
                            return (
                              <TableRow
                                key={emp.id}
                                className={
                                  isCopySource
                                    ? "bg-primary/10 ring-1 ring-primary"
                                    : isCopyTarget
                                    ? "cursor-pointer hover:bg-primary/5"
                                    : ""
                                }
                                onClick={
                                  isCopyTarget
                                    ? () => {
                                        setCopyConfirm({
                                          sourceId: copyMode!.sourceId,
                                          sourceName: copyMode!.sourceName,
                                          targetId: emp.id,
                                          targetName: emp.name,
                                        });
                                        setOverwriteCopy(false);
                                      }
                                    : undefined
                                }
                              >
                                <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="truncate max-w-[110px] uppercase">{emp.name}</span>
                                    {isFreelancer && (
                                      <Badge variant="outline" className="border-orange-400 text-orange-600 text-[9px] px-1 py-0 shrink-0">
                                        FL
                                      </Badge>
                                    )}
                                    {!isFreelancer && (
                                      <SundayOffIndicator
                                        employeeId={emp.id}
                                        monthRef={monthRefFromDate(currentWeekBase)}
                                      />
                                    )}
                                    {isFromPartner && (
                                      <Badge variant="outline" className="border-primary/50 text-primary text-[9px] px-1 py-0 shrink-0" title={`Funcionário de ${partnerSectorMeta?.unitName}`}>
                                        {partnerSectorMeta?.unitName.slice(0, 8)}
                                      </Badge>
                                    )}
                                    {canManage && !copyMode && !isFromPartner && (
                                      <button
                                        className="ml-auto shrink-0 p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                        title="Editar funcionário (cargo, telefone, gênero)"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditEmployeeModal({
                                            id: emp.id,
                                            name: emp.name,
                                            gender: emp.gender || "M",
                                            phone: emp.phone || null,
                                            job_title: emp.job_title || null,
                                            job_title_id: emp.job_title_id || null,
                                            unit_id: emp.unit_id,
                                          });
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </button>
                                    )}
                                    {canManage && !copyMode && (
                                      <button
                                        className={`${isFromPartner ? "ml-auto" : ""} shrink-0 p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors`}
                                        title="Copiar escala desta pessoa para outro colaborador"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCopyMode({ sourceId: emp.id, sourceName: emp.name });
                                        }}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    {canManage && !copyMode && (
                                      <button
                                        className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[9px] font-semibold transition-colors"
                                        title="Copiar escala desta semana para a próxima"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOverwriteNextWeek(false);
                                          setNextWeekConfirm({ employeeId: emp.id, employeeName: emp.name });
                                        }}
                                      >
                                        <CopyPlus className="h-2.5 w-2.5" />
                                        <span>próxima</span>
                                        <ArrowRight className="h-2.5 w-2.5" />
                                      </button>
                                    )}
                                    {canManage && !copyMode && (
                                      <button
                                        className="shrink-0 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        title="Remover da semana"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirm({ employeeId: emp.id, employeeName: emp.name });
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  {emp.job_title && sortMode !== "function" && (
                                    <div className="text-[10px] text-muted-foreground truncate uppercase">{emp.job_title}</div>
                                  )}
                                </TableCell>
                                {weekDays.map((day, i) => {
                                  const dateStr = format(day, "yyyy-MM-dd");
                                  const schedule = getScheduleForCell(emp.id, dateStr);
                                  const pracaName = schedule?.praca_id
                                    ? pracasOfUnit.find((p) => p.id === schedule.praca_id)?.nome_praca
                                    : null;
                                  return (
                                    <TableCell
                                      key={i}
                                      className={`text-center p-1 transition-colors ${copyMode ? "" : "cursor-pointer hover:bg-muted/50"}`}
                                      onClick={(e) => {
                                        if (copyMode) return;
                                        e.stopPropagation();
                                        handleCellClick(emp, dateStr);
                                      }}
                                    >
                                      <ScheduleCell schedule={schedule} isFreelancer={isFreelancer} pracaName={pracaName} />
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      ))}
                      {/* VAGA EXTRA placeholder rows — always at least 1 free slot per day */}
                      {extraSlots > 0 && Array.from({ length: extraSlots }, (_, slotIdx) => {
                        const isQuotaRowAnyDay = weekDays.some((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          return slotIdx < (extrasQuotaPerDay.get(dateStr) ?? 0);
                        });
                        return (
                        <TableRow key={`extra-slot-${slotIdx}`} className={isQuotaRowAnyDay ? "bg-amber-50/50 dark:bg-amber-950/10" : "bg-muted/20"}>
                          <TableCell className={`font-medium sticky left-0 z-10 border-r ${isQuotaRowAnyDay ? "bg-amber-50 dark:bg-amber-950/20" : "bg-muted/30"}`}>
                            <div className="flex items-center gap-1.5">
                              <UserPlus className={`h-3 w-3 ${isQuotaRowAnyDay ? "text-amber-500" : "text-muted-foreground"}`} />
                              <span className={`text-xs font-semibold ${isQuotaRowAnyDay ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                                {isQuotaRowAnyDay
                                  ? `VAGA EXTRA ${String(slotIdx + 1).padStart(2, "0")}`
                                  : "EXTRA AVULSO"}
                              </span>
                            </div>
                          </TableCell>
                          {weekDays.map((day, i) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const dayQuota = extrasQuotaPerDay.get(dateStr) ?? 0;
                            const alreadyFilled = freelancerCountPerDay.get(dateStr) || 0;
                            const dayMaxSlots = slotsPerDay.get(dateStr) ?? 1;
                            const isWithinQuota = slotIdx < dayQuota;
                            const isFilled = slotIdx < alreadyFilled;
                            const showSlot = slotIdx < dayMaxSlots;

                            if (!showSlot) {
                              return (
                                <TableCell key={i} className="text-center p-1">
                                  <div className="h-10 flex items-center justify-center">
                                    <span className="text-muted-foreground/20 text-xs">—</span>
                                  </div>
                                </TableCell>
                              );
                            }

                            if (!isWithinQuota && !isFilled) {
                              return (
                                <TableCell
                                  key={i}
                                  className="text-center p-1 cursor-pointer hover:bg-muted/40 transition-colors"
                                  onClick={() => setFreelancerModal({ open: true, date: dateStr })}
                                  title="Adicionar freelancer avulso (fora da cota POP)"
                                >
                                  <div className="h-10 flex items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30">
                                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground/60" />
                                  </div>
                                </TableCell>
                              );
                            }

                            return (
                              <TableCell
                                key={i}
                                className="text-center p-1 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
                                onClick={() => setFreelancerModal({ open: true, date: dateStr })}
                              >
                                <div className={`h-10 flex items-center justify-center rounded-md border-2 border-dashed ${
                                  isFilled
                                    ? "border-amber-400 bg-amber-100 dark:bg-amber-900/30"
                                    : "border-amber-300/50 dark:border-amber-700/30"
                                }`}>
                                  {isFilled ? (
                                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Preenchida</span>
                                  ) : (
                                    <UserPlus className="h-3.5 w-3.5 text-amber-400/60" />
                                  )}
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                        );
                      })}

                      {/* Collapsible base section for CLTs not scheduled */}
                      {sortedBase.length > 0 && !showAllEmployees && (
                        <>
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="py-1 px-2 cursor-pointer hover:bg-muted/50"
                              onClick={() => setShowSectorBase((v) => !v)}
                            >
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSectorBase ? "rotate-0" : "-rotate-90"}`} />
                                <Users className="h-3.5 w-3.5" />
                                <span className="font-medium">Quadro base do setor</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {sortedBase.length}
                                </Badge>
                                <span className="text-[10px]">— sem escala nesta semana</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {showSectorBase && sortedBase.map((emp) => (
                            <TableRow key={emp.id} className="opacity-60">
                              <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate max-w-[110px] uppercase">{emp.name}</span>
                                </div>
                                {emp.job_title && (
                                  <div className="text-[10px] text-muted-foreground truncate uppercase">{emp.job_title}</div>
                                )}
                              </TableCell>
                              {weekDays.map((day, i) => {
                                const dateStr = format(day, "yyyy-MM-dd");
                                return (
                                  <TableCell
                                    key={i}
                                    className="text-center p-1 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleCellClick(emp, dateStr)}
                                  >
                                    <div className="h-10 flex items-center justify-center">
                                      <span className="text-muted-foreground/40 text-xs">—</span>
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plano de chão — status do dia ativo (primeiro dia da semana com escalas) */}
          {activeSectorId && (
            <PlanoChaoStatus
              unitId={selectedUnit}
              sectorName={sectors.find((s) => s.id === activeSectorId)?.name}
              date={format(weekDays[0], "yyyy-MM-dd")}
              schedules={schedules.filter((s) => effectiveSectorIdSet.has(s.sector_id))}
            />
          )}

          {/* Weekly Hours Summary */}
          {schedules.length > 0 && employees.length > 0 && (
            <WeeklyHoursSummary
              schedules={schedules}
              employees={employees}
              weekDays={weekDays}
            />
          )}
        </>
      )}

      {/* Edit Modal */}
      {editModal && (
        <ScheduleEditModal
          open={editModal.open}
          onClose={() => setEditModal(null)}
          employeeId={editModal.employeeId}
          employeeName={editModal.employeeName}
          isFreelancer={editModal.isFreelancer}
          date={editModal.date}
          sectorId={editModal.sectorId}
          existing={editModal.existing}
          unitId={selectedUnit}
          sectorName={sectors.find((s) => s.id === editModal.sectorId)?.name || sectors.find((s) => s.id === activeSectorId)?.name || null}
        />
      )}

      {/* Freelancer Modal */}
      {freelancerModal && selectedUnit && activeSectorId && (
        <FreelancerAddModal
          open={freelancerModal.open}
          onClose={() => setFreelancerModal(null)}
          unitId={selectedUnit}
          unitName={lojas.options.find((l) => l.id === selectedUnit)?.nome || ""}
          sectorId={activeSectorId}
          date={freelancerModal.date}
          partnerUnitId={partnerSectorMeta?.unitId}
          partnerUnitName={partnerSectorMeta?.unitName}
          partnerSectorId={partnerSectorId || undefined}
        />
      )}

      {/* Quick Edit Employee Modal */}
      <EditEmployeeQuickModal
        open={!!editEmployeeModal}
        onClose={() => setEditEmployeeModal(null)}
        employee={editEmployeeModal}
      />

      {/* Delete employee from week confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o && !isDeletingWeek) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover funcionário da semana</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as escalas de <strong>{deleteConfirm?.employeeName}</strong> nesta semana serão removidas. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingWeek}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingWeek}
              onClick={async (e) => {
                e.preventDefault();
                if (deleteConfirm && selectedUnit) {
                  setIsDeletingWeek(true);
                  try {
                    await cancelEmployeeWeek.mutateAsync({
                      employee_id: deleteConfirm.employeeId,
                      sector_ids: sectorIds,
                      week_start: weekStart,
                      week_end: weekEnd,
                    });
                  } finally {
                    setIsDeletingWeek(false);
                    setDeleteConfirm(null);
                  }
                }
              }}
            >
              {isDeletingWeek && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy employee week confirmation */}
      <AlertDialog
        open={!!copyConfirm}
        onOpenChange={(o) => {
          if (!o && !isCopyingWeek) {
            setCopyConfirm(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar escala da semana</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Copiar todos os turnos de{" "}
                  <strong className="uppercase">{copyConfirm?.sourceName}</strong> para{" "}
                  <strong className="uppercase">{copyConfirm?.targetName}</strong> nesta semana?
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overwriteCopy}
                    onChange={(e) => setOverwriteCopy(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Sobrescrever escalas existentes do destino
                </label>
                {!overwriteCopy && (
                  <p className="text-xs text-muted-foreground">
                    Dias já preenchidos no destino serão preservados.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCopyingWeek}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isCopyingWeek}
              onClick={async (e) => {
                e.preventDefault();
                if (!copyConfirm) return;
                setIsCopyingWeek(true);
                try {
                  await copyEmployeeWeek.mutateAsync({
                    sourceEmployeeId: copyConfirm.sourceId,
                    targetEmployeeId: copyConfirm.targetId,
                    weekStart,
                    weekEnd,
                    sectorIds: effectiveSectorIds,
                    overwrite: overwriteCopy,
                  });
                  setCopyConfirm(null);
                  setCopyMode(null);
                } catch {
                  // toast handled in hook
                } finally {
                  setIsCopyingWeek(false);
                }
              }}
            >
              {isCopyingWeek && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Copiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy single employee week → next week */}
      <AlertDialog
        open={!!nextWeekConfirm}
        onOpenChange={(o) => {
          if (!o && !isCopyingNextWeek) {
            setNextWeekConfirm(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar para próxima semana</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Replicar todos os turnos de{" "}
                  <strong className="uppercase">{nextWeekConfirm?.employeeName}</strong>{" "}
                  da semana <strong>{format(weekDays[0], "dd/MM", { locale: ptBR })} – {format(weekDays[6], "dd/MM", { locale: ptBR })}</strong>{" "}
                  para a semana <strong>{format(addDays(weekDays[0], 7), "dd/MM", { locale: ptBR })} – {format(addDays(weekDays[6], 7), "dd/MM", { locale: ptBR })}</strong>?
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overwriteNextWeek}
                    onChange={(e) => setOverwriteNextWeek(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Sobrescrever escalas já existentes na próxima semana
                </label>
                {!overwriteNextWeek && (
                  <p className="text-xs text-muted-foreground">
                    Dias já preenchidos na semana destino serão preservados.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCopyingNextWeek}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isCopyingNextWeek}
              onClick={async (e) => {
                e.preventDefault();
                if (!nextWeekConfirm) return;
                setIsCopyingNextWeek(true);
                try {
                  const res = await copyEmployeeToNextWeek.mutateAsync({
                    employeeId: nextWeekConfirm.employeeId,
                    sourceWeekStart: weekStart,
                    sourceWeekEnd: weekEnd,
                    sectorIds: effectiveSectorIds,
                    overwrite: overwriteNextWeek,
                  });
                  setNextWeekConfirm(null);
                  if (res?.copied > 0) {
                    setCurrentWeekBase((prev) => addDays(prev, 7));
                  }
                } catch {
                  // toast handled in hook
                } finally {
                  setIsCopyingNextWeek(false);
                }
              }}
            >
              {isCopyingNextWeek && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Copiar para próxima
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replicate ENTIRE week to next */}
      <AlertDialog
        open={replicateWeekOpen}
        onOpenChange={(o) => {
          if (!o && !isReplicatingWeek) {
            setReplicateWeekOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replicar semana inteira</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Copiar <strong>todas as escalas de todos os colaboradores</strong> da semana{" "}
                  <strong>{format(weekDays[0], "dd/MM", { locale: ptBR })} – {format(weekDays[6], "dd/MM", { locale: ptBR })}</strong>{" "}
                  para a semana <strong>{format(addDays(weekDays[0], 7), "dd/MM", { locale: ptBR })} – {format(addDays(weekDays[6], 7), "dd/MM", { locale: ptBR })}</strong>?
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overwriteReplicate}
                    onChange={(e) => setOverwriteReplicate(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Sobrescrever escalas já existentes na próxima semana
                </label>
                {!overwriteReplicate && (
                  <p className="text-xs text-muted-foreground">
                    Dias já preenchidos na semana destino serão preservados.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReplicatingWeek}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isReplicatingWeek}
              onClick={async (e) => {
                e.preventDefault();
                setIsReplicatingWeek(true);
                try {
                  const res = await copyWeekToNextWeek.mutateAsync({
                    sourceWeekStart: weekStart,
                    sourceWeekEnd: weekEnd,
                    sectorIds: effectiveSectorIds,
                    overwrite: overwriteReplicate,
                  });
                  setReplicateWeekOpen(false);
                  if (res?.copied > 0) {
                    setCurrentWeekBase((prev) => addDays(prev, 7));
                  }
                } catch {
                  // toast handled in hook
                } finally {
                  setIsReplicatingWeek(false);
                }
              }}
            >
              {isReplicatingWeek && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Replicar semana
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Sunday-off indicator (per-employee monthly badge) ─── */
function SundayOffIndicator({
  employeeId,
  monthRef,
}: {
  employeeId: string;
  monthRef: string;
}) {
  const { data: sundays = [] } = useEmployeeSundaysOff(employeeId, monthRef);
  const had = sundays.length > 0;
  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1 py-0 shrink-0 gap-0.5 ${
        had
          ? "border-green-500/60 text-green-700 dark:text-green-400"
          : "border-orange-400/60 text-orange-600 dark:text-orange-400"
      }`}
      title={
        had
          ? `Já teve ${sundays.length} domingo(s) de folga este mês`
          : "Ainda não teve domingo de folga este mês"
      }
    >
      <Sun className="h-2.5 w-2.5" />
      DOM {had ? "✓" : "✗"}
    </Badge>
  );
}

/* ─── Mini POP Badge (Almoço / Jantar) ─── */

function MiniPopBadge({
  icon,
  scheduled,
  efetivos,
  extras,
  label,
}: {
  icon: React.ReactNode;
  scheduled: number;
  efetivos: number;
  extras: number;
  label: string;
}) {
  const total = efetivos + extras;
  const isDeficit = scheduled < total;
  const isExcess = scheduled > total;

  let bgClass = "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
  if (total === 0 && scheduled === 0) {
    bgClass = "bg-muted text-muted-foreground";
  } else if (isDeficit) {
    bgClass = "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  } else if (isExcess) {
    bgClass = "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
  }

  const excess = Math.max(0, scheduled - total);
  return (
    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${bgClass}`} title={`${label}: ${scheduled} escalados / Meta: ${efetivos}+${extras}${excess > 0 ? ` (${excess} avulso${excess > 1 ? "s" : ""} acima da cota)` : ""}`}>
      {icon}
      <span>{scheduled}/{efetivos}{extras > 0 && <span className="text-orange-500">+{extras}</span>}{excess > 0 && <span className="ml-0.5 text-muted-foreground/80 font-normal">(+{excess})</span>}</span>
    </div>
  );
}

/* ─── Schedule Cell ─── */

function ScheduleCell({
  schedule,
  isFreelancer,
  pracaName,
}: {
  schedule?: ManualSchedule;
  isFreelancer: boolean;
  pracaName?: string | null;
}) {
  if (!schedule) {
    return (
      <div className="h-10 flex items-center justify-center">
        <span className="text-muted-foreground/40 text-xs">—</span>
      </div>
    );
  }

  const type = schedule.schedule_type;

  if (type === "off") {
    return (
      <div className="h-10 flex items-center justify-center rounded-md bg-muted-foreground/20 dark:bg-muted-foreground/30">
        <span className="text-xs font-bold text-muted-foreground">FOLGA</span>
      </div>
    );
  }

  if (type === "vacation") {
    return (
      <div className="h-10 flex items-center justify-center rounded-md bg-purple-200 dark:bg-purple-900/40">
        <span className="text-xs font-bold text-purple-700 dark:text-purple-300">FÉRIAS</span>
      </div>
    );
  }

  if (type === "sick_leave") {
    return (
      <div className="h-10 flex items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
        <span className="text-xs font-bold text-red-600 dark:text-red-400">ATESTADO</span>
      </div>
    );
  }

  if (type === "banco_horas") {
    return (
      <div className="h-10 flex items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">BH</span>
      </div>
    );
  }

  // Working
  const startStr = schedule.start_time?.slice(0, 5) || "";
  const endStr = schedule.end_time?.slice(0, 5) || "";
  const hasBreak = schedule.break_duration > 0;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`h-10 w-full flex items-center justify-center rounded-md text-[11px] font-medium px-1 ${
          isFreelancer
            ? "border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300"
            : "bg-primary/10 text-primary"
        }`}
      >
        {startStr && endStr ? (
          <span className="flex items-center gap-0.5">
            {startStr} - {endStr}
            {hasBreak && <Coffee className="h-2.5 w-2.5 opacity-50" />}
          </span>
        ) : (
          <span>✓</span>
        )}
      </div>
      <PracaBadge nome={pracaName} />
    </div>
  );
}
