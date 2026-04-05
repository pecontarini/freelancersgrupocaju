import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, Clock } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Schedule {
  employee_id: string;
  schedule_date: string;
  schedule_type: string;
  start_time: string | null;
  end_time: string | null;
  break_duration: number;
}

interface Employee {
  id: string;
  name: string;
  worker_type?: string;
}

interface WeeklyHoursSummaryProps {
  schedules: Schedule[];
  employees: Employee[];
  weekDays: Date[];
}

const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function calcDurationMinutes(start: string, end: string, breakMin: number): number {
  let startM = timeToMinutes(start);
  let endM = timeToMinutes(end);
  if (endM <= startM) endM += 24 * 60; // crosses midnight
  return Math.max(0, endM - startM - breakMin);
}

function formatHours(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function WeeklyHoursSummary({ schedules, employees, weekDays }: WeeklyHoursSummaryProps) {
  const [open, setOpen] = useState(false);

  const dateStrs = useMemo(() => weekDays.map((d) => format(d, "yyyy-MM-dd")), [weekDays]);

  const data = useMemo(() => {
    // Group working schedules by employee & date
    const map = new Map<string, Map<string, number>>();

    for (const s of schedules) {
      if (s.schedule_type !== "working" || !s.start_time || !s.end_time || !s.employee_id) continue;
      const dur = calcDurationMinutes(s.start_time, s.end_time, s.break_duration ?? 0);
      if (dur <= 0) continue;

      if (!map.has(s.employee_id)) map.set(s.employee_id, new Map());
      const empMap = map.get(s.employee_id)!;
      empMap.set(s.schedule_date, (empMap.get(s.schedule_date) || 0) + dur);
    }

    // Build rows only for employees that have at least one working schedule
    const rows: {
      id: string;
      name: string;
      isFreelancer: boolean;
      daily: (number | null)[];
      total: number;
    }[] = [];

    for (const emp of employees) {
      const empMap = map.get(emp.id);
      if (!empMap) continue;
      const daily = dateStrs.map((d) => empMap.get(d) ?? null);
      const total = daily.reduce((s, v) => s + (v ?? 0), 0);
      if (total === 0) continue;
      rows.push({
        id: emp.id,
        name: emp.name,
        isFreelancer: emp.worker_type === "freelancer",
        daily,
        total,
      });
    }

    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [schedules, employees, dateStrs]);

  if (data.length === 0) return null;

  const totalAlerts = data.filter((r) => r.total > 44 * 60).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Resumo de horas da semana</span>
              {totalAlerts > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {totalAlerts} alerta{totalAlerts > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px] sticky left-0 bg-background z-10 border-r">
                      Funcionário
                    </TableHead>
                    {DAY_LABELS.map((label, i) => (
                      <TableHead key={i} className="text-center min-w-[60px]">
                        {label}
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[80px] font-bold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => {
                    const totalHours = row.total / 60;
                    let totalClass = "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20";
                    if (totalHours > 48) {
                      totalClass = "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 font-bold";
                    } else if (totalHours > 44) {
                      totalClass = "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 font-semibold";
                    }

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="sticky left-0 bg-background z-10 border-r">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[130px] text-sm">{row.name}</span>
                            {row.isFreelancer && (
                              <Badge variant="outline" className="border-orange-400 text-orange-600 text-[9px] px-1 py-0">
                                FL
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {row.daily.map((mins, i) => {
                          const isDanger = mins !== null && mins > 10 * 60;
                          return (
                            <TableCell
                              key={i}
                              className={cn(
                                "text-center text-xs",
                                isDanger && "text-red-600 dark:text-red-400 font-bold"
                              )}
                            >
                              {mins !== null ? formatHours(mins) : "—"}
                            </TableCell>
                          );
                        })}
                        <TableCell className={cn("text-center text-xs rounded-r-md", totalClass)}>
                          {formatHours(row.total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 flex gap-4 text-[10px] text-muted-foreground border-t">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> ≤44h CLT
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> 44–48h extras
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> &gt;48h crítico
              </span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
