/**
 * POP (Staffing Matrix) Conventions
 *
 * Canonical day_of_week: 0=Monday ... 6=Sunday (matches the matrix editor and AI prompt)
 * Canonical shift_type: "almoco" | "jantar" (lowercase, no accents)
 */

/** Convert JavaScript Date.getDay() (0=Sun) to POP convention (0=Mon) */
export function jsDayToPopDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Map of AI/display shift names to internal canonical values */
const SHIFT_TYPE_MAP: Record<string, string> = {
  "ALMOÇO": "almoco",
  "ALMOCO": "almoco",
  "Almoço": "almoco",
  "almoco": "almoco",
  "almoço": "almoco",
  "JANTAR": "jantar",
  "Jantar": "jantar",
  "jantar": "jantar",
};

/** Normalize any shift type string to canonical internal value */
export function normalizeShiftType(raw: string): string {
  const trimmed = raw.trim();
  return SHIFT_TYPE_MAP[trimmed]
    ?? SHIFT_TYPE_MAP[trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()]
    ?? trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Normalize a sector name for comparison purposes */
export function normalizeSectorName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
