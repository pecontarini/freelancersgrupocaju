import { useState, useMemo, useCallback } from "react";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Search,
  Copy,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import {
  useSectors,
  useShifts,
  useStaffingMatrix,
} from "@/hooks/useStaffingMatrix";
import { useEmployees } from "@/hooks/useEmployees";
import {
  useSchedulesBySector,
  useAddSchedule,
  useRemoveSchedule,
} from "@/hooks/useSchedules";

export function MobileScheduler() {
  const lojas = useConfigLojas();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedShiftType, setSelectedShiftType] = useState<string>("almoco");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSectorId, setDrawerSectorId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState("");

  const dateStr = format(currentDate, "yyyy-MM-dd");

  const { data: sectors = [] } = useSectors(selectedUnit);
  const { data: shifts = [] } = useShifts();
  const sectorIds = useMemo(() => sectors.map((s) => s.id), [sectors]);
  const { data: matrix = [] } = useStaffingMatrix(sectorIds);
  const { data: employees = [], isLoading: loadingEmp } = useEmployees(selectedUnit);
  const { data: schedules = [], isLoading: loadingSch } = useSchedulesBySector(
    sectorIds,
    dateStr,
    dateStr
  );

  const addSchedule = useAddSchedule();
  const removeSchedule = useRemoveSchedule();

  const shiftTypes = useMemo(() => [...new Set(shifts.map((s) => s.type))], [shifts]);
  const currentShift = shifts.find((s) => s.type === selectedShiftType);

  // Day of week (0=Mon, 6=Sun) for matrix lookup
  const dayOfWeek = useMemo(() => {
    const jsDay = currentDate.getDay(); // 0=Sun
    return jsDay === 0 ? 6 : jsDay - 1;
  }, [currentDate]);

  // POP target for a given sector
  const getTarget = useCallback(
    (sectorId: string) => {
      const entry = matrix.find(
        (m) =>
          m.sector_id === sectorId &&
          m.day_of_week === dayOfWeek &&
          m.shift_type === selectedShiftType
      );
      return entry?.required_count ?? 0;
    },
    [matrix, dayOfWeek, selectedShiftType]
  );

  // Schedules for a sector on current day & shift
  const getScheduledForSector = useCallback(
    (sectorId: string) =>
      schedules.filter(
        (s) =>
          s.sector_id === sectorId &&
          s.schedule_date === dateStr &&
          s.shift_id === currentShift?.id
      ),
    [schedules, dateStr, currentShift]
  );

  // Employees already scheduled for this day/shift (any sector)
  const scheduledEmployeeIds = useMemo(() => {
    if (!currentShift) return new Set<string>();
    return new Set(
      schedules
        .filter((s) => s.schedule_date === dateStr && s.shift_id === currentShift.id)
        .map((s) => s.employee_id)
        .filter(Boolean) as string[]
    );
  }, [schedules, dateStr, currentShift]);

  // Available employees for drawer
  const availableEmployees = useMemo(() => {
    const search = empSearch.toLowerCase().trim();
    return employees.filter((e) => {
      if (scheduledEmployeeIds.has(e.id)) return false;
      if (search && !e.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [employees, scheduledEmployeeIds, empSearch]);

  const handleAssign = (employeeId: string) => {
    if (!currentShift || !drawerSectorId) return;
    addSchedule.mutate(
      {
        employee_id: employeeId,
        schedule_date: dateStr,
        shift_id: currentShift.id,
        sector_id: drawerSectorId,
      },
      {
        onSuccess: () => {
          // Keep drawer open for batch adds
        },
      }
    );
  };

  const handleUnassign = (scheduleId: string) => {
    removeSchedule.mutate(scheduleId);
  };

  const openAddDrawer = (sectorId: string) => {
    setDrawerSectorId(sectorId);
    setEmpSearch("");
    setDrawerOpen(true);
  };

  // Copy from yesterday
  const handleCopyYesterday = async () => {
    if (!currentShift || sectorIds.length === 0) return;

    const yesterday = format(subDays(currentDate, 1), "yyyy-MM-dd");

    // Find yesterday's schedules for same shift
    const yesterdaySchedules = schedules.filter(
      (s) => s.schedule_date === yesterday && s.shift_id === currentShift.id
    );

    // We need to query yesterday separately since our query is only for today
    // For now, toast a message about the feature
    toast.info("Para copiar a escala de ontem, use a visão desktop (calendário semanal).", {
      duration: 4000,
    });
  };

  const navigateDay = (dir: number) => {
    setCurrentDate((prev) => addDays(prev, dir));
  };

  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;
  const isLoading = loadingEmp || loadingSch;

  // Swipe handling
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 60) {
      navigateDay(diff > 0 ? -1 : 1);
    }
    setTouchStartX(null);
  };

  return (
    <div className="space-y-3">
      {/* Unit & Shift Selectors */}
      <div className="flex gap-2">
        <Select
          value={selectedUnit || ""}
          onValueChange={(v) => setSelectedUnit(v)}
        >
          <SelectTrigger className="flex-1 h-11">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            {lojas.options.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {shiftTypes.length > 0 && (
          <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
            <SelectTrigger className="w-[120px] h-11">
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
        )}
      </div>

      {!selectedUnit && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Selecione uma unidade para montar a escala.
          </CardContent>
        </Card>
      )}

      {selectedUnit && (
        <>
          {/* Day Navigator with swipe */}
          <div
            className="flex items-center justify-between bg-muted/50 rounded-xl p-1"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => navigateDay(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <button
              className="flex-1 text-center py-2"
              onClick={() => setCurrentDate(new Date())}
            >
              <p className="text-sm font-bold capitalize">
                {isToday
                  ? "Hoje"
                  : format(currentDate, "EEEE", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(currentDate, "dd 'de' MMMM", { locale: ptBR })}
              </p>
            </button>

            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onClick={() => navigateDay(1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {/* Sector Accordions */}
          {!isLoading && sectors.length > 0 && currentShift && (
            <Accordion
              type="multiple"
              defaultValue={sectors.map((s) => s.id)}
              className="space-y-2"
            >
              {sectors.map((sector) => {
                const sectorSchedules = getScheduledForSector(sector.id);
                const target = getTarget(sector.id);
                const count = sectorSchedules.length;
                const deficit = target > 0 && count < target;
                const met = target > 0 && count >= target;
                const over = target > 0 && count > target;

                return (
                  <AccordionItem
                    key={sector.id}
                    value={sector.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-semibold text-sm truncate">
                          {sector.name}
                        </span>
                        <Badge
                          variant={deficit ? "destructive" : over ? "secondary" : "default"}
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {count}/{target || "—"}
                        </Badge>
                        {/* Compact POP bar */}
                        {target > 0 && (
                          <div className="flex-1 max-w-24 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                deficit
                                  ? "bg-destructive"
                                  : met && !over
                                  ? "bg-green-500"
                                  : "bg-yellow-500"
                              }`}
                              style={{
                                width: `${Math.min((count / target) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-3 pb-3 pt-0">
                      <div className="space-y-2">
                        {sectorSchedules.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">
                            Nenhum funcionário escalado.
                          </p>
                        )}

                        {sectorSchedules.map((sch) => {
                          const emp = employees.find(
                            (e) => e.id === sch.employee_id
                          );
                          if (!emp) return null;

                          const isConfirmed =
                            (sch as any).confirmation_status === "confirmed";
                          const isDenied =
                            (sch as any).confirmation_status === "denied";

                          return (
                            <div
                              key={sch.id}
                              className="flex items-center gap-3 rounded-lg border bg-card p-3 min-h-[56px]"
                            >
                              {/* Avatar placeholder */}
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                {emp.name
                                  .split(" ")
                                  .slice(0, 2)
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {emp.name}
                                </p>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {currentShift?.start_time?.slice(0, 5)} –{" "}
                                    {currentShift?.end_time?.slice(0, 5)}
                                  </span>
                                </div>
                              </div>

                              {/* Status icon */}
                              {isConfirmed && (
                                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                              )}
                              {isDenied && (
                                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                              )}

                              {/* Remove button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleUnassign(sch.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}

                        {/* Add button */}
                        <Button
                          variant="outline"
                          className="w-full h-12 border-dashed gap-2 text-muted-foreground"
                          onClick={() => openAddDrawer(sector.id)}
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar em {sector.name}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {!isLoading && selectedUnit && sectors.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Nenhum setor cadastrado para esta unidade. Configure na aba
                "Configurações (Matriz)".
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Employee Bottom Sheet */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle>
              Adicionar em{" "}
              {sectors.find((s) => s.id === drawerSectorId)?.name || "Setor"}
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 space-y-3 overflow-auto flex-1">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar funcionário..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="pl-9 h-11"
              />
            </div>

            {/* Shift info */}
            {currentShift && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Turno: {currentShift.name} ({currentShift.start_time?.slice(0, 5)} –{" "}
                  {currentShift.end_time?.slice(0, 5)})
                </span>
              </div>
            )}

            {/* Employee list */}
            <div className="space-y-1.5 pb-4">
              {availableEmployees.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  {empSearch
                    ? "Nenhum funcionário encontrado."
                    : "Todos os funcionários já estão escalados."}
                </p>
              ) : (
                availableEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => handleAssign(emp.id)}
                    disabled={addSchedule.isPending}
                    className="flex items-center gap-3 w-full rounded-lg border p-3 min-h-[56px] text-left hover:bg-muted/50 active:bg-muted transition-colors disabled:opacity-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                      {emp.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.name}</p>
                      {emp.job_title && (
                        <p className="text-xs text-muted-foreground">{emp.job_title}</p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>

          <DrawerFooter className="pt-0">
            <DrawerClose asChild>
              <Button variant="outline" className="h-12">
                Fechar
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
