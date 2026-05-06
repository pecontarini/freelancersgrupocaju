// In-memory store for AI-generated "open vacancy" slots that should appear
// inside ManualScheduleGrid until linked to a real employee.
// No DB persistence — drafts vanish on reload.

import { useSyncExternalStore } from "react";

export type DraftDay =
  | { kind: "off" }
  | {
      kind: "work";
      start_time: string;
      end_time: string;
      break_min: number;
      shift_type?: string;
    };

export interface DraftSlot {
  id: string;
  unit_id: string;
  sector_id: string; // resolved at creation time
  sector_name: string;
  week_start: string; // YYYY-MM-DD (Monday)
  label: string; // "Vaga Garçom T1"
  tipo: string;
  responsavel?: boolean;
  job_title_id?: string | null;
  days: Record<string, DraftDay>; // key = YYYY-MM-DD
}

let drafts: DraftSlot[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return drafts;
}

export function setDraftSlots(slots: DraftSlot[]) {
  drafts = [...drafts.filter(
    (d) =>
      !slots.some(
        (s) =>
          s.unit_id === d.unit_id &&
          s.sector_id === d.sector_id &&
          s.week_start === d.week_start,
      ),
  ), ...slots];
  emit();
}

export function clearDraftSlotsFor(unitId: string, sectorId: string, weekStart: string) {
  drafts = drafts.filter(
    (d) => !(d.unit_id === unitId && d.sector_id === sectorId && d.week_start === weekStart),
  );
  emit();
}

export function removeDraftSlot(id: string) {
  drafts = drafts.filter((d) => d.id !== id);
  emit();
}

export function updateDraftSlotDay(id: string, date: string, day: DraftDay | null) {
  drafts = drafts.map((d) => {
    if (d.id !== id) return d;
    const days = { ...d.days };
    if (day === null) delete days[date];
    else days[date] = day;
    return { ...d, days };
  });
  emit();
}

export function useAllDraftSlots(): DraftSlot[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useDraftSlotsFor(
  unitId: string | null,
  sectorId: string | null,
  weekStart: string | null,
): DraftSlot[] {
  const all = useAllDraftSlots();
  if (!unitId || !sectorId || !weekStart) return [];
  return all.filter(
    (d) => d.unit_id === unitId && d.sector_id === sectorId && d.week_start === weekStart,
  );
}
