import { useMemo, useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";

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

interface UnitStats {
  meta: number;
  escalados: number;
  presentes: number;
}

export function AdminGlobalView({ allLojas, shiftType, today, onSelectUnit }: AdminGlobalViewProps) {
  const [loading, setLoading] = useState(true);
  const [unitStatsMap, setUnitStatsMap] = useState<Record<string, UnitStats>>({});

  // Batch-load all data in a single effect instead of per-card hooks
  useEffect(() => {
    if (allLojas.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      try {
        const unitIds = allLojas.map((l) => l.id);

        // 1) Fetch all sectors for all units
        const { data: sectors = [] } = await supabase
          .from("sectors")
          .select("id, unit_id, name")
          .in("unit_id", unitIds);

        const sectorIds = sectors.map((s) => s.id);
        if (sectorIds.length === 0) {
          if (!cancelled) {
            setUnitStatsMap({});
            setLoading(false);
          }
          return;
        }

        // 2) Fetch shift for this type
        const { data: shifts = [] } = await supabase
          .from("shifts")
          .select("id, type")
          .eq("type", shiftType)
          .limit(1);

        const currentShift = shifts[0];
        if (!currentShift) {
          if (!cancelled) {
            setUnitStatsMap({});
            setLoading(false);
          }
          return;
        }

        const dayOfWeek = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

        // 3) Batch fetch: staffing matrix, schedules, attendance
        const [matrixRes, schedulesRes, attendanceRes] = await Promise.all([
          supabase
            .from("staffing_matrix")
            .select("sector_id, day_of_week, shift_type, required_count, extras_count")
            .in("sector_id", sectorIds)
            .eq("day_of_week", dayOfWeek)
            .eq("shift_type", shiftType),
          supabase
            .from("schedules")
            .select("id, sector_id, employee_id, schedule_date, shift_id")
            .in("sector_id", sectorIds)
            .eq("schedule_date", today)
            .eq("shift_id", currentShift.id),
          supabase
            .from("schedule_attendance")
            .select("schedule_id, status")
            .eq("attendance_date", today)
            .eq("shift_id", currentShift.id),
        ]);

        const matrix = matrixRes.data || [];
        const schedules = schedulesRes.data || [];
        const attendance = attendanceRes.data || [];

        // Build attendance map
        const attMap = new Map<string, string>();
        attendance.forEach((a) => attMap.set(a.schedule_id, a.status));

        // Build sector→unit map
        const sectorUnitMap = new Map<string, string>();
        sectors.forEach((s) => sectorUnitMap.set(s.id, s.unit_id));

        // Compute stats per unit
        const stats: Record<string, UnitStats> = {};
        unitIds.forEach((uid) => {
          stats[uid] = { meta: 0, escalados: 0, presentes: 0 };
        });

        // Add matrix targets
        matrix.forEach((m) => {
          const unitId = sectorUnitMap.get(m.sector_id);
          if (unitId && stats[unitId]) {
            stats[unitId].meta += (m.required_count ?? 0) + (m.extras_count ?? 0);
          }
        });

        // Count schedules and attendance
        schedules.forEach((s) => {
          const unitId = sectorUnitMap.get(s.sector_id);
          if (unitId && stats[unitId]) {
            stats[unitId].escalados += 1;
            if (attMap.get(s.id) === "presente") {
              stats[unitId].presentes += 1;
            }
          }
        });

        if (!cancelled) {
          setUnitStatsMap(stats);
          setLoading(false);
        }
      } catch (err) {
        console.error("AdminGlobalView fetch error:", err);
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [allLojas, shiftType, today]);

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
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allLojas.map((loja) => {
              const stats = unitStatsMap[loja.id] || { meta: 0, escalados: 0, presentes: 0 };
              const pct = stats.meta > 0 ? Math.round((stats.presentes / stats.meta) * 100) : 0;
              const isComplete = stats.presentes >= stats.meta && stats.meta > 0;
              const isPartial = !isComplete && stats.presentes >= stats.meta * 0.7;

              return (
                <button
                  key={loja.id}
                  onClick={() => onSelectUnit(loja.id)}
                  className="text-left rounded-lg border bg-card/70 backdrop-blur-sm p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm truncate">{loja.nome}</h4>
                    {stats.meta > 0 ? (
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
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
