export const PASTELS = ["#FFD6E5", "#CFF3E9", "#FFE9A8", "#E4DDFF", "#D4ECFF"] as const;

/** Today's earnings above this many lari earn Natasha a joke. */
export const RICH_DAY_GEL = 200;

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

export function money(n: number | null | undefined) {
  if (n == null) return "—";
  return `${Math.round(n * 100) / 100} ₾`;
}

export function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} ч` : "", m ? `${m} мин` : ""].filter(Boolean).join(" ") || "0 мин";
}

/** Stable pastel for things without an explicit color (dog avatars, brands). */
export function pastelFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PASTELS[Math.abs(h) % PASTELS.length];
}

export function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function splitTags(tags: string) {
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
