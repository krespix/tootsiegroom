import type { Contact, ContactKind } from "../db/repo";
import type { IconName } from "../components/Icon";

export const CONTACT_KINDS: {
  kind: ContactKind;
  label: string;
  icon: IconName;
  placeholder: string;
  inputMode: "tel" | "text" | "url";
}[] = [
  { kind: "phone", label: "Телефон", icon: "phone", placeholder: "+995 …", inputMode: "tel" },
  { kind: "telegram", label: "Telegram", icon: "send", placeholder: "@username или ссылка", inputMode: "text" },
  { kind: "instagram", label: "Instagram", icon: "instagram", placeholder: "@username или ссылка", inputMode: "text" },
];

export const kindMeta = (kind: ContactKind) => CONTACT_KINDS.find((k) => k.kind === kind)!;

const HOSTS: Partial<Record<ContactKind, RegExp>> = {
  telegram: /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([^/?#\s]+)/i,
  instagram: /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i,
};

const BASE: Partial<Record<ContactKind, string>> = {
  telegram: "https://t.me/",
  instagram: "https://instagram.com/",
};

/** Accepts "@name", "name" or a full/partial profile link. */
function handleOf(c: Contact): string | null {
  const v = c.value.trim();
  const m = HOSTS[c.kind]?.exec(v);
  if (m) return m[1];
  if (/^https?:\/\//i.test(v)) return null; // some other link — use as is
  return v.replace(/^@/, "") || null;
}

export function contactHref(c: Contact): string | null {
  const v = c.value.trim();
  if (!v) return null;
  if (c.kind === "phone") return `tel:${v.replace(/[^\d+]/g, "")}`;
  const handle = handleOf(c);
  if (handle) return BASE[c.kind] + handle;
  return /^https?:\/\//i.test(v) ? v : null;
}

/** What to show: the number, or "@handle" instead of a long link. */
export function contactLabel(c: Contact): string {
  if (c.kind === "phone") return c.value.trim();
  const handle = handleOf(c);
  return handle ? `@${handle}` : c.value.trim();
}
