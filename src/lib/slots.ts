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

type Named = Booked & { id: string; dog_name: string };

/** Bookings of the day that overlap [startsAt, startsAt + minutes), other than `exceptId`. */
export function clashes<T extends Named>(dayBooked: T[], startsAt: string, minutes: number, exceptId?: string): T[] {
  const from = fromLocalStamp(startsAt).getTime();
  const to = from + minutes * 60_000;
  return dayBooked.filter((b) => {
    if (b.id === exceptId) return false;
    const s = fromLocalStamp(b.starts_at).getTime();
    return s < to && s + b.minutes * 60_000 > from;
  });
}

/** "Ричи 14:00–15:00, Кекс 14:30–15:30" */
export function clashLabel(list: Named[]) {
  return list
    .map((b) => {
      const s = fromLocalStamp(b.starts_at);
      const e = new Date(s.getTime() + b.minutes * 60_000);
      const t = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      return `${b.dog_name} ${t(s)}–${t(e)}`;
    })
    .join(", ");
}
