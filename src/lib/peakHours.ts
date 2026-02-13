// Peak hour windows for automatic POP calculation
export const LUNCH_PEAK = { start: "12:00", end: "14:30" };
export const DINNER_PEAK = { start: "19:30", end: "22:00" };

/**
 * Check if a schedule's [start, end) window intersects with a peak window.
 * Handles overnight shifts (end < start means crosses midnight).
 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function intersectsPeak(
  scheduleStart: string | null,
  scheduleEnd: string | null,
  peak: { start: string; end: string }
): boolean {
  if (!scheduleStart || !scheduleEnd) return false;

  const sStart = timeToMinutes(scheduleStart.slice(0, 5));
  let sEnd = timeToMinutes(scheduleEnd.slice(0, 5));
  if (sEnd <= sStart) sEnd += 24 * 60; // overnight

  const pStart = timeToMinutes(peak.start);
  const pEnd = timeToMinutes(peak.end);

  // Two intervals [a,b) and [c,d) intersect if a < d && c < b
  return sStart < pEnd && pStart < sEnd;
}

export interface DailyMetrics {
  lunchCount: number;
  dinnerCount: number;
  freelancerCost: number;
}

export function calculateDailyMetrics(
  schedules: Array<{
    schedule_type: string;
    start_time: string | null;
    end_time: string | null;
    agreed_rate: number;
    worker_type?: string;
  }>
): DailyMetrics {
  let lunchCount = 0;
  let dinnerCount = 0;
  let freelancerCost = 0;

  for (const s of schedules) {
    if (s.schedule_type !== "working") continue;

    if (intersectsPeak(s.start_time, s.end_time, LUNCH_PEAK)) lunchCount++;
    if (intersectsPeak(s.start_time, s.end_time, DINNER_PEAK)) dinnerCount++;

    if (s.worker_type === "freelancer" && s.agreed_rate > 0) {
      freelancerCost += s.agreed_rate;
    }
  }

  return { lunchCount, dinnerCount, freelancerCost };
}
