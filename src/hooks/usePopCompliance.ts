import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfWeek } from "date-fns";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { jsDayToPopDay } from "@/lib/popConventions";

export interface SectorCompliance {
  sectorId: string;
  sectorName: string;
  unitId: string;
  unitName: string;
  dayOfWeek: number; // 0=Sun..6=Sat
  dateStr: string;
  shiftType: string;
  scheduled: number;
  required: number;
  diff: number; // scheduled - required, negative = gap
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

export function usePopCompliance(
  weekBase: Date,
  filterUnitIds: string[],
  filterShift: "almoco" | "jantar" | "both"
) {
  const weekDays = getWeekDates(weekBase);
  const weekStart = format(weekDays[0], "yyyy-MM-dd");
  const weekEnd = format(weekDays[6], "yyyy-MM-dd");

  return useQuery<PopComplianceData>({
    queryKey: ["pop-compliance", weekStart, filterUnitIds, filterShift],
    queryFn: async () => {
      // Fetch all stores
      const { data: stores, error: storesErr } = await supabase
        .from("config_lojas")
        .select("id, nome")
        .order("nome");
      if (storesErr) throw storesErr;

      // Fetch all sectors
      const { data: allSectors, error: secErr } = await supabase
        .from("sectors")
        .select("id, name, unit_id")
        .order("name");
      if (secErr) throw secErr;

      // Fetch staffing matrix for all sectors
      const sectorIds = allSectors?.map((s) => s.id) || [];
      let matrixData: any[] = [];
      if (sectorIds.length > 0) {
        const { data, error } = await supabase
          .from("staffing_matrix")
          .select("*")
          .in("sector_id", sectorIds);
        if (error) throw error;
        matrixData = data || [];
      }

      // Fetch sector partnerships (shared sectors across paired stores)
      let partnershipsData: { sector_id: string; partner_sector_id: string }[] = [];
      if (sectorIds.length > 0) {
        const { data: pData } = await supabase
          .from("sector_partnerships" as any)
          .select("sector_id, partner_sector_id");
        partnershipsData = (pData as any[]) || [];
      }
      // Build bidirectional partner lookup
      const partnerMap = new Map<string, string>();
      for (const p of partnershipsData) {
        partnerMap.set(p.sector_id, p.partner_sector_id);
        partnerMap.set(p.partner_sector_id, p.sector_id);
      }

      // Fetch schedules for the week across all units
      interface ScheduleRow {
        id: string;
        employee_id: string;
        schedule_date: string;
        sector_id: string;
        schedule_type: string;
        start_time: string | null;
        end_time: string | null;
      }
      const schedules = await fetchAllRows<ScheduleRow>(
        () => supabase
          .from("schedules")
          .select("id, employee_id, schedule_date, sector_id, schedule_type, start_time, end_time")
          .gte("schedule_date", weekStart)
          .lte("schedule_date", weekEnd)
          .eq("schedule_type", "working")
      );

      // Build lookup maps
      const storeMap = new Map((stores || []).map((s) => [s.id, s.nome]));
      const sectorsByUnit = new Map<string, typeof allSectors>();
      for (const sec of allSectors || []) {
        if (!sectorsByUnit.has(sec.unit_id)) sectorsByUnit.set(sec.unit_id, []);
        sectorsByUnit.get(sec.unit_id)!.push(sec);
      }

      // Helper: count scheduled for a sector/date/shift using POP 2h minimum overlap rule
      const LUNCH_PEAK_W = { start: "12:00", end: "15:00" };
      const DINNER_PEAK_W = { start: "19:00", end: "22:00" };
      const MIN_OVERLAP = 120; // minutes

      function timeToMin(t: string) {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + (m || 0);
      }

      function hasMinOverlap(startTime: string, endTime: string, windowStart: number, windowEnd: number, minMinutes: number) {
        let s = timeToMin(startTime);
        let e = timeToMin(endTime);
        if (e <= s) e += 24 * 60;
        const overlapStart = Math.max(s, windowStart);
        const overlapEnd = Math.min(e, windowEnd);
        return (overlapEnd - overlapStart) >= minMinutes;
      }

      function countScheduled(sectorId: string, dateStr: string, shiftType: string): number {
        const daySchedules = schedules.filter(
          (s) => s.sector_id === sectorId && s.schedule_date === dateStr
        );
        const peak = shiftType === "almoco" ? LUNCH_PEAK_W : DINNER_PEAK_W;
        const windowStart = timeToMin(peak.start);
        const windowEnd = timeToMin(peak.end);

        return daySchedules.filter((s) =>
          s.start_time && s.end_time && hasMinOverlap(s.start_time, s.end_time, windowStart, windowEnd, MIN_OVERLAP)
        ).length;
      }

      // Filter stores
      const targetStores = filterUnitIds.length > 0
        ? (stores || []).filter((s) => filterUnitIds.includes(s.id))
        : (stores || []);

      const shiftTypes = filterShift === "both"
        ? ["almoco", "jantar"]
        : [filterShift];

      const allCompliance: SectorCompliance[] = [];
      const unitDaysMap = new Map<string, UnitDayStatus>();

      for (const store of targetStores) {
        const storeSectors = sectorsByUnit.get(store.id) || [];
        for (const day of weekDays) {
          const dateStr = format(day, "yyyy-MM-dd");
          const dow = jsDayToPopDay(day.getDay());
          const key = `${store.id}-${dateStr}`;

          const daySectors: SectorCompliance[] = [];

          for (const sector of storeSectors) {
            for (const shift of shiftTypes) {
              const matrixEntry = matrixData.find(
                (m) => m.sector_id === sector.id && m.day_of_week === dow && m.shift_type === shift
              );
              const required = (matrixEntry?.required_count ?? 0) + (matrixEntry?.extras_count ?? 0);
              if (required === 0) continue; // no POP defined

              const scheduled = countScheduled(sector.id, dateStr, shift);
              const diff = scheduled - required;
              let status: "ok" | "warning" | "critical" = "ok";
              if (diff <= -2) status = "critical";
              else if (diff < 0) status = "warning";

              const entry: SectorCompliance = {
                sectorId: sector.id,
                sectorName: sector.name,
                unitId: store.id,
                unitName: store.nome,
                dayOfWeek: dow,
                dateStr,
                shiftType: shift,
                scheduled,
                required,
                diff,
                status,
              };
              daySectors.push(entry);
              allCompliance.push(entry);
            }
          }

          // Aggregate unit-day status
          let dayStatus: "ok" | "warning" | "critical" = "ok";
          if (daySectors.some((s) => s.status === "critical")) dayStatus = "critical";
          else if (daySectors.some((s) => s.status === "warning")) dayStatus = "warning";

          unitDaysMap.set(key, {
            unitId: store.id,
            unitName: store.nome,
            dateStr,
            dayOfWeek: dow,
            status: dayStatus,
            sectors: daySectors,
          });
        }
      }

      // Unique sector+shift combos that have POP
      const sectorKeys = new Set(allCompliance.map((c) => `${c.sectorId}-${c.shiftType}`));
      const totalSectors = sectorKeys.size;

      // A sector is conforme if ALL its days are ok
      const sectorStatusMap = new Map<string, Set<string>>();
      for (const c of allCompliance) {
        const key = `${c.sectorId}-${c.shiftType}`;
        if (!sectorStatusMap.has(key)) sectorStatusMap.set(key, new Set());
        sectorStatusMap.get(key)!.add(c.status);
      }

      let conformeSectors = 0;
      let warningSectors = 0;
      let criticalSectors = 0;
      for (const [, statuses] of sectorStatusMap) {
        if (statuses.has("critical")) criticalSectors++;
        else if (statuses.has("warning")) warningSectors++;
        else conformeSectors++;
      }

      // Gap ranking: sectors with most days below POP
      const gapMap = new Map<string, { sectorName: string; unitName: string; gapDays: number }>();
      for (const c of allCompliance) {
        if (c.diff >= 0) continue;
        const key = `${c.unitName} — ${c.sectorName} (${c.shiftType === "almoco" ? "Alm" : "Jan"})`;
        if (!gapMap.has(key)) {
          gapMap.set(key, { sectorName: c.sectorName, unitName: c.unitName, gapDays: 0 });
        }
        gapMap.get(key)!.gapDays++;
      }
      const sectorGapRanking = [...gapMap.entries()]
        .map(([label, d]) => ({ sectorId: label, sectorName: d.sectorName, unitName: d.unitName, gapDays: d.gapDays }))
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
    staleTime: 1000 * 60 * 2,
  });
}
