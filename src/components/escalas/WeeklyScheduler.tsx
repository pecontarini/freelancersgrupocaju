import { useState, useMemo } from "react";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  UserPlus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileScheduler } from "./MobileScheduler";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useSectors, useShifts, useStaffingMatrix } from "@/hooks/useStaffingMatrix";
import { useEmployees, useAddEmployee } from "@/hooks/useEmployees";
import { useSchedulesBySector, useAddSchedule, useRemoveSchedule } from "@/hooks/useSchedules";
import { useSectorJobTitles } from "@/hooks/useSectorJobTitles";

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getWeekDays(baseDate: Date): Date[] {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function POPBar({
  scheduled,
  target,
}: {
  scheduled: number;
  target: number;
}) {
  if (target === 0) return null;
  const pct = Math.min((scheduled / target) * 100, 100);
  const color =
    scheduled < target
      ? "bg-red-500"
      : scheduled === target
      ? "bg-green-500"
      : "bg-yellow-500";
  const textColor =
    scheduled < target
      ? "text-red-600"
      : scheduled === target
      ? "text-green-600"
      : "text-yellow-600";

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] font-medium">
        <span className={textColor}>
          {scheduled}/{target}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function WeeklyScheduler() {
  const isMobile = useIsMobile();

  // Mobile: render single-day view
  if (isMobile) {
    return <MobileScheduler />;
  }

  return <DesktopScheduler />;
}

function DesktopScheduler() {
  const lojas = useConfigLojas();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedShiftType, setSelectedShiftType] = useState<string>("almoco");
  const [currentWeekBase, setCurrentWeekBase] = useState(new Date());
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpGender, setNewEmpGender] = useState<"M" | "F">("M");

  const weekDays = useMemo(() => getWeekDays(currentWeekBase), [currentWeekBase]);
  const weekStart = format(weekDays[0], "yyyy-MM-dd");
  const weekEnd = format(weekDays[6], "yyyy-MM-dd");

  const { data: sectors = [] } = useSectors(selectedUnit);
  const { data: shifts = [] } = useShifts();
  const sectorIds = sectors.map((s) => s.id);
  const { data: matrix = [] } = useStaffingMatrix(sectorIds);
  const { data: employees = [], isLoading: loadingEmp } = useEmployees(selectedUnit);
  const { data: schedules = [], isLoading: loadingSch } = useSchedulesBySector(
    selectedSector ? [selectedSector] : [],
    weekStart,
    weekEnd
  );

  const addEmployee = useAddEmployee();
  const addSchedule = useAddSchedule();
  const removeSchedule = useRemoveSchedule();

  // Job-title filtering
  const { data: sectorJobTitles = [] } = useSectorJobTitles(selectedSector ? [selectedSector] : []);
  const [showAllRoles, setShowAllRoles] = useState(false);

  const shiftTypes = [...new Set(shifts.map((s) => s.type))];
  const currentShift = shifts.find((s) => s.type === selectedShiftType);

  // Filter employees by sector's allowed job titles
  const filteredEmployees = useMemo(() => {
    if (showAllRoles || sectorJobTitles.length === 0) return employees;
    const allowedIds = new Set(sectorJobTitles.map((sjt) => sjt.job_title_id));
    return employees.filter((e) => e.job_title_id && allowedIds.has(e.job_title_id));
  }, [employees, sectorJobTitles, showAllRoles]);

  // POP targets for current sector/shift
  const getTarget = (dayOfWeek: number) => {
    if (!selectedSector) return 0;
    const entry = matrix.find(
      (m) =>
        m.sector_id === selectedSector &&
        m.day_of_week === dayOfWeek &&
        m.shift_type === selectedShiftType
    );
    return entry?.required_count ?? 0;
  };

  // Schedules for a given day
  const getScheduledForDay = (dateStr: string) =>
    schedules.filter(
      (s) =>
        s.schedule_date === dateStr &&
        s.shift_id === currentShift?.id
    );

  const getEmployeeScheduleForDay = (employeeId: string, dateStr: string) =>
    schedules.find(
      (s) =>
        s.employee_id === employeeId &&
        s.schedule_date === dateStr &&
        s.shift_id === currentShift?.id
    );

  const handleAssign = (employeeId: string, date: Date) => {
    if (!currentShift || !selectedSector) return;
    addSchedule.mutate({
      employee_id: employeeId,
      schedule_date: format(date, "yyyy-MM-dd"),
      shift_id: currentShift.id,
      sector_id: selectedSector,
    });
  };

  const handleUnassign = (scheduleId: string) => {
    removeSchedule.mutate(scheduleId);
  };

  const handleAddEmployee = () => {
    if (!selectedUnit || !newEmpName.trim()) return;
    addEmployee.mutate(
      { unit_id: selectedUnit, name: newEmpName.trim(), gender: newEmpGender },
      {
        onSuccess: () => {
          setNewEmpName("");
          setAddEmployeeOpen(false);
        },
      }
    );
  };

  const navigateWeek = (direction: number) => {
    setCurrentWeekBase((prev) => addDays(prev, direction * 7));
  };

  const isLoading = loadingEmp || loadingSch;

  return (
    <TooltipProvider>
      <div className="space-y-4 fade-in">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Construtor de Escalas</h2>
          <p className="text-muted-foreground">
            Monte a escala semanal com validação CLT em tempo real.
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Unidade</label>
              <Select value={selectedUnit || ""} onValueChange={(v) => { setSelectedUnit(v); setSelectedSector(null); }}>
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

            {selectedUnit && sectors.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Setor</label>
                <Select value={selectedSector || ""} onValueChange={setSelectedSector}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {shiftTypes.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Turno</label>
                <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map((t) => {
                      const sh = shifts.find((s) => s.type === t);
                      return (
                        <SelectItem key={t} value={t}>
                          {sh?.name || t}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedUnit && (
              <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <UserPlus className="h-4 w-4" /> Funcionário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Funcionário</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <Input
                      placeholder="Nome completo"
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                    />
                    <Select value={newEmpGender} onValueChange={(v) => setNewEmpGender(v as "M" | "F")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddEmployee} disabled={addEmployee.isPending} className="w-full">
                      Adicionar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Week Navigation */}
        {selectedSector && currentShift && (
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
        )}

        {/* POP Progress bars */}
        {selectedSector && currentShift && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Meta POP — {shifts.find((s) => s.type === selectedShiftType)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, i) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayIdx = i; // 0=Mon ... 6=Sun
                  const target = getTarget(dayIdx);
                  const scheduled = getScheduledForDay(dateStr).length;
                  return (
                    <div key={dateStr} className="text-center space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        {DAY_LABELS[i]}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {format(day, "dd/MM")}
                      </div>
                      <POPBar scheduled={scheduled} target={target} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule Grid */}
        {selectedSector && currentShift && (
          <Card>
            <CardContent className="pt-4 px-2">
              {/* Show all toggle */}
              {sectorJobTitles.length > 0 && (
                <div className="flex items-center gap-2 mb-3 px-2">
                  <Switch id="show-all-desktop" checked={showAllRoles} onCheckedChange={setShowAllRoles} />
                  <Label htmlFor="show-all-desktop" className="text-xs text-muted-foreground cursor-pointer">
                    Mostrar todos os cargos
                  </Label>
                </div>
              )}

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-muted-foreground text-sm">
                    {employees.length === 0
                      ? 'Nenhum funcionário cadastrado. Clique em "Funcionário" para adicionar.'
                      : "Nenhum funcionário com cargo vinculado a este setor."}
                  </p>
                  {employees.length > 0 && !showAllRoles && (
                    <div className="flex flex-col items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowAllRoles(true)}>
                        Mostrar todos os cargos
                      </Button>
                      <Button variant="link" size="sm" className="text-xs" onClick={() => {
                        // Navigate to cargos-setores tab
                        const tabTrigger = document.querySelector('[value="cargos-setores"]') as HTMLElement;
                        tabTrigger?.click();
                      }}>
                        Configurar Cargos deste Setor →
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px] sticky left-0 bg-background z-10">
                          Funcionário
                        </TableHead>
                        {weekDays.map((day, i) => (
                          <TableHead key={i} className="text-center min-w-[90px]">
                            <div>{DAY_LABELS[i]}</div>
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {format(day, "dd/MM")}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium sticky left-0 bg-background z-10">
                            <div className="flex items-center gap-1.5">
                              <span>{emp.name}</span>
                              {emp.gender === "F" && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">F</Badge>
                              )}
                            </div>
                          </TableCell>
                          {weekDays.map((day, i) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const existing = getEmployeeScheduleForDay(emp.id, dateStr);
                            return (
                              <TableCell key={i} className="text-center p-1">
                                {existing ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleUnassign(existing.id)}
                                        className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition-colors group"
                                      >
                                        ✓
                                        <X className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Clique para remover</TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        onClick={() => handleAssign(emp.id, day)}
                                        disabled={addSchedule.isPending}
                                        className="inline-flex items-center justify-center rounded-md border border-dashed border-muted-foreground/30 w-8 h-7 text-muted-foreground/40 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Escalar para {DAY_LABELS[i]}</TooltipContent>
                                  </Tooltip>
                                )}
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
        )}

        {!selectedUnit && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Selecione uma unidade para montar a escala.
            </CardContent>
          </Card>
        )}

        {selectedUnit && !selectedSector && sectors.length > 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Selecione um setor para visualizar a escala.
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
