import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CalendarOff,
  Palmtree,
  Stethoscope,
  DollarSign,
  AlertTriangle,
  Loader2,
  Trash2,
  ArrowLeft,
  Clock4,
  Sun,
  CheckCircle2,
} from "lucide-react";
import { useUpsertSchedule, useCancelSchedule, useBulkVacation, type ManualSchedule } from "@/hooks/useManualSchedules";
import { PracaSelector } from "./PracaSelector";
import { dateStrToDiaPraca, inferTurnoFromTime } from "@/hooks/usePracas";
import {
  useEmployeeSundaysOff,
  monthRefFromDate,
  isSundayDate,
  formatSundayShort,
} from "@/hooks/useSundayOff";

interface ScheduleEditModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  isFreelancer: boolean;
  date: string; // YYYY-MM-DD
  sectorId: string;
  shiftType?: string;
  existing?: ManualSchedule | null;
  unitId?: string | null;
  sectorName?: string | null;
}

function calculateHours(start: string, end: string, breakMin: number): string {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let totalMin = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMin < 0) totalMin += 24 * 60;
  totalMin -= breakMin;
  if (totalMin < 0) totalMin = 0;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m > 0 ? `${m}min` : ""}`.trim();
}

function countDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  if (e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export function ScheduleEditModal({
  open,
  onClose,
  employeeId,
  employeeName,
  isFreelancer,
  date,
  sectorId,
  shiftType,
  existing,
  unitId,
  sectorName,
}: ScheduleEditModalProps) {
  const upsert = useUpsertSchedule();
  const cancel = useCancelSchedule();
  const bulkVacation = useBulkVacation();

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:20");
  const [breakDuration, setBreakDuration] = useState(60);
  const [agreedRate, setAgreedRate] = useState("");
  const [pracaId, setPracaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("turno");

  // Vacation sub-form state
  const [showVacationForm, setShowVacationForm] = useState(false);
  const [vacStartDate, setVacStartDate] = useState(date);
  const [vacEndDate, setVacEndDate] = useState("");

  const vacDays = useMemo(() => countDays(vacStartDate, vacEndDate), [vacStartDate, vacEndDate]);

  // Initialize from existing
  useEffect(() => {
    if (existing) {
      setStartTime(existing.start_time?.slice(0, 5) || "08:00");
      setEndTime(existing.end_time?.slice(0, 5) || "16:20");
      setBreakDuration(existing.break_duration ?? 60);
      setAgreedRate(existing.agreed_rate ? String(existing.agreed_rate) : (isFreelancer ? "120" : ""));
      setPracaId(existing.praca_id ?? null);
      if (existing.schedule_type !== "working") {
        setActiveTab("ausencias");
      } else {
        setActiveTab("turno");
      }
    } else {
      setStartTime("08:00");
      setEndTime("16:20");
      setBreakDuration(60);
      setAgreedRate(isFreelancer ? "120" : "");
      setPracaId(null);
      setActiveTab("turno");
    }
    setShowVacationForm(false);
    setVacStartDate(date);
    setVacEndDate("");
  }, [existing, open, date]);

  const totalHours = useMemo(
    () => calculateHours(startTime, endTime, breakDuration),
    [startTime, endTime, breakDuration]
  );

  const totalMinutes = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let total = (eh * 60 + em) - (sh * 60 + sm);
    if (total < 0) total += 24 * 60;
    return total - breakDuration;
  }, [startTime, endTime, breakDuration]);

  const overTimeWarning = totalMinutes > 600;

  async function handleSaveShift() {
    await upsert.mutateAsync({
      id: existing?.id,
      employee_id: employeeId,
      schedule_date: date,
      sector_id: sectorId,
      start_time: startTime,
      end_time: endTime,
      break_duration: breakDuration,
      schedule_type: "working",
      agreed_rate: parseFloat(agreedRate) || 0,
      shift_type: shiftType,
      praca_id: pracaId,
    });
    onClose();
  }

  async function handleSetAbsence(type: "off" | "sick_leave" | "banco_horas") {
    await upsert.mutateAsync({
      id: existing?.id,
      employee_id: employeeId,
      schedule_date: date,
      sector_id: sectorId,
      schedule_type: type,
      start_time: null,
      end_time: null,
      break_duration: 0,
      agreed_rate: 0,
      shift_type: shiftType,
    });
    onClose();
  }

  async function handleBulkVacation() {
    await bulkVacation.mutateAsync({
      employee_id: employeeId,
      sector_id: sectorId,
      start_date: vacStartDate,
      end_date: vacEndDate,
      shift_type: shiftType,
    });
    onClose();
  }

  async function handleDelete() {
    if (existing) {
      await cancel.mutateAsync(existing.id);
    }
    onClose();
  }

  // Sunday-off tracking (CLT only) — month of currently displayed date
  const monthRef = useMemo(() => monthRefFromDate(date), [date]);
  const dateIsSunday = useMemo(() => isSundayDate(date), [date]);
  const { data: sundaysOff = [] } = useEmployeeSundaysOff(
    !isFreelancer ? employeeId : null,
    !isFreelancer ? monthRef : null
  );
  const hasSundayOffThisMonth = sundaysOff.length > 0;
  const monthLabel = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { month: "long" }).toUpperCase();

  const isSaving = upsert.isPending || cancel.isPending || bulkVacation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="uppercase">{employeeName}</span>
            {isFreelancer && (
              <Badge variant="outline" className="border-orange-400 text-orange-600 text-[10px]">
                Freelancer
              </Badge>
            )}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="turno" className="flex-1 gap-1">
              <Clock className="h-3.5 w-3.5" /> Turno
            </TabsTrigger>
            <TabsTrigger value="ausencias" className="flex-1 gap-1">
              <CalendarOff className="h-3.5 w-3.5" /> Ausências
            </TabsTrigger>
            {isFreelancer && (
              <TabsTrigger value="financeiro" className="flex-1 gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Financeiro
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tab A: Turno */}
          <TabsContent value="turno" className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fim</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Intervalo (minutos)</Label>
              <Input type="number" min={0} max={180} value={breakDuration} onChange={(e) => setBreakDuration(Number(e.target.value))} />
            </div>
            {unitId && sectorName && (
              <PracaSelector
                unitId={unitId}
                sectorName={sectorName}
                turno={inferTurnoFromTime(startTime)}
                dia={dateStrToDiaPraca(date)}
                value={pracaId}
                onChange={setPracaId}
              />
            )}
            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <span className="text-sm font-medium">Total de horas:</span>
              <span className="text-lg font-bold">{totalHours}</span>
            </div>
            {overTimeWarning && (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Atenção: Jornada acima de 10h (Art. 59 CLT)</span>
              </div>
            )}
            {!isFreelancer && dateIsSunday && (
              hasSundayOffThisMonth ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 p-2.5 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    {employeeName.split(" ")[0]} já teve folga dominical em {monthLabel} ({sundaysOff.map(formatSundayShort).join(", ")}).
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-2.5 text-xs text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {employeeName.split(" ")[0]} ainda não teve domingo de folga em {monthLabel}.
                  </span>
                </div>
              )
            )}
            <Button className="w-full" onClick={handleSaveShift} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Turno
            </Button>
          </TabsContent>

          {/* Tab B: Ausências */}
          <TabsContent value="ausencias" className="space-y-3 pt-2">
            {!showVacationForm ? (
              <>
                <Button
                  variant="outline"
                  className="w-full h-14 text-base gap-2 border-2"
                  onClick={() => handleSetAbsence("off")}
                  disabled={isSaving}
                >
                  <CalendarOff className="h-5 w-5" />
                  MARCAR FOLGA
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-14 text-base gap-2 border-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/30"
                  onClick={() => setShowVacationForm(true)}
                  disabled={isSaving}
                >
                  <Palmtree className="h-5 w-5" />
                  MARCAR FÉRIAS
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-14 text-base gap-2 border-2 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                  onClick={() => handleSetAbsence("sick_leave")}
                  disabled={isSaving}
                >
                  <Stethoscope className="h-5 w-5" />
                  ATESTADO
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 -ml-2"
                  onClick={() => setShowVacationForm(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>

                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                  <Palmtree className="h-5 w-5" />
                  <span className="font-semibold text-base">Lançar Férias em Lote</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={vacStartDate}
                      onChange={(e) => setVacStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={vacEndDate}
                      onChange={(e) => setVacEndDate(e.target.value)}
                      min={vacStartDate}
                    />
                  </div>
                </div>

                {vacDays > 0 && (
                  <div className="flex items-center justify-between rounded-lg border border-purple-200 dark:border-purple-800 p-3 bg-purple-50 dark:bg-purple-950/20">
                    <span className="text-sm font-medium">Dias de férias:</span>
                    <span className="text-lg font-bold text-purple-700 dark:text-purple-400">{vacDays} dia(s)</span>
                  </div>
                )}

                {vacDays > 45 && (
                  <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Período máximo de 45 dias.</span>
                  </div>
                )}

                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleBulkVacation}
                  disabled={isSaving || vacDays === 0 || vacDays > 45 || !vacEndDate}
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirmar Férias ({vacDays} dias)
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab C: Financeiro */}
          {isFreelancer && (
            <TabsContent value="financeiro" className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Valor da Diária (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={agreedRate}
                  onChange={(e) => setAgreedRate(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <Button className="w-full" onClick={handleSaveShift} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Valor
              </Button>
            </TabsContent>
          )}
        </Tabs>

        {/* Delete */}
        {existing && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive mt-1"
            onClick={handleDelete}
            disabled={isSaving}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remover Escala
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}