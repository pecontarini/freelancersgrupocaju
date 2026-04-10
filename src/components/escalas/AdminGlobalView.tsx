import { useMemo } from "react";
import {
  Users,
  UserCheck,
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { useSectors, useShifts, useStaffingMatrix } from "@/hooks/useStaffingMatrix";
import { useSchedulesBySector } from "@/hooks/useSchedules";
import { useAttendance } from "@/hooks/useAttendance";

interface ConfigOption {
  id: string;
  nome: string;
  created_at: string;
}

interface AdminGlobalViewProps {
  allLojas: ConfigOption[];
  shiftType: string;
  today: string;
  onSelectUnit: (unitId: string) => void;
}

function UnitCard({
  loja,
  shiftType,
  today,
  onClick,
}: {
  loja: ConfigOption;
  shiftType: string;
  today: string;
  onClick: () => void;
}) {
  const { data: sectors = [] } = useSectors(loja.id);
  const { data: shifts = [] } = useShifts();
  const sectorIds = sectors.map((s) => s.id);
  const { data: matrix = [] } = useStaffingMatrix(sectorIds);

  const currentShift = shifts.find((s) => s.type === shiftType);
  const dayOfWeek = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  const { data: schedules = [], isLoading: loadingSch } = useSchedulesBySector(
    sectorIds,
    today,
    today
  );

  const { data: attendance = [], isLoading: loadingAtt } = useAttendance(
    today,
    currentShift?.id || null
  );

  const attendanceMap = useMemo(() => {
    const map = new Map<string, (typeof attendance)[0]>();
    attendance.forEach((a) => map.set(a.schedule_id, a));
    return map;
  }, [attendance]);

  const stats = useMemo(() => {
    if (!currentShift) return { meta: 0, escalados: 0, presentes: 0 };
    let meta = 0;
    let escalados = 0;
    let presentes = 0;

    sectors.forEach((sector) => {
      const me = matrix.find(
        (m) =>
          m.sector_id === sector.id &&
          m.day_of_week === dayOfWeek &&
          m.shift_type === shiftType
      );
      meta += (me?.required_count ?? 0) + (me?.extras_count ?? 0);

      const sectorSchedules = schedules.filter(
        (s) =>
          s.schedule_date === today &&
          s.shift_id === currentShift.id &&
          s.sector_id === sector.id
      );
      escalados += sectorSchedules.length;
      presentes += sectorSchedules.filter((s) => {
        const att = attendanceMap.get(s.id);
        return att?.status === "presente";
      }).length;
    });

    return { meta, escalados, presentes };
  }, [sectors, matrix, schedules, attendanceMap, currentShift, dayOfWeek, shiftType, today]);

  const isLoading = loadingSch || loadingAtt;
  const pct = stats.meta > 0 ? Math.round((stats.presentes / stats.meta) * 100) : 0;
  const isComplete = stats.presentes >= stats.meta && stats.meta > 0;
  const isPartial = !isComplete && stats.presentes >= stats.meta * 0.7;

  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border bg-card/70 backdrop-blur-sm p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm truncate">{loja.nome}</h4>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : stats.meta > 0 ? (
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
            {pct}%
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        <div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Target className="h-3 w-3" />
          </div>
          <p className="text-lg font-bold">{stats.meta}</p>
          <p className="text-[10px] text-muted-foreground">Meta</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
          </div>
          <p className="text-lg font-bold">{stats.escalados}</p>
          <p className="text-[10px] text-muted-foreground">Escalados</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-muted-foreground">
            <UserCheck className="h-3 w-3" />
          </div>
          <p className="text-lg font-bold">{stats.presentes}</p>
          <p className="text-[10px] text-muted-foreground">Presentes</p>
        </div>
      </div>

      <Progress value={pct} className="h-2" />
    </button>
  );
}

export function AdminGlobalView({ allLojas, shiftType, today, onSelectUnit }: AdminGlobalViewProps) {
  if (allLojas.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma unidade cadastrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quadro Operacional — Todas as Unidades</CardTitle>
        <p className="text-sm text-muted-foreground">
          Clique em uma unidade para ver o quadro detalhado.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allLojas.map((loja) => (
            <UnitCard
              key={loja.id}
              loja={loja}
              shiftType={shiftType}
              today={today}
              onClick={() => onSelectUnit(loja.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
