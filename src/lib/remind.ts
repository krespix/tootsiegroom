import { getSetting, type AppointmentRow } from "../db/repo";
import { addDays, fromLocalStamp, hhmm, sameDay } from "./dates";

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/** The reminder button shows during the 24 hours before a planned booking. */
export function canRemind(a: AppointmentRow, now: Date) {
  const start = fromLocalStamp(a.starts_at);
  return a.status !== "cancelled" && start > now && start.getTime() - now.getTime() <= 24 * 3_600_000;
}

export const REMIND_TEMPLATE_KEY = "remind_template";
export const DEFAULT_REMIND_TEMPLATE =
  "Здравствуйте, {хозяин}! Напоминаю: ждём {собака} {когда} в {время} на {процедура}. Если планы поменялись, напишите, пожалуйста.";
export const REMIND_FIELDS = ["{хозяин}", "{собака}", "{когда}", "{время}", "{процедура}"];

export function fillTemplate(template: string, v: { owner: string; dog: string; when: string; time: string; procedure: string }) {
  return (
    template
      .replaceAll("{хозяин}", v.owner.trim())
      .replaceAll("{собака}", v.dog)
      .replaceAll("{когда}", v.when)
      .replaceAll("{время}", v.time)
      .replaceAll("{процедура}", v.procedure)
      // Without an owner name "Здравствуйте, !" becomes "Здравствуйте!".
      .replace(/,\s*([!?.])/g, "$1")
      .replace(/ {2,}/g, " ")
      .trim()
  );
}

export function reminderText(a: AppointmentRow, ownerName: string, now: Date) {
  const start = fromLocalStamp(a.starts_at);
  const when = sameDay(start, now) ? "сегодня" : sameDay(start, addDays(now, 1)) ? "завтра" : `${start.getDate()} ${MONTHS_GEN[start.getMonth()]}`;
  return fillTemplate(getSetting(REMIND_TEMPLATE_KEY) ?? DEFAULT_REMIND_TEMPLATE, {
    owner: ownerName,
    dog: a.dog_name,
    when,
    time: hhmm(start),
    procedure: a.proc_name.toLowerCase() + (a.variant_name ? ` (${a.variant_name.toLowerCase()})` : ""),
  });
}

/** Copies synchronously where possible so the click still counts as a user gesture for opening the link. */
export function copyText(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  // An open modal dialog makes the rest of the page inert, so the helper has to live inside it.
  (document.activeElement?.closest("dialog") ?? document.body).appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length); // iOS ignores select() alone
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  if (!ok) void navigator.clipboard?.writeText(text).catch(() => {});
}
