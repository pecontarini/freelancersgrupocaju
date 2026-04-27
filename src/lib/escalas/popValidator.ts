// Validador determinístico de propostas de escala vindas da IA.
// Aplica regras CLT + POP. Roda ANTES de mostrar a sugestão ao usuário.
// Retorna violações duras (bloqueiam aplicação) e warnings (apenas avisam).

import { addDays, parseISO, differenceInMinutes } from "date-fns";

export type ProposedShift = {
  employee_id: string;
  employee_name: string;
  date: string; // YYYY-MM-DD
  schedule_type: "working" | "off" | "vacation" | "sick_leave";
  shift_type?: "T1" | "T2" | "T3" | "meia";
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  break_min?: number;
  sector_id?: string | null;
};

export type StaffingRequirement = {
  sector_id: string;
  sector_name: string;
  day_of_week: number; // 0=Dom, 1=Seg, ... 6=Sab (JS)
  shift_type: string; // T1 / T2 / T3 / meia
  required_count: number;
};

export type ExistingShift = ProposedShift; // mesma forma para escalas já no banco

export type Violation = {
  level: "error" | "warning";
  rule: string; // ex "CLT art. 66"
  message: string;
  employee_id?: string;
  date?: string;
};

export type ValidationResult = {
  valid: boolean; // true se nenhum error (warnings ok)
  violations: Violation[];
  byEmployee: Record<string, Violation[]>;
};

function timeToMin(t?: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function shiftDurationMin(s: ProposedShift): number {
  const a = timeToMin(s.start_time);
  const b = timeToMin(s.end_time);
  if (a == null || b == null) return 0;
  let dur = b - a;
  if (dur < 0) dur += 24 * 60; // virou o dia
  return Math.max(0, dur - (s.break_min ?? 0));
}

function dateToWeekKey(date: string): string {
  // ISO week-ish: usamos a segunda-feira da semana como chave
  const d = parseISO(date);
  const dow = d.getDay(); // 0=Dom..6=Sab
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(d, diff);
  return monday.toISOString().slice(0, 10);
}

export function validateProposal(
  proposed: ProposedShift[],
  context: {
    existing: ExistingShift[]; // escalas já gravadas para os mesmos funcionários (semanas adjacentes p/ interjornada)
    staffing: StaffingRequirement[]; // matriz POP do setor da semana
    weekDates: string[]; // 7 datas YYYY-MM-DD da semana sendo gerada
  }
): ValidationResult {
  const violations: Violation[] = [];
  const all = [...context.existing, ...proposed];

  // Index por funcionário
  const byEmp = new Map<string, ProposedShift[]>();
  for (const s of all) {
    if (!byEmp.has(s.employee_id)) byEmp.set(s.employee_id, []);
    byEmp.get(s.employee_id)!.push(s);
  }

  for (const [empId, shifts] of byEmp) {
    const working = shifts.filter((s) => s.schedule_type === "working");
    const sorted = [...working].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (timeToMin(a.start_time) ?? 0) - (timeToMin(b.start_time) ?? 0);
    });
    const empName = shifts[0]?.employee_name ?? empId;

    // 1. Limite diário 10h e dobra max 4h de intervalo
    const byDate = new Map<string, ProposedShift[]>();
    for (const s of working) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date)!.push(s);
    }
    for (const [date, dayShifts] of byDate) {
      const totalMin = dayShifts.reduce((acc, s) => acc + shiftDurationMin(s), 0);
      if (totalMin > 10 * 60) {
        violations.push({
          level: "error",
          rule: "CLT art. 59",
          employee_id: empId,
          date,
          message: `${empName}: ${(totalMin / 60).toFixed(1)}h em ${date} (máx 10h/dia).`,
        });
      }
      if (dayShifts.length >= 2) {
        const sd = [...dayShifts].sort(
          (a, b) => (timeToMin(a.start_time) ?? 0) - (timeToMin(b.start_time) ?? 0)
        );
        for (let i = 1; i < sd.length; i++) {
          const prevEnd = timeToMin(sd[i - 1].end_time);
          const nextStart = timeToMin(sd[i].start_time);
          if (prevEnd != null && nextStart != null) {
            const gap = nextStart - prevEnd;
            if (gap > 4 * 60) {
              violations.push({
                level: "error",
                rule: "POP 4.2.5",
                employee_id: empId,
                date,
                message: `${empName}: dobra com ${(gap / 60).toFixed(1)}h de intervalo em ${date} (máx 4h).`,
              });
            }
          }
        }
      }
    }

    // 2. Interjornada 11h
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.date === cur.date) continue; // dobra já tratada
      const prevEnd = timeToMin(prev.end_time);
      const curStart = timeToMin(cur.start_time);
      if (prevEnd == null || curStart == null) continue;
      const prevEndDate = parseISO(prev.date);
      const curStartDate = parseISO(cur.date);
      const gapMin =
        differenceInMinutes(curStartDate, prevEndDate) + (curStart - prevEnd);
      if (gapMin < 11 * 60) {
        violations.push({
          level: "error",
          rule: "CLT art. 66",
          employee_id: empId,
          date: cur.date,
          message: `${empName}: apenas ${(gapMin / 60).toFixed(1)}h de descanso entre ${prev.date} e ${cur.date} (mín 11h).`,
        });
      }
    }

    // 3. Carga semanal 44h (na semana sendo gerada)
    const weekShifts = working.filter((s) => context.weekDates.includes(s.date));
    const weekMin = weekShifts.reduce((acc, s) => acc + shiftDurationMin(s), 0);
    if (weekMin > 44 * 60) {
      violations.push({
        level: "error",
        rule: "CLT art. 7º XIII",
        employee_id: empId,
        message: `${empName}: ${(weekMin / 60).toFixed(1)}h na semana (máx 44h).`,
      });
    } else if (weekMin > 0 && weekMin < 30 * 60) {
      violations.push({
        level: "warning",
        rule: "POP 4.2.5",
        employee_id: empId,
        message: `${empName}: apenas ${(weekMin / 60).toFixed(1)}h na semana — banco de horas pode ficar negativo.`,
      });
    }

    // 4. Folga semanal (DSR) — pelo menos 1 dia sem working na semana
    const workingDays = new Set(weekShifts.map((s) => s.date));
    const offDays = context.weekDates.filter((d) => !workingDays.has(d));
    if (workingDays.size === 7 && offDays.length === 0) {
      violations.push({
        level: "error",
        rule: "CLT art. 67 / POP 4.2.5",
        employee_id: empId,
        message: `${empName}: sem folga semanal (DSR obrigatório).`,
      });
    }
  }

  // 5. Cobertura mínima da Tabela POP por dia/turno
  for (const date of context.weekDates) {
    const dow = parseISO(date).getDay();
    const reqs = context.staffing.filter((r) => r.day_of_week === dow);
    for (const req of reqs) {
      const covering = proposed.filter(
        (s) =>
          s.date === date &&
          s.schedule_type === "working" &&
          s.shift_type === req.shift_type &&
          (req.sector_id ? s.sector_id === req.sector_id : true)
      ).length;
      if (covering < req.required_count) {
        violations.push({
          level: "error",
          rule: "POP 4.1 — Tabela Mínima",
          date,
          message: `Cobertura ${req.sector_name} ${req.shift_type} em ${date}: ${covering}/${req.required_count}.`,
        });
      }
    }
  }

  const byEmployee: Record<string, Violation[]> = {};
  for (const v of violations) {
    const k = v.employee_id ?? "_global";
    (byEmployee[k] ||= []).push(v);
  }

  return {
    valid: violations.every((v) => v.level !== "error"),
    violations,
    byEmployee,
  };
}
