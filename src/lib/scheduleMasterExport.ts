import * as XLSX from "xlsx";
import { format, addDays, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const DAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

interface ExportParams {
  unitId: string;
  unitName: string;
  weekStart: Date;
}

function formatBreak(minutes: number): string {
  if (minutes <= 0) return "";
  if (minutes % 60 === 0) return `(${minutes / 60}h)`;
  return `(${minutes}m)`;
}

export async function exportMasterSchedule({ unitId, unitName, weekStart }: ExportParams) {
  const week = startOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const startStr = format(weekDays[0], "yyyy-MM-dd");
  const endStr = format(weekDays[6], "yyyy-MM-dd");

  const { data: sectors, error: secErr } = await supabase
    .from("sectors").select("*").eq("unit_id", unitId).order("name");
  if (secErr) throw new Error("Erro ao buscar setores: " + secErr.message);
  if (!sectors?.length) throw new Error("Nenhum setor cadastrado nesta unidade.");

  const sectorIds = sectors.map((s) => s.id);

  const { data: schedules, error: schErr } = await supabase
    .from("schedules").select("*").in("sector_id", sectorIds)
    .gte("schedule_date", startStr).lte("schedule_date", endStr).neq("status", "cancelled");
  if (schErr) throw new Error("Erro ao buscar escalas: " + schErr.message);

  const { data: employees, error: empErr } = await supabase
    .from("employees").select("id, name").eq("unit_id", unitId).eq("active", true);
  if (empErr) throw new Error("Erro ao buscar funcionários: " + empErr.message);

  const empMap = new Map<string, string>();
  (employees || []).forEach((e) => empMap.set(e.id, e.name));

  const scheduleBySector = new Map<string, typeof schedules>();
  for (const s of schedules || []) {
    const arr = scheduleBySector.get(s.sector_id) || [];
    arr.push(s);
    scheduleBySector.set(s.sector_id, arr);
  }

  const wb = XLSX.utils.book_new();

  for (const sector of sectors) {
    const sectorSchedules = scheduleBySector.get(sector.id) || [];
    const empIds = new Set(sectorSchedules.map((s) => s.employee_id).filter(Boolean));
    const sectorEmployees = Array.from(empIds)
      .map((id) => ({ id: id!, name: empMap.get(id!) }))
      .filter((e) => e.name)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const header = ["Funcionário", ...weekDays.map((d, i) => `${DAY_LABELS[i]} (${format(d, "dd/MM")})`)];
    const rows: string[][] = [];

    for (const emp of sectorEmployees) {
      const row: string[] = [emp.name!];
      for (const day of weekDays) {
        const dateStr = format(day, "yyyy-MM-dd");
        const entry = sectorSchedules.find(
          (s) => s.employee_id === emp.id && s.schedule_date === dateStr
        );
        if (!entry) {
          row.push("");
        } else if (entry.schedule_type === "off" || entry.schedule_type === "vacation" || entry.schedule_type === "sick_leave") {
          row.push("FOLGA");
        } else {
          const start = entry.start_time ? entry.start_time.slice(0, 5) : "";
          const end = entry.end_time ? entry.end_time.slice(0, 5) : "";
          if (!start || !end) { row.push("Turno"); continue; }
          const brk = entry.break_duration || 0;
          const brkStr = formatBreak(brk);
          row.push(brkStr ? `${start} - ${end} ${brkStr}` : `${start} - ${end}`);
        }
      }
      rows.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 30 }, ...weekDays.map(() => ({ wch: 22 }))];
    const sheetName = sector.name.length > 31 ? sector.name.slice(0, 31) : sector.name;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const fileName = `Escala_Geral_${unitName.replace(/\s+/g, "_")}_${format(weekDays[0], "ddMMyyyy")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
