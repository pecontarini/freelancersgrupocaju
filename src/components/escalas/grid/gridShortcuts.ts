import { supabase } from "@/integrations/supabase/client";

export type ShortcutPatch = {
  schedule_type: "working" | "off";
  shift_type?: string;
  start_time?: string | null;
  end_time?: string | null;
  break_duration?: number;
};

// Fallback fixos quando não há registro em `shifts` para a unidade
const SHIFT_FALLBACKS: Record<string, { start_time: string; end_time: string; break_duration: number }> = {
  T1: { start_time: "11:00", end_time: "15:20", break_duration: 0 },
  T2: { start_time: "18:00", end_time: "23:00", break_duration: 0 },
  T3: { start_time: "11:00", end_time: "23:00", break_duration: 60 },
  meia: { start_time: "11:00", end_time: "15:00", break_duration: 0 },
};

// Cache em memória dos defaults da DB por unidade
const dbCache = new Map<string, Record<string, { start_time: string; end_time: string; break_duration: number }>>();

async function loadShiftDefaults(unitId: string) {
  if (dbCache.has(unitId)) return dbCache.get(unitId)!;
  const { data } = await supabase
    .from("shifts")
    .select("type, start_time, end_time")
    .in("type", ["T1", "T2", "T3"]);
  const map: Record<string, { start_time: string; end_time: string; break_duration: number }> = {};
  for (const s of data || []) {
    if (!map[s.type as string] && s.start_time && s.end_time) {
      map[s.type as string] = {
        start_time: String(s.start_time).slice(0, 5),
        end_time: String(s.end_time).slice(0, 5),
        break_duration: 0,
      };
    }
  }
  dbCache.set(unitId, map);
  return map;
}

export async function resolveShortcutPatch(
  key: string,
  unitId: string | null
): Promise<ShortcutPatch | null> {
  const k = key.toLowerCase();
  if (k === "f") {
    return {
      schedule_type: "off",
      shift_type: undefined,
      start_time: null,
      end_time: null,
      break_duration: 0,
    };
  }
  if (!["1", "2", "3", "m"].includes(k)) return null;

  const shiftType = k === "m" ? "meia" : `T${k}`;
  let times = SHIFT_FALLBACKS[shiftType];

  if (unitId && shiftType !== "meia") {
    const dbDefaults = await loadShiftDefaults(unitId);
    if (dbDefaults[shiftType]) times = { ...times, ...dbDefaults[shiftType] };
  }

  return {
    schedule_type: "working",
    shift_type: shiftType,
    start_time: times.start_time,
    end_time: times.end_time,
    break_duration: times.break_duration,
  };
}

export function isShortcutKey(key: string): boolean {
  return ["1", "2", "3", "m", "f"].includes(key.toLowerCase());
}
