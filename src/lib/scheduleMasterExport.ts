import * as XLSX from "xlsx";
import { format, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const DAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

interface ExportParams {
  unitId: string;
  unitName: string;
  weekStart: Date;
}

export async function exportMasterSchedule({ unitId, unitName, weekStart }: ExportParams) {
  const week = startOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const startStr = format(weekDays[0], "yyyy-MM-dd");
  const endStr = format(weekDays[6], "yyyy-MM-dd");

  // 1. Fetch sectors
  const { data: sectors, error: secErr } = await supabase
    .from("sectors")
    .select("*")
    .eq("unit_id", unitId)
    .order("name");
  if (secErr) throw new Error("Erro ao buscar setores: " + secErr.message);
  if (!sectors || sectors.length === 0) throw new Error("Nenhum setor cadastrado nesta unidade.");

  const sectorIds = sectors.map((s) => s.id);

  // 2. Fetch all schedules for the week across all sectors
  const { data: schedules, error: schErr } = await supabase
    .from("schedules")
    .select("*")
    .in("sector_id", sectorIds)
    .gte("schedule_date", startStr)
    .lte("schedule_date", endStr)
    .neq("status", "cancelled");
  if (schErr) throw new Error("Erro ao buscar escalas: " + schErr.message);

  // 3. Fetch employees
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, name, worker_type")
    .eq("unit_id", unitId)
    .eq("active", true);
  if (empErr) throw new Error("Erro ao buscar funcionários: " + empErr.message);

  const empMap = new Map<string, { name: string; worker_type: string }>();
  (employees || []).forEach((e) => empMap.set(e.id, { name: e.name, worker_type: e.worker_type || "clt" }));

  // Group schedules by sector
  const scheduleBySector = new Map<string, typeof schedules>();
  for (const s of schedules || []) {
    const arr = scheduleBySector.get(s.sector_id) || [];
    arr.push(s);
    scheduleBySector.set(s.sector_id, arr);
  }

  const wb = XLSX.utils.book_new();

  // ──── Aba "Resumo Geral" ────
  const summaryHeader = ["Setor", ...weekDays.map((d, i) => `${DAY_LABELS[i]} (${format(d, "dd/MM")})`)];
  const summaryRows: (string | number)[][] = [];
  const headcountRows: (string | number)[][] = [];

  for (const sector of sectors) {
    const sectorSchedules = scheduleBySector.get(sector.id) || [];
    const costRow: (string | number)[] = [sector.name];
    const hcRow: (string | number)[] = [sector.name];

    for (const day of weekDays) {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayEntries = sectorSchedules.filter(
        (s) => s.schedule_date === dateStr && s.schedule_type === "working"
      );
      const totalCost = dayEntries.reduce((sum, s) => sum + (Number(s.agreed_rate) || 0), 0);
      costRow.push(totalCost);
      hcRow.push(dayEntries.length);
    }
    summaryRows.push(costRow);
    headcountRows.push(hcRow);
  }

  const summaryData = [
    ["RESUMO GERAL — " + unitName],
    [`Semana: ${format(weekDays[0], "dd/MM/yyyy")} a ${format(weekDays[6], "dd/MM/yyyy")}`],
    [],
    ["HEADCOUNT (Pessoas Escaladas)"],
    summaryHeader,
    ...headcountRows,
    [],
    ["CUSTO ESTIMADO (R$) — Diárias/Agreed Rate"],
    summaryHeader,
    ...summaryRows,
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 20 }, ...weekDays.map(() => ({ wch: 18 }))];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Geral");

  // ──── Abas por Setor ────
  for (const sector of sectors) {
    const sectorSchedules = scheduleBySector.get(sector.id) || [];

    // Unique employees in this sector's schedules
    const empIdsInSector = new Set(sectorSchedules.map((s) => s.employee_id).filter(Boolean));
    const sectorEmployees = Array.from(empIdsInSector)
      .map((id) => ({ id: id!, ...empMap.get(id!) }))
      .filter((e) => e.name)
      .sort((a, b) => {
        const aType = a.worker_type || "clt";
        const bType = b.worker_type || "clt";
        if (aType === bType) return (a.name || "").localeCompare(b.name || "");
        return aType === "clt" ? -1 : 1;
      });

    // Header
    const header = ["Funcionário", ...weekDays.map((d, i) => `${DAY_LABELS[i]} (${format(d, "dd/MM")})`)];
    const rows: string[][] = [];

    for (const emp of sectorEmployees) {
      const row: string[] = [
        `${emp.name}${emp.worker_type === "freelancer" ? " [FL]" : ""}`,
      ];
      for (const day of weekDays) {
        const dateStr = format(day, "yyyy-MM-dd");
        const entry = sectorSchedules.find(
          (s) => s.employee_id === emp.id && s.schedule_date === dateStr
        );
        if (!entry) {
          row.push("");
        } else if (entry.schedule_type === "off") {
          row.push("FOLGA");
        } else if (entry.schedule_type === "vacation") {
          row.push("FÉRIAS");
        } else if (entry.schedule_type === "sick_leave") {
          row.push("ATESTADO");
        } else {
          const start = entry.start_time ? entry.start_time.slice(0, 5) : "";
          const end = entry.end_time ? entry.end_time.slice(0, 5) : "";
          const brk = entry.break_duration || 0;
          let cell = start && end ? `${start} - ${end}` : "Turno";
          if (brk > 0) {
            cell += brk >= 60 ? ` (${brk / 60}h)` : ` (${brk}m)`;
          }
          row.push(cell);
        }
      }
      rows.push(row);
    }

    const sheetData = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 28 }, ...weekDays.map(() => ({ wch: 20 }))];

    // Truncate sheet name to 31 chars (Excel limit)
    const sheetName = sector.name.length > 31 ? sector.name.slice(0, 31) : sector.name;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // 4. Download
  const fileName = `Escala_Geral_${unitName.replace(/\s+/g, "_")}_${format(weekDays[0], "ddMMyyyy")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
