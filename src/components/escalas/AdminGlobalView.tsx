import { useMemo } from "react";
import {
  Users,
  UserCheck,
  Target,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePopStatusDiario, aggregateStatus, type PopStatus } from "@/hooks/usePopStatusDiario";

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
  status: PopStatus | null;
}

function statusBadgeClass(status: PopStatus | null): string {
  switch (status) {
    case "VERMELHO":
      return "bg-red-500/15 text-red-700 border-red-500/30";
    case "AMARELO":
      return "bg-yellow-500/15 text-yellow-700 border-yellow-500/30";
    case "VERDE_RESSALVA":
      return "bg-green-500/15 text-green-700 border-green-500/30";
    case "VERDE_PURO":
      return "bg-green-500/15 text-green-700 border-green-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function StatusIcon({ status }: { status: PopStatus | null }) {
  if (status === "VERMELHO") return <XCircle className="h-3 w-3 mr-1" />;
  if (status === "AMARELO") return <AlertTriangle className="h-3 w-3 mr-1" />;
  return <CheckCircle2 className="h-3 w-3 mr-1" />;
}

export function AdminGlobalView({ allLojas, shiftType, today, onSelectUnit }: AdminGlobalViewProps) {
  const { data: rows = [], isLoading } = usePopStatusDiario(today);

  const unitStatsMap = useMemo(() => {
    const map: Record<string, UnitStats> = {};
    for (const loja of allLojas) {
      map[loja.id] = { meta: 0, escalados: 0, presentes: 0, status: null };
    }
    const shiftUpper = (shiftType || "").toUpperCase();
    const filtered = rows.filter((r) => r.refeicao === shiftUpper);
    const byUnit = new Map<string, typeof rows>();
    for (const r of filtered) {
      if (!byUnit.has(r.unit_id)) byUnit.set(r.unit_id, []);
      byUnit.get(r.unit_id)!.push(r);
    }
    for (const [unitId, unitRows] of byUnit) {
      if (!map[unitId]) continue;
      map[unitId] = {
        meta: unitRows.reduce((a, r) => a + (r.pop_total || 0), 0),
        escalados: unitRows.reduce((a, r) => a + (r.escalados_clt || 0), 0),
        presentes: unitRows.reduce((a, r) => a + (r.ponto_clt || 0) + (r.checkin_free || 0), 0),
        status: aggregateStatus(unitRows),
      };
    }
    return map;
  }, [rows, shiftType, allLojas]);

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
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <TooltipProvider delayDuration={150}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allLojas.map((loja) => {
                const stats = unitStatsMap[loja.id] || { meta: 0, escalados: 0, presentes: 0, status: null };
                const pct = stats.meta > 0 ? Math.round((stats.presentes / stats.meta) * 100) : 0;

                return (
                  <button
                    key={loja.id}
                    onClick={() => onSelectUnit(loja.id)}
                    className="text-left rounded-lg border bg-card/70 backdrop-blur-sm p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <h4 className="font-semibold text-sm truncate">{loja.nome}</h4>
                      <div className="flex items-center gap-1">
                        {stats.status === "VERDE_RESSALVA" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center text-yellow-600"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Mix desviado (CLT/Free fora do plano)</TooltipContent>
                          </Tooltip>
                        )}
                        {stats.meta > 0 && stats.status && (
                          <Badge variant="outline" className={statusBadgeClass(stats.status)}>
                            <StatusIcon status={stats.status} />
                            {pct}%
                          </Badge>
                        )}
                      </div>
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
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
