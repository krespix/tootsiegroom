import type { AppointmentRow, Dog } from "../db/repo";
import { addMinutes, fromLocalStamp } from "./dates";

const pad = (n: number) => String(n).padStart(2, "0");

// Floating local time (no TZID): the event lands at the same wall-clock time
// in whatever timezone the calendar is in, which is what the salon wants.
const local = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

const utc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function appointmentTitle(a: Pick<AppointmentRow, "dog_name" | "proc_name" | "variant_name">) {
  return `${a.dog_name} · ${a.proc_name}${a.variant_name ? `, ${a.variant_name.toLowerCase()}` : ""}`;
}

export function buildIcs(appts: AppointmentRow[], dogs: Map<string, Dog>) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TootsieGroom//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const a of appts) {
    const start = fromLocalStamp(a.starts_at);
    const dog = dogs.get(a.dog_id);
    const owner = [dog?.owner_name, dog?.owner_phone].filter(Boolean).join(", ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${a.id}@tootsiegroom`,
      `DTSTAMP:${utc(new Date())}`,
      `DTSTART:${local(start)}`,
      `DTEND:${local(addMinutes(start, a.minutes))}`,
      `SUMMARY:${escape(appointmentTitle(a))}`,
      ...(owner ? [`DESCRIPTION:${escape(`Хозяин: ${owner}`)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * On the phone the share sheet offers "Calendar"; on the Mac the file is
 * downloaded and opens in Calendar on click. Must run inside a click handler.
 */
export async function openInCalendar(filename: string, ics: string) {
  const file = new File([ics], filename, { type: "text/calendar" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
