import { useState, useMemo, useEffect } from "react";
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
  LayoutGrid,
  Store,
  Filter,
} from "lucide-react";
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
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSectors, useShifts, useStaffingMatrix } from "@/hooks/useStaffingMatrix";
import { useEmployees } from "@/hooks/useEmployees";
import { useSchedulesBySector } from "@/hooks/useSchedules";
import { useAttendance, useMarkPresent, useMarkAbsent } from "@/hooks/useAttendance";

function getCurrentShiftType(): string {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const timeVal = hour * 60 + minute;
  return timeVal < 960 ? "almoco" : "jantar";
}

const JUSTIFICATIVA_OPTIONS = [
  { value: "atestado", label: "Atestado" },
  { value: "falta_injustificada", label: "Falta Injustificada" },
  { value: "atraso", label: "Atraso" },
  { value: "remanejado", label: "Remanejado DE/PARA" },
];

const ALL_SECTORS_VALUE = "__all__";
const ALL_UNITS_VALUE = "__all_units__";

export function OperationalDashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const autoShiftType = getCurrentShiftType();

  const { options: allLojas, isLoading: loadingLojas } = useConfigLojas();
  const { isAdmin, isOperator, isGerenteUnidade, unidades } = useUserProfile();
  
  // Determine available units based on role
  const availableUnits = useMemo(() => {
    if (isAdmin) return allLojas;
    if ((isOperator || isGerenteUnidade) && unidades.length > 0) {
      return unidades;
    }
    return [];
  }, [isAdmin, isOperator, isGerenteUnidade, unidades, allLojas]);

  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>(ALL_SECTORS_VALUE);
  const [shiftType, setShiftType] = useState(autoShiftType);

  // Auto-select unit for users with a single store
  useEffect(() => {
    if (selectedUnit) return;
    if (!isAdmin && availableUnits.length === 1) {
      setSelectedUnit(availableUnits[0].id);
    }
  }, [availableUnits, isAdmin, selectedUnit]);

  // Justification dialog state
  const [justifyDialog, setJustifyDialog] = useState<{
    scheduleId: string;
    employeeId: string;
    employeeName: string;
    sectorId: string;
  } | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [remanejadoPara, setRemanejadoPara] = useState<string | null>(null);

  const { data: sectors = [] } = useSectors(selectedUnit);
  const { data: shifts = [] } = useShifts();
  const sectorIds = sectors.map((s) => s.id);
  const { data: matrix = [] } = useStaffingMatrix(sectorIds);
  const { data: employees = [], isLoading: loadingEmp } = useEmployees(selectedUnit);

  const currentShift = shifts.find((s) => s.type === shiftType);

  const isAllSectors = selectedSector === ALL_SECTORS_VALUE;
  const activeSectorIds = isAllSectors ? sectorIds : (selectedSector ? [selectedSector] : []);

  const { data: schedules = [], isLoading: loadingSch } = useSchedulesBySector(
    activeSectorIds,
    today,
    today
  );

  const { data: attendance = [], isLoading: loadingAtt } = useAttendance(
    today,
    currentShift?.id || null
  );

  const markPresent = useMarkPresent();
  const markAbsent = useMarkAbsent();

  // Map attendance by schedule_id
  const attendanceMap = useMemo(() => {
    const map = new Map<string, typeof attendance[0]>();
    attendance.forEach((a) => map.set(a.schedule_id, a));
    return map;
  }, [attendance]);

  const dayOfWeek = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  // ─── Per-sector stats (used by both views) ───
  const sectorStats = useMemo(() => {
    if (!currentShift) return [];
    return sectors.map((sector) => {
      const me = matrix.find(
        (m) =>
          m.sector_id === sector.id &&
          m.day_of_week === dayOfWeek &&
          m.shift_type === shiftType
      );
      const metaEfetivos = me?.required_count ?? 0;
      const metaExtras = me?.extras_count ?? 0;
      const metaPOP = metaEfetivos + metaExtras;

      const sectorSchedules = schedules.filter(
        (s) =>
          s.schedule_date === today &&
          s.shift_id === currentShift.id &&
          s.sector_id === sector.id
      );
      const escalados = sectorSchedules.length;
      const presentes = sectorSchedules.filter((s) => {
        const att = attendanceMap.get(s.id);
        return att?.status === "presente";
      }).length;

      return {
        sector,
        metaEfetivos,
        metaExtras,
        metaPOP,
        escalados,
        presentes,
        schedules: sectorSchedules,
      };
    });
  }, [sectors, matrix, schedules, attendanceMap, currentShift, dayOfWeek, shiftType, today]);

  // Totals for KPI
  const totalMeta = sectorStats.reduce((a, s) => a + s.metaPOP, 0);
  const totalEscalados = sectorStats.reduce((a, s) => a + s.escalados, 0);
  const totalPresentes = sectorStats.reduce((a, s) => a + s.presentes, 0);

  // Single-sector derived values
  const singleSectorStat = !isAllSectors
    ? sectorStats.find((s) => s.sector.id === selectedSector)
    : null;
  const todaySchedules = singleSectorStat?.schedules ?? [];
  const metaPOP = singleSectorStat?.metaPOP ?? 0;
  const metaEfetivos = singleSectorStat?.metaEfetivos ?? 0;
  const metaExtras = singleSectorStat?.metaExtras ?? 0;
  const escalados = singleSectorStat?.escalados ?? 0;
  const presentes = singleSectorStat?.presentes ?? 0;

  const handleMarkPresent = (scheduleId: string, employeeId: string, sectorId: string) => {
    if (!currentShift) return;
    markPresent.mutate({
      schedule_id: scheduleId,
      employee_id: employeeId,
      sector_id: sectorId,
      attendance_date: today,
      shift_id: currentShift.id,
    });
  };

  const handleOpenJustify = (scheduleId: string, employeeId: string, employeeName: string, sectorId: string) => {
    setJustifyDialog({ scheduleId, employeeId, employeeName, sectorId });
    setJustificativa("");
    setRemanejadoPara(null);
  };

  const handleSubmitJustify = () => {
    if (!justifyDialog || !justificativa || !currentShift) return;
    markAbsent.mutate(
      {
        schedule_id: justifyDialog.scheduleId,
        employee_id: justifyDialog.employeeId,
        sector_id: justifyDialog.sectorId,
        attendance_date: today,
        shift_id: currentShift.id,
        justificativa,
        remanejado_de_sector_id: justificativa === "remanejado" ? justifyDialog.sectorId : undefined,
        remanejado_para_sector_id: justificativa === "remanejado" ? (remanejadoPara || undefined) : undefined,
      },
      { onSuccess: () => setJustifyDialog(null) }
    );
  };

  // WhatsApp export — works for both single and all sectors
  const handleCopyResume = () => {
    const unitName = availableUnits.find((l) => l.id === selectedUnit)?.nome || "—";
    const shiftName = currentShift?.name || shiftType;

    if (isAllSectors) {
      // Consolidated resume
      const lines: string[] = [
        `📋 *Resumo Operacional - ${unitName} (Todos os Setores) - ${shiftName}*`,
        ``,
        `🎯 Meta Total: ${totalMeta} | 👥 Escalados: ${totalEscalados} | ✅ Presentes: ${totalPresentes}`,
        ``,
      ];
      sectorStats.forEach((ss) => {
        const pct = ss.metaPOP > 0 ? Math.round((ss.presentes / ss.metaPOP) * 100) : 0;
        const icon = ss.presentes >= ss.metaPOP ? "✅" : ss.presentes >= ss.metaPOP * 0.7 ? "⚠️" : "🔴";
        lines.push(`${icon} *${ss.sector.name}*: ${ss.presentes}/${ss.metaPOP} (${pct}%) — Escalados: ${ss.escalados}`);
      });
      navigator.clipboard.writeText(lines.join("\n")).then(() => {
        toast.success("Resumo consolidado copiado!");
      });
    } else {
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
    }
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
              value={selectedUnit || (isAdmin ? ALL_UNITS_VALUE : "")}
              onValueChange={(v) => {
                setSelectedUnit(v === ALL_UNITS_VALUE ? null : v);
                setSelectedSector(ALL_SECTORS_VALUE);
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {isAdmin && (
                  <SelectItem value={ALL_UNITS_VALUE}>
                    <span className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Todas as unidades
                    </span>
                  </SelectItem>
                )}
                {availableUnits.map((l) => (
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
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SECTORS_VALUE}>
                    <span className="flex items-center gap-1.5">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Todos os setores
                    </span>
                  </SelectItem>
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

      {/* ═══ VISÃO GERAL (todos os setores) ═══ */}
      {selectedUnit && isAllSectors && (
        <>
          {/* KPIs consolidados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-3">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Meta Total</p>
                  <p className="text-3xl font-bold">{totalMeta}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="rounded-full bg-blue-500/10 p-3">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Escalados Total</p>
                  <p className="text-3xl font-bold">{totalEscalados}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-4">
                <div
                  className={`rounded-full p-3 ${
                    totalPresentes >= totalMeta
                      ? "bg-green-500/10"
                      : totalPresentes >= totalMeta * 0.7
                      ? "bg-yellow-500/10"
                      : "bg-red-500/10"
                  }`}
                >
                  <UserCheck
                    className={`h-6 w-6 ${
                      totalPresentes >= totalMeta
                        ? "text-green-500"
                        : totalPresentes >= totalMeta * 0.7
                        ? "text-yellow-500"
                        : "text-red-500"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Presentes Total</p>
                  <p className="text-3xl font-bold">{totalPresentes}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grid de cards por setor */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Visão Geral por Setor</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleCopyResume}
                disabled={sectorStats.length === 0}
              >
                <ClipboardCopy className="h-4 w-4" />
                Gerar Resumo Consolidado
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : sectorStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum setor cadastrado para esta unidade.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sectorStats.map((ss) => {
                    const pct = ss.metaPOP > 0 ? Math.round((ss.presentes / ss.metaPOP) * 100) : 0;
                    const isComplete = ss.presentes >= ss.metaPOP && ss.metaPOP > 0;
                    const isPartial = !isComplete && ss.presentes >= ss.metaPOP * 0.7;
                    const isCritical = !isComplete && !isPartial;

                    return (
                      <button
                        key={ss.sector.id}
                        onClick={() => setSelectedSector(ss.sector.id)}
                        className="text-left rounded-lg border bg-card/70 backdrop-blur-sm p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm">{ss.sector.name}</h4>
                          {ss.metaPOP > 0 && (
                            <Badge
                              variant={isComplete ? "default" : "outline"}
                              className={
                                isComplete
                                  ? "bg-green-500/15 text-green-700 border-green-500/30"
                                  : isPartial
                                  ? "bg-yellow-500/15 text-yellow-700 border-yellow-500/30"
                                  : "bg-red-500/15 text-red-700 border-red-500/30"
                              }
                            >
                              {isComplete ? (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              ) : isPartial ? (
                                <AlertTriangle className="h-3 w-3 mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {isComplete ? "Completo" : isPartial ? "Parcial" : "Crítico"}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Meta: {ss.metaEfetivos}{ss.metaExtras > 0 ? `+${ss.metaExtras}` : ""}</span>
                            <span>Escalados: {ss.escalados}</span>
                            <span>Presentes: {ss.presentes}</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                          <p className="text-xs text-muted-foreground text-right">{pct}%</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ VISÃO POR SETOR (individual) ═══ */}
      {selectedUnit && !isAllSectors && selectedSector && (
        <>
          {/* Back to overview */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedSector(ALL_SECTORS_VALUE)}
            className="gap-1.5 text-muted-foreground"
          >
            <LayoutGrid className="h-4 w-4" />
            ← Voltar para Visão Geral
          </Button>

          {/* KPI Cards */}
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

          {/* Attendance List */}
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
                                      handleMarkPresent(schedule.id, schedule.employee_id || "", selectedSector)
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
                                        emp?.name || "—",
                                        selectedSector
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
        </>
      )}

      {!selectedUnit && !isAdmin && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione uma unidade para iniciar a conferência.
          </CardContent>
        </Card>
      )}

      {/* ═══ VISÃO GLOBAL ADMIN (todas as unidades) ═══ */}
      {!selectedUnit && isAdmin && (
        <AdminGlobalView
          allLojas={allLojas}
          shiftType={shiftType}
          today={today}
          onSelectUnit={(unitId) => {
            setSelectedUnit(unitId);
            setSelectedSector(ALL_SECTORS_VALUE);
          }}
        />
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
                      .filter((s) => s.id !== (justifyDialog?.sectorId || selectedSector))
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
