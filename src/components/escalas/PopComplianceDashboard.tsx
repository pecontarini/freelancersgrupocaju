import { useState, useMemo } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MultiSelect } from "@/components/ui/multi-select";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { usePopCompliance, type UnitDayStatus, type SectorCompliance } from "@/hooks/usePopCompliance";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function getWeekDays(base: Date): Date[] {
  const start = startOfWeek(base, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const statusColors = {
  ok: "bg-green-500",
  warning: "bg-yellow-500",
  critical: "bg-red-500",
};

const statusBg = {
  ok: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  warning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

export function PopComplianceDashboard() {
  const lojas = useConfigLojas();
  const [weekBase, setWeekBase] = useState(new Date());
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [shiftFilter, setShiftFilter] = useState<"almoco" | "jantar" | "both">("both");

  const weekDays = useMemo(() => getWeekDays(weekBase), [weekBase]);
  const dateStrs = useMemo(() => weekDays.map((d) => format(d, "yyyy-MM-dd")), [weekDays]);

  const { data, isLoading } = usePopCompliance(weekBase, selectedUnits, shiftFilter);

  const navigateWeek = (dir: number) => setWeekBase((prev) => addDays(prev, dir * 7));

  // Group unitDays by unit for the compliance map
  const unitRows = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { unitId: string; unitName: string; days: Map<string, UnitDayStatus> }>();
    for (const ud of data.unitDays) {
      if (!map.has(ud.unitId)) {
        map.set(ud.unitId, { unitId: ud.unitId, unitName: ud.unitName, days: new Map() });
      }
      map.get(ud.unitId)!.days.set(ud.dateStr, ud);
    }
    return [...map.values()].sort((a, b) => a.unitName.localeCompare(b.unitName));
  }, [data]);

  const storeOptions = useMemo(
    () => lojas.options.map((l) => ({ value: l.id, label: l.nome })),
    [lojas.options]
  );

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Dashboard POP — Conformidade
        </h2>
        <p className="text-muted-foreground text-sm">
          Visão consolidada de aderência ao POP por loja, setor e dia.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          {/* Week nav */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[180px] text-center">
              {format(weekDays[0], "dd MMM", { locale: ptBR })} — {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Store filter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Loja</label>
            <MultiSelect
              options={storeOptions}
              selected={selectedUnits}
              onChange={setSelectedUnits}
              placeholder="Todas as lojas"
              className="w-[220px]"
            />
          </div>

          {/* Shift filter */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Turno</label>
            <Select value={shiftFilter} onValueChange={(v) => setShiftFilter(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Ambos</SelectItem>
                <SelectItem value="almoco">Almoço</SelectItem>
                <SelectItem value="jantar">Jantar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !data ? null : (
        <>
          {/* Block 1 — KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              title="Setores monitorados"
              value={data.totalSectors}
              icon={<BarChart3 className="h-5 w-5" />}
              color="text-primary"
            />
            <KPICard
              title="100% conformes"
              value={data.conformeSectors}
              icon={<CheckCircle2 className="h-5 w-5" />}
              color="text-green-600 dark:text-green-400"
            />
            <KPICard
              title="Com gaps"
              value={data.warningSectors}
              icon={<AlertTriangle className="h-5 w-5" />}
              color="text-yellow-600 dark:text-yellow-400"
            />
            <KPICard
              title="Críticos"
              value={data.criticalSectors}
              icon={<XCircle className="h-5 w-5" />}
              color="text-red-600 dark:text-red-400"
            />
          </div>

          {/* Block 2 — Compliance Map */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mapa de conformidade por loja</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px] sticky left-0 bg-background z-10 border-r">Loja</TableHead>
                      {DAY_LABELS.map((label, i) => (
                        <TableHead key={i} className="text-center min-w-[80px]">
                          <div>{label}</div>
                          <div className="text-[10px] font-normal text-muted-foreground">
                            {format(weekDays[i], "dd/MM")}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unitRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum dado POP configurado para o período selecionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      unitRows.map((unit) => (
                        <ComplianceRow
                          key={unit.unitId}
                          unitName={unit.unitName}
                          dateStrs={dateStrs}
                          days={unit.days}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Block 3 — Gap Ranking */}
          {data.sectorGapRanking.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Ranking de gaps na semana</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.sectorGapRanking}
                      layout="vertical"
                      margin={{ left: 10, right: 20 }}
                    >
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        dataKey="sectorId"
                        type="category"
                        width={200}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} dia(s) abaixo do POP`, "Gaps"]}
                      />
                      <Bar dataKey="gapDays" radius={[0, 4, 4, 0]}>
                        {data.sectorGapRanking.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.gapDays >= 5 ? "hsl(0, 70%, 50%)" : entry.gapDays >= 3 ? "hsl(40, 80%, 50%)" : "hsl(45, 90%, 55%)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Block 4 — Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Heatmap semanal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-8 gap-1 text-xs font-medium text-muted-foreground">
                  <div className="min-w-[120px]">Loja</div>
                  {DAY_LABELS.map((d) => (
                    <div key={d} className="text-center">{d}</div>
                  ))}
                </div>
                {unitRows.map((unit) => (
                  <div key={unit.unitId} className="grid grid-cols-8 gap-1 items-center">
                    <div className="text-xs font-medium truncate min-w-[120px]">{unit.unitName}</div>
                    {dateStrs.map((dateStr) => {
                      const ud = unit.days.get(dateStr);
                      const status = ud?.status || "ok";
                      return (
                        <div
                          key={dateStr}
                          className={cn(
                            "h-8 rounded-md transition-colors",
                            statusColors[status],
                            !ud && "bg-muted"
                          )}
                          title={`${unit.unitName} — ${dateStr}: ${status}`}
                        />
                      );
                    })}
                  </div>
                ))}
                {unitRows.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-6">Sem dados.</p>
                )}
              </div>
              <div className="flex gap-4 text-[10px] text-muted-foreground mt-3 pt-2 border-t">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Conforme</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" /> Gap leve</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Crítico</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function KPICard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 flex items-center gap-3">
        <div className={cn("p-2 rounded-lg bg-muted", color)}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceRow({
  unitName,
  dateStrs,
  days,
}: {
  unitName: string;
  dateStrs: string[];
  days: Map<string, UnitDayStatus>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <TableRow>
        <TableCell className="font-medium sticky left-0 bg-background z-10 border-r text-sm">
          {unitName}
        </TableCell>
        {dateStrs.map((dateStr) => {
          const ud = days.get(dateStr);
          if (!ud || ud.sectors.length === 0) {
            return (
              <TableCell key={dateStr} className="text-center">
                <span className="text-muted-foreground/40 text-xs">—</span>
              </TableCell>
            );
          }
          return (
            <TableCell key={dateStr} className="text-center">
              <button
                onClick={() => setExpanded(expanded === dateStr ? null : dateStr)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
                  statusBg[ud.status]
                )}
              >
                {ud.status === "ok" ? "OK" : ud.status === "warning" ? "Gap" : "Crítico"}
              </button>
            </TableCell>
          );
        })}
      </TableRow>
      {expanded && days.get(expanded) && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={8} className="p-3">
            <div className="text-xs space-y-1">
              <p className="font-semibold mb-2">{unitName} — {expanded}</p>
              <div className="grid gap-1">
                {days.get(expanded)!.sectors.map((sec, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[9px]", statusBg[sec.status])}>
                      {sec.status === "ok" ? "OK" : sec.status === "warning" ? "Gap" : "Crítico"}
                    </Badge>
                    <span className="font-medium">{sec.sectorName}</span>
                    <span className="text-muted-foreground">
                      ({sec.shiftType === "almoco" ? "Alm" : "Jan"})
                    </span>
                    <span>
                      {sec.scheduled}/{sec.required}
                    </span>
                    <span className={cn(
                      "font-semibold",
                      sec.diff > 0 ? "text-green-600" : sec.diff < 0 ? "text-red-600" : ""
                    )}>
                      {sec.diff > 0 ? `+${sec.diff}` : sec.diff}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
