import type { WorkHours } from "../db/repo";
import { fromLocalStamp, toDateKey } from "./dates";

type Booked = { starts_at: string; minutes: number };
export type FreeSlot = { from: string; to: string };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Free windows of at least `min` minutes inside working hours between the day's
 * bookings. Past days have none; today starts from the next quarter hour.
 */
export function freeSlots(dayKey: string, booked: Booked[], work: WorkHours, now: Date | null, min = 30): FreeSlot[] {
  const start = toMin(work.start);
  const end = toMin(work.end);
  let cursor = start;
  if (now) {
    const today = toDateKey(now);
    if (dayKey < today) return [];
    if (dayKey === today) cursor = Math.max(start, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
  }
  const spans = booked
    .map((b) => {
      const s = fromLocalStamp(b.starts_at);
      const from = s.getHours() * 60 + s.getMinutes();
      return [from, from + b.minutes] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  const out: FreeSlot[] = [];
  for (const [from, to] of spans) {
    const gapEnd = Math.min(from, end);
    if (gapEnd - cursor >= min) out.push({ from: toHhmm(cursor), to: toHhmm(gapEnd) });
    cursor = Math.max(cursor, to);
  }
  if (end - cursor >= min) out.push({ from: toHhmm(cursor), to: toHhmm(end) });
  return out;
}

/**
 * Start time offered for a new booking: the day's first free window (from now on
 * for today), so an empty future day starts with the working day.
 */
export function suggestedStart(dayKey: string, booked: Booked[], work: WorkHours, now: Date) {
  return freeSlots(dayKey, booked, work, now)[0]?.from ?? work.start;
}
