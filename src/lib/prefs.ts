import { appointmentsBetween, getSetting } from "../db/repo";
import { addDays, fromLocalStamp, hhmm, toDateKey } from "./dates";
import { EARNING_JOKES, plural } from "./format";

export type Joke = { min: number; text: string };

export const DEFAULT_JOKES: Joke[] = EARNING_JOKES.map(([min, text]) => ({ min, text }));

export function jokes(): Joke[] {
  const raw = getSetting("jokes");
  if (raw) {
    try {
      const list = JSON.parse(raw) as Joke[];
      if (Array.isArray(list)) return list.filter((j) => j && typeof j.min === "number" && typeof j.text === "string");
    } catch {
      // fall back to the defaults below
    }
  }
  return DEFAULT_JOKES;
}

export const jokesOn = () => getSetting("jokes_off") !== "1";

/** Index of the highest joke threshold reached (higher = better day), or -1. */
export function jokeLevel(earned: number) {
  if (!jokesOn()) return -1;
  const sorted = jokes()
    .filter((j) => j.text.trim())
    .sort((a, b) => a.min - b.min);
  let level = -1;
  sorted.forEach((j, i) => {
    if (earned >= j.min) level = i;
  });
  return level;
}

export function earningJoke(earned: number) {
  const level = jokeLevel(earned);
  if (level < 0) return null;
  return jokes()
    .filter((j) => j.text.trim())
    .sort((a, b) => a.min - b.min)[level].text;
}

export const greetName = () => getSetting("greet_name") ?? "";
export const fxOn = () => getSetting("fx_off") !== "1";

export function greeting(now: Date, name: string) {
  const h = now.getHours();
  const hello = h >= 5 && h < 12 ? "Доброе утро" : h >= 12 && h < 17 ? "Добрый день" : h >= 17 && h < 23 ? "Добрый вечер" : "Доброй ночи";
  return name.trim() ? `${hello}, ${name.trim()}!` : `${hello}!`;
}

/** "Впереди 2 собаки, ближайшая в 15:00." for the greeting and the splash. */
export function todaySummary(now: Date) {
  const today = appointmentsBetween(toDateKey(now), toDateKey(addDays(now, 1)));
  const ahead = today.filter((a) => fromLocalStamp(a.starts_at) > now);
  if (ahead.length) return `Впереди ${ahead.length} ${plural(ahead.length, "собака", "собаки", "собак")}, ближайшая в ${hhmm(fromLocalStamp(ahead[0].starts_at))}.`;
  return today.length ? "На сегодня всё — можно отдыхать." : "Сегодня записей нет.";
}
