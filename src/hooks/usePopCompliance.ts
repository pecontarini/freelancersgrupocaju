import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek } from "date-fns";
import { usePopDiario } from "./usePopDiario";

/**
 * SHIM — preserva a API legada de `usePopCompliance` mas alimenta
 * tudo a partir de `vw_pop_diario` (Etapa B do POP Diário Unificado).
 *
 * Para código novo, use `usePopDiario` direto com `date: { from, to }`.
 */

export interface SectorCompliance {
  sectorId: string;
  sectorName: string;
  unitId: string;
  unitName: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  dateStr: string;
  shiftType: string; // "almoco" | "jantar"
  scheduled: number;
  required: number;
  diff: number;
  status: "ok" | "warning" | "critical";
}

export interface UnitDayStatus {
  unitId: string;
  unitName: string;
  dateStr: string;
  dayOfWeek: number;
  status: "ok" | "warning" | "critical";
  sectors: SectorCompliance[];
}

export interface PopComplianceData {
  unitDays: UnitDayStatus[];
  totalSectors: number;
  conformeSectors: number;
  warningSectors: number;
  criticalSectors: number;
  sectorGapRanking: { sectorId: string; sectorName: string; unitName: string; gapDays: number }[];
}

function getWeekDates(base: Date): Date[] {
  const start = startOfWeek(base, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function useComplianceLookups() {
  return useQuery({
    queryKey: ["pop-compliance-lookups"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [{ data: units }, { data: sectors }] = await Promise.all([
        supabase.from("config_lojas").select("id, nome").order("nome"),
        supabase.from("sectors").select("id, name").order("name"),
      ]);
      const u = new Map<string, string>();
      for (const r of (units as any[]) || []) u.set(r.id, r.nome);
      const s = new Map<string, string>();
      for (const r of (sectors as any[]) || []) s.set(r.id, r.name);
      return { units: u, sectors: s };
    },
  });
}

export function usePopCompliance(
  weekBase: Date,
  filterUnitIds: string[],
  filterShift: "almoco" | "jantar" | "both",
) {
  const weekDays = getWeekDates(weekBase);
  const weekStart = format(weekDays[0], "yyyy-MM-dd");
  const weekEnd = format(weekDays[6], "yyyy-MM-dd");

  const turnoFilter =
    filterShift === "both" ? "TODOS" : filterShift === "almoco" ? "ALMOCO" : "JANTAR";

  const pop = usePopDiario({
    date: { from: weekStart, to: weekEnd },
    unitId: filterUnitIds.length > 0 ? filterUnitIds : undefined,
    turno: turnoFilter as any,
  });

  const lookups = useComplianceLookups();

  return useQuery<PopComplianceData>({
    queryKey: [
      "pop-compliance-shim",
      weekStart,
      [...filterUnitIds].sort().join(","),
      filterShift,
      lookups.data ? "lk-ready" : "lk-pending",
    ],
    enabled: !pop.isLoading && !lookups.isLoading && !!lookups.data,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const unitsMap = lookups.data!.units;
      const sectorsMap = lookups.data!.sectors;

      const allCompliance: SectorCompliance[] = [];
      const unitDaysMap = new Map<string, UnitDayStatus>();

      for (const row of pop.rows) {
        // Setores sem POP cadastrado são neutros: não geram gap nem status
        // (já entram na view com sem_pop=true para preservar o volume de escala,
        // mas não devem puxar conformidade pra baixo nem pra cima).
        if (row.status === "sem_pop") continue;

        const dow = new Date(`${row.schedule_date}T00:00:00`).getDay();
        const shiftType = row.turno === "ALMOCO" ? "almoco" : "jantar";
        const required = row.pop_minimo;
        const scheduled = row.escalados;
        const diff = scheduled - required;
        let status: "ok" | "warning" | "critical" = "ok";
        if (diff <= -2) status = "critical";
        else if (diff < 0) status = "warning";

        const entry: SectorCompliance = {
          sectorId: row.sector_id,
          sectorName: sectorsMap.get(row.sector_id) ?? "",
          unitId: row.unit_id,
          unitName: unitsMap.get(row.unit_id) ?? "",
          dayOfWeek: dow,
          dateStr: row.schedule_date,
          shiftType,
          scheduled,
          required,
          diff,
          status,
        };
        allCompliance.push(entry);

        const key = `${row.unit_id}-${row.schedule_date}`;
        if (!unitDaysMap.has(key)) {
          unitDaysMap.set(key, {
            unitId: row.unit_id,
            unitName: unitsMap.get(row.unit_id) ?? "",
            dateStr: row.schedule_date,
            dayOfWeek: dow,
            status: "ok",
            sectors: [],
          });
        }
        const day = unitDaysMap.get(key)!;
        day.sectors.push(entry);
        if (status === "critical") day.status = "critical";
        else if (status === "warning" && day.status !== "critical") day.status = "warning";
      }

      const sectorKeys = new Set(allCompliance.map((c) => `${c.sectorId}-${c.shiftType}`));
      const totalSectors = sectorKeys.size;

      const sectorStatusMap = new Map<string, Set<string>>();
      for (const c of allCompliance) {
        const k = `${c.sectorId}-${c.shiftType}`;
        if (!sectorStatusMap.has(k)) sectorStatusMap.set(k, new Set());
        sectorStatusMap.get(k)!.add(c.status);
      }
      let conformeSectors = 0;
      let warningSectors = 0;
      let criticalSectors = 0;
      for (const [, statuses] of sectorStatusMap) {
        if (statuses.has("critical")) criticalSectors++;
        else if (statuses.has("warning")) warningSectors++;
        else conformeSectors++;
      }

      const gapMap = new Map<string, { sectorName: string; unitName: string; gapDays: number }>();
      for (const c of allCompliance) {
        if (c.diff >= 0) continue;
        const k = `${c.unitName} — ${c.sectorName} (${c.shiftType === "almoco" ? "Alm" : "Jan"})`;
        if (!gapMap.has(k)) {
          gapMap.set(k, { sectorName: c.sectorName, unitName: c.unitName, gapDays: 0 });
        }
        gapMap.get(k)!.gapDays++;
      }
      const sectorGapRanking = [...gapMap.entries()]
        .map(([label, d]) => ({
          sectorId: label,
          sectorName: d.sectorName,
          unitName: d.unitName,
          gapDays: d.gapDays,
        }))
        .sort((a, b) => b.gapDays - a.gapDays)
        .slice(0, 10);

      return {
        unitDays: [...unitDaysMap.values()],
        totalSectors,
        conformeSectors,
        warningSectors,
        criticalSectors,
        sectorGapRanking,
      };
    },
  });
}
