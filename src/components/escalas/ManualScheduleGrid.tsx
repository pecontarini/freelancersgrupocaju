import { useState, useMemo } from "react";
import { format, addDays, startOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  UserPlus,
  Pencil,
  Loader2,
  Coffee,
  Users,
  Eye,
  Sun,
  Moon,
  DollarSign,
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
import { useEmployees } from "@/hooks/useEmployees";
import { useManualSchedules, useCopyPreviousDay, type ManualSchedule } from "@/hooks/useManualSchedules";
import { useDailyBudgets, useUpsertDailyBudget } from "@/hooks/useDailyBudgets";
import { useSectors, useStaffingMatrix } from "@/hooks/useStaffingMatrix";
import { useSectorJobTitles } from "@/hooks/useSectorJobTitles";
import { jsDayToPopDay } from "@/lib/popConventions";
import { ScheduleEditModal } from "./ScheduleEditModal";
import { FreelancerAddModal } from "./FreelancerAddModal";
import { formatCurrency } from "@/lib/formatters";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { calculateDailyMetrics } from "@/lib/peakHours";
import { ScheduleExcelFlow } from "./ScheduleExcelFlow";
import { MasterExportButton } from "./MasterExportButton";
import { WeeklyHoursSummary } from "./WeeklyHoursSummary";
import { ClearSchedulesModal } from "./ClearSchedulesModal";

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getWeekDays(baseDate: Date): Date[] {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function ManualScheduleGrid() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, isOperator, isGerenteUnidade } = useUserProfile();
  const lojas = useConfigLojas();
  const canManage = isAdmin || isOperator || isGerenteUnidade;

  const [localUnitId, setLocalUnitId] = useState<string | null>(null);
  const selectedUnit = canManage ? (localUnitId || effectiveUnidadeId) : effectiveUnidadeId;

  const [currentWeekBase, setCurrentWeekBase] = useState(new Date());
  const weekDays = useMemo(() => getWeekDays(currentWeekBase), [currentWeekBase]);
  const weekStart = format(weekDays[0], "yyyy-MM-dd");
  const weekEnd = format(weekDays[6], "yyyy-MM-dd");

  // Sector selection
  const { data: sectors = [], isLoading: loadingSectors } = useSectors(selectedUnit);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [showAllEmployees, setShowAllEmployees] = useState(false);

  const activeSectorId = selectedSectorId || (sectors.length > 0 ? sectors[0].id : null);

  // Sector job title mappings
  const sectorIds = useMemo(() => sectors.map((s) => s.id), [sectors]);
  const { data: sectorJobTitles = [] } = useSectorJobTitles(sectorIds);

  // Staffing matrix for POP
  const { data: staffingMatrix = [] } = useStaffingMatrix(sectorIds);

  const { data: employees = [], isLoading: loadingEmp } = useEmployees(selectedUnit);
  const { data: schedules = [], isLoading: loadingSch } = useManualSchedules(selectedUnit, weekStart, weekEnd);
  const { data: budgets = [] } = useDailyBudgets(selectedUnit, weekStart, weekEnd);
  const upsertBudget = useUpsertDailyBudget();
  const copyDay = useCopyPreviousDay();

  // Edit modal state
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

  // Budget edit popover state
  const [editingBudgetDate, setEditingBudgetDate] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");

  // Filter employees by sector's linked job titles
  const sectorLinkedJobTitleIds = useMemo(() => {
    if (!activeSectorId) return new Set<string>();
    return new Set(
      sectorJobTitles
        .filter((sjt) => sjt.sector_id === activeSectorId)
        .map((sjt) => sjt.job_title_id)
    );
  }, [sectorJobTitles, activeSectorId]);

  const filteredEmployees = useMemo(() => {
    const active = employees.filter(Boolean);
    if (showAllEmployees || !activeSectorId || sectorLinkedJobTitleIds.size === 0) {
      return active;
    }
    return active.filter((emp) => emp.job_title_id && sectorLinkedJobTitleIds.has(emp.job_title_id));
  }, [employees, showAllEmployees, activeSectorId, sectorLinkedJobTitleIds]);

  // Sort: CLT first, then freelancers
  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      const aType = a.worker_type || "clt";
      const bType = b.worker_type || "clt";
      if (aType === bType) return a.name.localeCompare(b.name);
      return aType === "clt" ? -1 : 1;
    });
  }, [filteredEmployees]);

  // Build employee map for worker_type lookup
  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.worker_type || "clt"));
    return m;
  }, [employees]);

  // Calculate max extras slots needed across the week for the active sector
  const extraSlots = useMemo(() => {
    if (!activeSectorId) return 0;
    let maxExtras = 0;
    for (const day of weekDays) {
      const dow = jsDayToPopDay(day.getDay());
      const entries = staffingMatrix.filter(
        (m) => m.sector_id === activeSectorId && m.day_of_week === dow
      );
      const dayExtras = entries.reduce((sum, e) => sum + (e.extras_count ?? 0), 0);
      if (dayExtras > maxExtras) maxExtras = dayExtras;
    }
    return maxExtras;
  }, [activeSectorId, staffingMatrix, weekDays]);

  // Count how many freelancers are already scheduled per day
  const freelancerCountPerDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const day of weekDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      const count = schedules.filter(
        (s) => s.schedule_date === dateStr && s.sector_id === activeSectorId && s.employee_id && employeeMap.get(s.employee_id) === "freelancer"
      ).length;
      counts.set(dateStr, count);
    }
    return counts;
  }, [schedules, activeSectorId, weekDays, employeeMap]);

  // Calculate daily metrics using time-intersection logic
  function getDayMetrics(dateStr: string) {
    const daySchedules = schedules
      .filter((s) => s.schedule_date === dateStr && s.sector_id === activeSectorId)
      .map((s) => ({
        ...s,
        worker_type: s.employee_id ? employeeMap.get(s.employee_id) || "clt" : "clt",
      }));
    return calculateDailyMetrics(daySchedules);
  }

  function getPopTarget(dayOfWeek: number, shiftType: string): { efetivos: number; extras: number; total: number } {
    if (!activeSectorId) return { efetivos: 0, extras: 0, total: 0 };
    const entry = staffingMatrix.find(
      (m) => m.sector_id === activeSectorId && m.day_of_week === dayOfWeek && m.shift_type === shiftType
    );
    const efetivos = entry?.required_count ?? 0;
    const extras = entry?.extras_count ?? 0;
    return { efetivos, extras, total: efetivos + extras };
  }

  function getScheduleForCell(employeeId: string, dateStr: string): ManualSchedule | undefined {
    return schedules.find(
      (s) => s.employee_id === employeeId && s.schedule_date === dateStr && s.sector_id === activeSectorId
    );
  }

  function getBudgetForDay(dateStr: string) {
    return budgets.find((b) => b.date === dateStr);
  }

  function handleCellClick(emp: any, dateStr: string) {
    const existing = getScheduleForCell(emp.id, dateStr) || null;
    setEditModal({
      open: true,
      employeeId: emp.id,
      employeeName: emp.name,
      isFreelancer: emp.worker_type === "freelancer",
      date: dateStr,
      sectorId: existing?.sector_id || activeSectorId || "",
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
          {activeSectorId && sortedEmployees.length > 0 && (
            <ScheduleExcelFlow
              employees={sortedEmployees.map((e) => ({
                id: e.id,
                name: e.name,
                job_title: e.job_title,
                worker_type: e.worker_type || "clt",
              }))}
              weekDays={weekDays}
              sectorName={sectors.find((s) => s.id === activeSectorId)?.name || "Setor"}
              sectorId={activeSectorId}
              unitName={lojas.options.find((l) => l.id === selectedUnit)?.nome || ""}
              unitId={selectedUnit || undefined}
              allUnitEmployees={(employees || []).map((e) => ({
                id: e.id,
                name: e.name,
                job_title: e.job_title,
                worker_type: e.worker_type || "clt",
              }))}
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
                  {lojas.options.map((l) => (
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
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm">
              {format(weekDays[0], "dd MMM", { locale: ptBR })} — {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Grid */}
          <Card>
            <CardContent className="pt-4 px-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : sortedEmployees.length === 0 ? (
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
                      {sortedEmployees.map((emp) => {
                        const isFreelancer = emp.worker_type === "freelancer";
                        return (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate max-w-[120px]">{emp.name}</span>
                                {isFreelancer && (
                                  <Badge variant="outline" className="border-orange-400 text-orange-600 text-[9px] px-1 py-0 shrink-0">
                                    FL
                                  </Badge>
                                )}
                              </div>
                              {emp.job_title && (
                                <div className="text-[10px] text-muted-foreground truncate">{emp.job_title}</div>
                              )}
                            </TableCell>
                            {weekDays.map((day, i) => {
                              const dateStr = format(day, "yyyy-MM-dd");
                              const schedule = getScheduleForCell(emp.id, dateStr);
                              return (
                                <TableCell
                                  key={i}
                                  className="text-center p-1 cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => handleCellClick(emp, dateStr)}
                                >
                                  <ScheduleCell schedule={schedule} isFreelancer={isFreelancer} />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                      {/* VAGA EXTRA placeholder rows */}
                      {extraSlots > 0 && Array.from({ length: extraSlots }, (_, slotIdx) => (
                        <TableRow key={`extra-slot-${slotIdx}`} className="bg-amber-50/50 dark:bg-amber-950/10">
                          <TableCell className="font-medium sticky left-0 bg-amber-50 dark:bg-amber-950/20 z-10 border-r">
                            <div className="flex items-center gap-1.5">
                              <UserPlus className="h-3 w-3 text-amber-500" />
                              <span className="text-amber-700 dark:text-amber-400 text-xs font-semibold">
                                VAGA EXTRA {String(slotIdx + 1).padStart(2, "0")}
                              </span>
                            </div>
                          </TableCell>
                          {weekDays.map((day, i) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const dow = day.getDay();
                            // Check if this slot is within the day's quota
                            const dayEntries = staffingMatrix.filter(
                              (m) => m.sector_id === activeSectorId && m.day_of_week === dow
                            );
                            const dayQuota = dayEntries.reduce((sum, e) => sum + (e.extras_count ?? 0), 0);
                            const alreadyFilled = freelancerCountPerDay.get(dateStr) || 0;
                            const isWithinQuota = slotIdx < dayQuota;
                            const isFilled = slotIdx < alreadyFilled;

                            if (!isWithinQuota) {
                              return (
                                <TableCell key={i} className="text-center p-1">
                                  <div className="h-10 flex items-center justify-center">
                                    <span className="text-muted-foreground/20 text-xs">—</span>
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

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
        />
      )}

      {/* Freelancer Modal */}
      {freelancerModal && selectedUnit && activeSectorId && (
        <FreelancerAddModal
          open={freelancerModal.open}
          onClose={() => setFreelancerModal(null)}
          unitId={selectedUnit}
          sectorId={activeSectorId}
          date={freelancerModal.date}
        />
      )}
    </div>
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

  return (
    <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${bgClass}`} title={`${label}: ${scheduled} escalados / Meta: ${efetivos}+${extras}`}>
      {icon}
      <span>{scheduled}/{efetivos}{extras > 0 && <span className="text-orange-500">+{extras}</span>}</span>
    </div>
  );
}

/* ─── Schedule Cell ─── */

function ScheduleCell({
  schedule,
  isFreelancer,
}: {
  schedule?: ManualSchedule;
  isFreelancer: boolean;
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

  // Working
  const startStr = schedule.start_time?.slice(0, 5) || "";
  const endStr = schedule.end_time?.slice(0, 5) || "";
  const hasBreak = schedule.break_duration > 0;

  return (
    <div
      className={`h-10 flex items-center justify-center rounded-md text-[11px] font-medium px-1 ${
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
  );
}
