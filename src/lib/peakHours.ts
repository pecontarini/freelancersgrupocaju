// Peak hour windows aligned with POP document
export const LUNCH_PEAK = { start: "12:00", end: "15:00" };
export const DINNER_PEAK = { start: "19:00", end: "22:00" };

// Minimum consecutive minutes within peak window to count as present
export const MIN_OVERLAP_MINUTES = 120;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Check if a schedule's [start, end) window intersects with a peak window.
 * Kept for backward compatibility — does NOT enforce 2h minimum.
 */
export function intersectsPeak(
  scheduleStart: string | null,
  scheduleEnd: string | null,
  peak: { start: string; end: string }
): boolean {
  if (!scheduleStart || !scheduleEnd) return false;

  const sStart = timeToMinutes(scheduleStart.slice(0, 5));
  let sEnd = timeToMinutes(scheduleEnd.slice(0, 5));
  if (sEnd <= sStart) sEnd += 24 * 60;

  const pStart = timeToMinutes(peak.start);
  const pEnd = timeToMinutes(peak.end);

  return sStart < pEnd && pStart < sEnd;
}

/**
 * POP rule: count a worker only if they have at least `minMinutes`
 * of consecutive overlap within the peak window.
 *
 * Overlap = min(scheduleEnd, peakEnd) - max(scheduleStart, peakStart)
 */
export function meetsMinimumOverlap(
  scheduleStart: string | null,
  scheduleEnd: string | null,
  peak: { start: string; end: string },
  minMinutes: number = MIN_OVERLAP_MINUTES
): boolean {
  if (!scheduleStart || !scheduleEnd) return false;

  const sStart = timeToMinutes(scheduleStart.slice(0, 5));
  let sEnd = timeToMinutes(scheduleEnd.slice(0, 5));
  if (sEnd <= sStart) sEnd += 24 * 60;

  const pStart = timeToMinutes(peak.start);
  const pEnd = timeToMinutes(peak.end);

  const overlapStart = Math.max(sStart, pStart);
  const overlapEnd = Math.min(sEnd, pEnd);
  const overlap = overlapEnd - overlapStart;

  return overlap >= minMinutes;
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

    if (meetsMinimumOverlap(s.start_time, s.end_time, LUNCH_PEAK)) lunchCount++;
    if (meetsMinimumOverlap(s.start_time, s.end_time, DINNER_PEAK)) dinnerCount++;

    if (s.worker_type === "freelancer" && s.agreed_rate > 0) {
      freelancerCost += s.agreed_rate;
    }
  }

  return { lunchCount, dinnerCount, freelancerCost };
}
