// Appointments are stored as local wall-clock time "YYYY-MM-DDTHH:mm" —
// the salon lives in one timezone and this keeps SQL comparisons trivial.

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toLocalStamp(d: Date) {
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalStamp(s: string) {
  const [date, time = "00:00"] = s.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMinutes(d: Date, n: number) {
  return new Date(d.getTime() + n * 60_000);
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7;
  return startOfDay(addDays(d, -day));
}

export function sameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b);
}

export function hhmm(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAYS_LONG = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export const weekdayShort = (d: Date) => WEEKDAYS[d.getDay()];
export const weekdayLong = (d: Date) => WEEKDAYS_LONG[d.getDay()];
export const dayMonth = (d: Date) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
export const dayMonthShort = (d: Date) => `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;

/** "Ср, 28 окт · 09:30–11:30" */
export function slotLabel(startsAt: string, minutes: number) {
  const s = fromLocalStamp(startsAt);
  return `${weekdayShort(s)}, ${dayMonthShort(s)} · ${hhmm(s)}–${hhmm(addMinutes(s, minutes))}`;
}

export function weekLabel(monday: Date) {
  const sunday = addDays(monday, 6);
  return `${dayMonthShort(monday)} — ${dayMonthShort(sunday)}`;
}

export function ageLabel(birthday: string | null) {
  if (!birthday) return "";
  const b = fromLocalStamp(birthday);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) years--;
  if (years >= 1) {
    const m10 = years % 10;
    const m100 = years % 100;
    const word = m10 === 1 && m100 !== 11 ? "год" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "года" : "лет";
    return `${years} ${word}`;
  }
  const months = Math.max(0, (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth());
  return `${months} мес`;
}

/** Days until the next birthday (0 = today), or null without a birthday. */
export function daysToBirthday(birthday: string | null) {
  if (!birthday) return null;
  const b = fromLocalStamp(birthday);
  const today = startOfDay(new Date());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function weeksAgo(stamp: string) {
  const days = Math.floor((Date.now() - fromLocalStamp(stamp).getTime()) / 86_400_000);
  if (days < 7) return days <= 0 ? "сегодня" : `${days} дн назад`;
  const w = Math.floor(days / 7);
  return `${w} нед назад`;
}

/** Minutes ↔ separate hour/minute inputs. */
export const splitMinutes = (min: number) => ({ h: Math.floor(min / 60), m: min % 60 });
