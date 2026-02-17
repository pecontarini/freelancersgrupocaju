import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  UserCheck,
  Target,
  ClipboardCopy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";

import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useSectors, useShifts, useStaffingMatrix } from "@/hooks/useStaffingMatrix";
import { useEmployees } from "@/hooks/useEmployees";
import { useSchedulesBySector } from "@/hooks/useSchedules";
import { useAttendance, useMarkPresent, useMarkAbsent } from "@/hooks/useAttendance";

function getCurrentShiftType(): string {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const timeVal = hour * 60 + minute;
  // Almoço: before 16:00 (960min), Jantar: after
  return timeVal < 960 ? "almoco" : "jantar";
}

const JUSTIFICATIVA_OPTIONS = [
  { value: "atestado", label: "Atestado" },
  { value: "falta_injustificada", label: "Falta Injustificada" },
  { value: "atraso", label: "Atraso" },
  { value: "remanejado", label: "Remanejado DE/PARA" },
];

export function OperationalDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const autoShiftType = getCurrentShiftType();

  const lojas = useConfigLojas();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [shiftType, setShiftType] = useState(autoShiftType);

  // Justification dialog state
  const [justifyDialog, setJustifyDialog] = useState<{
    scheduleId: string;
    employeeId: string;
    employeeName: string;
  } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [remanejadoPara, setRemanejadoPara] = useState<string | null>(null);

  const { data: sectors = [] } = useSectors(selectedUnit);
  const { data: shifts = [] } = useShifts();
  const sectorIds = sectors.map((s) => s.id);
  const { data: matrix = [] } = useStaffingMatrix(sectorIds);
  const { data: employees = [], isLoading: loadingEmp } = useEmployees(selectedUnit);

  const currentShift = shifts.find((s) => s.type === shiftType);

  const { data: schedules = [], isLoading: loadingSch } = useSchedulesBySector(
    selectedSector ? [selectedSector] : [],
    today,
    today
  );

  const { data: attendance = [], isLoading: loadingAtt } = useAttendance(
    today,
    currentShift?.id || null
  );

  const markPresent = useMarkPresent();
  const markAbsent = useMarkAbsent();

  // Filter schedules for today + current shift + selected sector
  const todaySchedules = useMemo(() => {
    if (!currentShift || !selectedSector) return [];
    return schedules.filter(
      (s) =>
        s.schedule_date === today &&
        s.shift_id === currentShift.id &&
        s.sector_id === selectedSector
    );
  }, [schedules, today, currentShift, selectedSector]);

  // Map attendance by schedule_id
  const attendanceMap = useMemo(() => {
    const map = new Map<string, typeof attendance[0]>();
    attendance.forEach((a) => map.set(a.schedule_id, a));
    return map;
  }, [attendance]);

  // KPI values
  const dayOfWeek = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Mon
  const matrixEntry = selectedSector
    ? matrix.find(
        (m) =>
          m.sector_id === selectedSector &&
          m.day_of_week === dayOfWeek &&
          m.shift_type === shiftType
      )
    : null;
  const metaEfetivos = matrixEntry?.required_count ?? 0;
  const metaExtras = (matrixEntry as any)?.extras_count ?? 0;
  const metaPOP = metaEfetivos + metaExtras;

  const escalados = todaySchedules.length;
  const presentes = todaySchedules.filter((s) => {
    const att = attendanceMap.get(s.id);
    return att?.status === "presente";
  }).length;

  const handleMarkPresent = (scheduleId: string, employeeId: string) => {
    if (!currentShift || !selectedSector) return;
    markPresent.mutate({
      schedule_id: scheduleId,
      employee_id: employeeId,
      sector_id: selectedSector,
      attendance_date: today,
      shift_id: currentShift.id,
    });
  };

  const handleOpenJustify = (scheduleId: string, employeeId: string, employeeName: string) => {
    setJustifyDialog({ scheduleId, employeeId, employeeName });
    setJustificativa("");
    setRemanejadoPara(null);
  };

  const handleSubmitJustify = () => {
    if (!justifyDialog || !justificativa || !currentShift || !selectedSector) return;
    markAbsent.mutate(
      {
        schedule_id: justifyDialog.scheduleId,
        employee_id: justifyDialog.employeeId,
        sector_id: selectedSector,
        attendance_date: today,
        shift_id: currentShift.id,
        justificativa,
        remanejado_de_sector_id: justificativa === "remanejado" ? selectedSector : undefined,
        remanejado_para_sector_id: justificativa === "remanejado" ? (remanejadoPara || undefined) : undefined,
      },
      { onSuccess: () => setJustifyDialog(null) }
    );
  };

  // WhatsApp export
  const handleCopyResume = () => {
    const unitName = lojas.options.find((l) => l.id === selectedUnit)?.nome || "—";
    const shiftName = currentShift?.name || shiftType;
    const sectorName = sectors.find((s) => s.id === selectedSector)?.name || "—";

    const divergencias = todaySchedules
      .filter((s) => {
        const att = attendanceMap.get(s.id);
        return !att || att.status !== "presente";
      })
      .map((s) => {
        const emp = employees.find((e) => e.id === s.employee_id);
        const att = attendanceMap.get(s.id);
        const justLabel = att?.justificativa
          ? JUSTIFICATIVA_OPTIONS.find((j) => j.value === att.justificativa)?.label || att.justificativa
          : "Sem registro";

        let extra = "";
        if (att?.justificativa === "remanejado" && att.remanejado_para_sector_id) {
          const targetSector = sectors.find((sc) => sc.id === att.remanejado_para_sector_id);
          extra = ` → ${targetSector?.name || "outro setor"}`;
        }
        return `   - ${emp?.name || "?"} (${justLabel}${extra})`;
      });

    const text = [
      `📋 *Resumo Operacional - ${unitName} (${sectorName}) - ${shiftName}*`,
      ``,
      `✅ Meta POP: ${metaEfetivos}${metaExtras > 0 ? `+${metaExtras}` : ""} (${metaPOP} total)`,
      `👥 Escalados: ${escalados}`,
      `📍 Presentes: ${presentes}`,
      ...(divergencias.length > 0
        ? [`⚠️ Divergências:`, ...divergencias]
        : [`✅ Sem divergências`]),
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      toast.success("Resumo copiado para a área de transferência!");
    });
  };

  const isLoading = loadingEmp || loadingSch || loadingAtt;

  return (
    <div className="space-y-4 fade-in">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Quadro Operacional Digital</h2>
        <p className="text-muted-foreground">
          Conferência diária — {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Unidade</label>
            <Select
              value={selectedUnit || ""}
              onValueChange={(v) => {
                setSelectedUnit(v);
                setSelectedSector(null);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {lojas.options.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
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
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Turno</label>
            <Select value={shiftType} onValueChange={setShiftType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...new Set(shifts.map((s) => s.type))].map((t) => {
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
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {selectedSector && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meta POP</p>
                <p className="text-3xl font-bold">
                  {metaEfetivos}
                  {metaExtras > 0 && <span className="text-orange-500 text-xl">+{metaExtras}</span>}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Escalados</p>
                <p className="text-3xl font-bold">{escalados}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 flex items-center gap-4">
              <div
                className={`rounded-full p-3 ${
                  presentes >= metaPOP
                    ? "bg-green-500/10"
                    : presentes >= metaPOP * 0.7
                    ? "bg-yellow-500/10"
                    : "bg-red-500/10"
                }`}
              >
                <UserCheck
                  className={`h-6 w-6 ${
                    presentes >= metaPOP
                      ? "text-green-500"
                      : presentes >= metaPOP * 0.7
                      ? "text-yellow-500"
                      : "text-red-500"
                  }`}
                />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Presentes</p>
                <p className="text-3xl font-bold">{presentes}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance List */}
      {selectedSector && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Lista de Conferência</CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCopyResume}
              disabled={todaySchedules.length === 0}
            >
              <ClipboardCopy className="h-4 w-4" />
              Gerar Resumo do Turno
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : todaySchedules.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum funcionário escalado para este turno/setor hoje.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Justificativa</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaySchedules.map((schedule) => {
                      const emp = employees.find((e) => e.id === schedule.employee_id);
                      const att = attendanceMap.get(schedule.id);
                      const isPresent = att?.status === "presente";
                      const isAbsent = att?.status === "ausente";

                      return (
                        <TableRow key={schedule.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {emp?.name || "—"}
                              {emp?.gender === "F" && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                  F
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {isPresent ? (
                              <Badge className="bg-green-500/15 text-green-700 border-green-500/30 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Presente
                              </Badge>
                            ) : isAbsent ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Ausente
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                <AlertTriangle className="h-3 w-3" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {att?.justificativa
                              ? JUSTIFICATIVA_OPTIONS.find((j) => j.value === att.justificativa)
                                  ?.label || att.justificativa
                              : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isPresent && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() =>
                                    handleMarkPresent(schedule.id, schedule.employee_id || "")
                                  }
                                  disabled={markPresent.isPending}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Presente
                                </Button>
                              )}
                              {!isPresent && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() =>
                                    handleOpenJustify(
                                      schedule.id,
                                      schedule.employee_id || "",
                                      emp?.name || "—"
                                    )
                                  }
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Justificar
                                </Button>
                              )}
                              {isPresent && (
                                <span className="text-xs text-muted-foreground">✓ OK</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
            Selecione uma unidade para iniciar a conferência.
          </CardContent>
        </Card>
      )}

      {/* Justification Dialog */}
      <Dialog open={!!justifyDialog} onOpenChange={(open) => !open && setJustifyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Justificar Ausência — {justifyDialog?.employeeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Motivo</label>
              <Select value={justificativa} onValueChange={setJustificativa}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {JUSTIFICATIVA_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {justificativa === "remanejado" && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Remanejado PARA setor</label>
                <Select value={remanejadoPara || ""} onValueChange={setRemanejadoPara}>
                  <SelectTrigger>
                    <SelectValue placeholder="Setor destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors
                      .filter((s) => s.id !== selectedSector)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={handleSubmitJustify}
              disabled={!justificativa || markAbsent.isPending}
              className="w-full"
            >
              Registrar Justificativa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
