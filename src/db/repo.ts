import { all, one, run, write } from "./db";
import { newId, nowIso } from "../lib/format";
import { toDateKey, toLocalStamp } from "../lib/dates";

export type Dog = {
  id: string;
  name: string;
  breed: string;
  sex: string;
  weight: string;
  birthday: string | null;
  notes: string;
  photo: string | null;
  created_at: string;
  updated_at: string;
};

export type Tag = { id: string; name: string };
export type ContactKind = "phone" | "telegram" | "instagram";
export type Contact = { kind: ContactKind; value: string };
export type Owner = { id: string; name: string; contacts: Contact[] };
export type OwnerInput = { id?: string; name: string; contacts: Contact[] };

export type Brand = { id: string; name: string; color: string; sort: number };

export type Product = {
  id: string;
  brand_id: string;
  line: string;
  name: string;
  description: string;
  photo: string | null;
  low_stock: number;
  archived: number;
};

export type Procedure = {
  id: string;
  name: string;
  description: string;
  color: string;
  minutes: number;
  price: number;
  sort: number;
  archived: number;
};

export type Variant = { id: string; procedure_id: string; name: string; minutes: number; price: number; sort: number };

export type ProcedureWithVariants = Procedure & { variants: Variant[] };

export type Appointment = {
  id: string;
  dog_id: string;
  procedure_id: string | null;
  variant_id: string | null;
  proc_name: string;
  variant_name: string;
  color: string;
  starts_at: string;
  minutes: number;
  price: number;
  status: "planned" | "cancelled";
  paid: number | null;
  notes: string;
  photo_before: string | null;
  photo_after: string | null;
  filled_at: string | null;
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentRow = Appointment & { dog_name: string; dog_breed: string; dog_photo: string | null };

export type UsedProduct = { id: string; name: string; brand_name: string };

// ---------- dogs ----------

export function listDogs(): Dog[] {
  return all<Dog>("SELECT * FROM dogs ORDER BY name COLLATE NOCASE");
}

export function getDog(id: string) {
  return one<Dog>("SELECT * FROM dogs WHERE id = ?", [id]);
}

export type DogInput = Omit<Dog, "id" | "created_at" | "updated_at"> & { id?: string };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function linkTags(dogId: string, names: string[]) {
  run("DELETE FROM dog_tags WHERE dog_id = ?", [dogId]);
  const existing = all<Tag>("SELECT * FROM tags");
  const seen: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || seen.some((s) => sameName(s, name))) continue;
    seen.push(name);
    let id = existing.find((t) => sameName(t.name, name))?.id;
    if (!id) {
      id = newId();
      run("INSERT INTO tags (id, name) VALUES (?, ?)", [id, name]);
      existing.push({ id, name });
    }
    run("INSERT INTO dog_tags (dog_id, tag_id) VALUES (?, ?)", [dogId, id]);
  }
}

/** Existing owners (with id) are updated in place, so a new phone shows on all their dogs. */
function linkOwners(dogId: string, owners: OwnerInput[]) {
  run("DELETE FROM dog_owners WHERE dog_id = ?", [dogId]);
  owners
    .map((o) => ({ ...o, name: o.name.trim(), contacts: o.contacts.map((c) => ({ ...c, value: c.value.trim() })).filter((c) => c.value) }))
    .filter((o) => o.name || o.contacts.length)
    .forEach((o, i) => {
      let id = o.id;
      if (id) {
        run("UPDATE owners SET name = ? WHERE id = ?", [o.name, id]);
        run("DELETE FROM owner_contacts WHERE owner_id = ?", [id]);
      } else {
        id = newId();
        run("INSERT INTO owners (id, name, created_at) VALUES (?, ?, ?)", [id, o.name, nowIso()]);
      }
      o.contacts.forEach((c, j) =>
        run("INSERT INTO owner_contacts (id, owner_id, kind, value, sort) VALUES (?, ?, ?, ?, ?)", [newId(), id!, c.kind, c.value, j]),
      );
      run("INSERT OR IGNORE INTO dog_owners (dog_id, owner_id, sort) VALUES (?, ?, ?)", [dogId, id, i]);
    });
}

/** Tags and owners live only while some dog uses them — the dictionaries follow the dogs. */
function pruneDictionaries() {
  run("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM dog_tags)");
  run("DELETE FROM owner_contacts WHERE owner_id NOT IN (SELECT owner_id FROM dog_owners)");
  run("DELETE FROM owners WHERE id NOT IN (SELECT owner_id FROM dog_owners)");
}

function contactsByOwner(): Map<string, Contact[]> {
  const rows = all<Contact & { owner_id: string }>("SELECT owner_id, kind, value FROM owner_contacts ORDER BY sort");
  const m = new Map<string, Contact[]>();
  for (const { owner_id, kind, value } of rows) m.set(owner_id, [...(m.get(owner_id) ?? []), { kind, value }]);
  return m;
}

/** Saves the dog; `tags` / `owners`, when given, replace the dog's current ones. */
export function saveDog(d: DogInput, extra: { tags?: string[]; owners?: OwnerInput[] } = {}): string {
  return write(() => {
    const now = nowIso();
    let id = d.id;
    if (id) {
      run("UPDATE dogs SET name=?, breed=?, sex=?, weight=?, birthday=?, notes=?, photo=?, updated_at=? WHERE id=?", [
        d.name,
        d.breed.trim(),
        d.sex,
        d.weight,
        d.birthday,
        d.notes,
        d.photo,
        now,
        id,
      ]);
    } else {
      id = newId();
      run("INSERT INTO dogs (id, name, breed, sex, weight, birthday, notes, photo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", [
        id,
        d.name,
        d.breed.trim(),
        d.sex,
        d.weight,
        d.birthday,
        d.notes,
        d.photo,
        now,
        now,
      ]);
    }
    if (extra.tags) linkTags(id, extra.tags);
    if (extra.owners) linkOwners(id, extra.owners);
    pruneDictionaries();
    return id;
  });
}

/** Deletes the dog together with its bookings and visit history. */
export function deleteDog(id: string) {
  write(() => {
    run("DELETE FROM appointment_products WHERE appointment_id IN (SELECT id FROM appointments WHERE dog_id = ?)", [id]);
    run("DELETE FROM appointments WHERE dog_id = ?", [id]);
    run("DELETE FROM dog_tags WHERE dog_id = ?", [id]);
    run("DELETE FROM dog_owners WHERE dog_id = ?", [id]);
    run("DELETE FROM dogs WHERE id = ?", [id]);
    pruneDictionaries();
  });
}

export function emptyDog(): DogInput {
  return { name: "", breed: "", sex: "", weight: "", birthday: null, notes: "", photo: null };
}

export function countDogAppointments(id: string) {
  return one<{ n: number }>("SELECT COUNT(*) AS n FROM appointments WHERE dog_id = ?", [id])?.n ?? 0;
}

// Dictionaries for suggestions and filters, derived from what dogs actually use.

export function listBreeds(): string[] {
  const rows = all<{ breed: string }>("SELECT DISTINCT breed FROM dogs WHERE TRIM(breed) != ''");
  const seen = new Map<string, string>();
  for (const r of rows) if (!seen.has(r.breed.toLowerCase())) seen.set(r.breed.toLowerCase(), r.breed);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "ru"));
}

export function listTags(): Tag[] {
  return all<Tag>("SELECT * FROM tags").sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function listOwners(): (Owner & { dogs: string })[] {
  const contacts = contactsByOwner();
  return all<{ id: string; name: string; dogs: string }>(
    `SELECT o.id, o.name, GROUP_CONCAT(d.name, ', ') AS dogs FROM owners o
     JOIN dog_owners x ON x.owner_id = o.id JOIN dogs d ON d.id = x.dog_id
     GROUP BY o.id`,
  )
    .map((o) => ({ ...o, contacts: contacts.get(o.id) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function dogTagsMap(): Map<string, Tag[]> {
  const rows = all<Tag & { dog_id: string }>("SELECT x.dog_id, t.id, t.name FROM dog_tags x JOIN tags t ON t.id = x.tag_id");
  const m = new Map<string, Tag[]>();
  for (const r of rows) m.set(r.dog_id, [...(m.get(r.dog_id) ?? []), { id: r.id, name: r.name }].sort((a, b) => a.name.localeCompare(b.name, "ru")));
  return m;
}

export function dogOwnersMap(): Map<string, Owner[]> {
  const contacts = contactsByOwner();
  const rows = all<{ dog_id: string; id: string; name: string }>(
    "SELECT x.dog_id, o.id, o.name FROM dog_owners x JOIN owners o ON o.id = x.owner_id ORDER BY x.sort",
  );
  const m = new Map<string, Owner[]>();
  for (const { dog_id, ...o } of rows) m.set(dog_id, [...(m.get(dog_id) ?? []), { ...o, contacts: contacts.get(o.id) ?? [] }]);
  return m;
}

/** Text of all an owner's contacts, for search. */
export const ownerSearchText = (o: Owner) => [o.name, ...o.contacts.map((c) => c.value)].join(" ");

export const tagsOf = (dogId: string) => dogTagsMap().get(dogId) ?? [];
export const ownersOf = (dogId: string) => dogOwnersMap().get(dogId) ?? [];

/** Last non-cancelled visit that already happened, per dog. */
/** Each dog's latest visit that started by `at` (default: now). */
export function lastVisits(at = new Date()): Map<string, string> {
  const rows = all<{ dog_id: string; last: string }>(
    `SELECT dog_id, MAX(starts_at) AS last FROM appointments
     WHERE status != 'cancelled' AND starts_at <= ? GROUP BY dog_id`,
    [toLocalStamp(at)],
  );
  return new Map(rows.map((r) => [r.dog_id, r.last]));
}

/** Dogs booked after `at` (default: now). */
export function dogsWithUpcoming(at = new Date()): Set<string> {
  const rows = all<{ dog_id: string }>(
    "SELECT DISTINCT dog_id FROM appointments WHERE status != 'cancelled' AND starts_at > ?",
    [toLocalStamp(at)],
  );
  return new Set(rows.map((r) => r.dog_id));
}

// ---------- settings ----------

export function getSetting(key: string): string | null {
  return one<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key])?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  write(() => {
    if (value === null) run("DELETE FROM settings WHERE key = ?", [key]);
    else run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  });
}

export type WorkHours = { start: string; end: string };
export const DEFAULT_WORK_HOURS: WorkHours = { start: "11:00", end: "20:00" };

export function workHours(): WorkHours {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key IN ('work_start', 'work_end')");
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return { start: m.get("work_start") ?? DEFAULT_WORK_HOURS.start, end: m.get("work_end") ?? DEFAULT_WORK_HOURS.end };
}

export function setWorkHours(h: WorkHours) {
  write(() => {
    run("INSERT OR REPLACE INTO settings (key, value) VALUES ('work_start', ?)", [h.start]);
    run("INSERT OR REPLACE INTO settings (key, value) VALUES ('work_end', ?)", [h.end]);
  });
}

// ---------- stats ----------

export type StatVisit = {
  id: string;
  dog_id: string;
  dog_name: string;
  procedure_id: string | null;
  proc_name: string;
  starts_at: string;
  minutes: number;
  price: number;
  paid: number | null;
};

/** Non-cancelled bookings starting in [from, to) (local stamps or date keys). */
export function statVisits(from: string, to: string): StatVisit[] {
  return all<StatVisit>(
    `SELECT a.id, a.dog_id, d.name AS dog_name, a.procedure_id, a.proc_name, a.starts_at, a.minutes, a.price, a.paid
     FROM appointments a JOIN dogs d ON d.id = a.dog_id
     WHERE a.status != 'cancelled' AND a.starts_at >= ? AND a.starts_at < ? ORDER BY a.starts_at`,
    [from, to],
  );
}

export type ProductUse = { appointment_id: string; dog_id: string; product_id: string; product_name: string; brand_id: string; brand_name: string };

/** One row per cosmetic product ticked on a non-cancelled visit in [from, to). */
export function productUsesBetween(from: string, to: string): ProductUse[] {
  return all<ProductUse>(
    `SELECT ap.appointment_id, a.dog_id, p.id AS product_id, p.name AS product_name, b.id AS brand_id, b.name AS brand_name
     FROM appointment_products ap
     JOIN appointments a ON a.id = ap.appointment_id
     JOIN products p ON p.id = ap.product_id
     JOIN brands b ON b.id = p.brand_id
     WHERE a.status != 'cancelled' AND a.starts_at >= ? AND a.starts_at < ?`,
    [from, to],
  );
}

// ---------- cosmetics ----------

export function listBrands(): Brand[] {
  return all<Brand>("SELECT * FROM brands ORDER BY sort, name COLLATE NOCASE");
}

export function saveBrand(name: string, color: string): string {
  return write(() => {
    const id = newId();
    const sort = one<{ n: number }>("SELECT COUNT(*) AS n FROM brands")?.n ?? 0;
    run("INSERT INTO brands (id, name, color, sort) VALUES (?,?,?,?)", [id, name, color, sort]);
    return id;
  });
}

export function renameBrand(id: string, name: string) {
  write(() => run("UPDATE brands SET name = ? WHERE id = ?", [name, id]));
}

export function listProducts(includeArchived = false): Product[] {
  return all<Product>(
    `SELECT * FROM products ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY line COLLATE NOCASE, name COLLATE NOCASE`,
  );
}

export type ProductInput = Omit<Product, "id" | "archived"> & { id?: string };

export function saveProduct(p: ProductInput): string {
  return write(() => {
    if (p.id) {
      run("UPDATE products SET brand_id=?, line=?, name=?, description=?, photo=?, low_stock=? WHERE id=?", [
        p.brand_id,
        p.line,
        p.name,
        p.description,
        p.photo,
        p.low_stock,
        p.id,
      ]);
      return p.id;
    }
    const id = newId();
    run("INSERT INTO products (id, brand_id, line, name, description, photo, low_stock) VALUES (?,?,?,?,?,?,?)", [
      id,
      p.brand_id,
      p.line,
      p.name,
      p.description,
      p.photo,
      p.low_stock,
    ]);
    return id;
  });
}

export function archiveProduct(id: string) {
  write(() => run("UPDATE products SET archived = 1 WHERE id = ?", [id]));
}

export function productUsage(): Map<string, number> {
  const rows = all<{ product_id: string; n: number }>(
    `SELECT ap.product_id, COUNT(*) AS n FROM appointment_products ap
     JOIN appointments a ON a.id = ap.appointment_id AND a.status != 'cancelled'
     GROUP BY ap.product_id`,
  );
  return new Map(rows.map((r) => [r.product_id, r.n]));
}

// ---------- procedures ----------

export function listProcedures(includeArchived = false): ProcedureWithVariants[] {
  const procs = all<Procedure>(
    `SELECT * FROM procedures ${includeArchived ? "" : "WHERE archived = 0"} ORDER BY sort, name COLLATE NOCASE`,
  );
  const variants = all<Variant>("SELECT * FROM procedure_variants ORDER BY sort");
  return procs.map((p) => ({ ...p, variants: variants.filter((v) => v.procedure_id === p.id) }));
}

export type VariantInput = { id?: string; name: string; minutes: number; price: number };
export type ProcedureInput = Omit<Procedure, "id" | "sort" | "archived"> & { id?: string; variants: VariantInput[] };

/**
 * Bookings from today on follow the current price list: name, colour, duration
 * and price are re-copied from the procedure. Past days keep what they were booked at.
 */
function refreshUpcoming(id: string, p: ProcedureInput, variants: (VariantInput & { id: string })[]) {
  const from = toDateKey(new Date());
  const now = nowIso();
  const where = "procedure_id = ? AND starts_at >= ? AND status != 'cancelled'";
  // A paid amount that just mirrored the old price follows the new one.
  const setPrice = "paid = CASE WHEN paid = price THEN ? ELSE paid END, price = ?";
  run(`UPDATE appointments SET proc_name = ?, color = ?, minutes = ?, ${setPrice}, updated_at = ? WHERE ${where} AND variant_id IS NULL`, [
    p.name,
    p.color,
    p.minutes,
    p.price,
    p.price,
    now,
    id,
    from,
  ]);
  // A variant removed and added again gets a new id, so bookings left on a gone id are matched by name.
  const ids = new Set(variants.map((v) => v.id));
  const byName = new Map(variants.map((v) => [v.name.trim().toLowerCase(), v.id]));
  const stray = all<{ id: string; variant_id: string; variant_name: string }>(
    `SELECT id, variant_id, variant_name FROM appointments WHERE ${where} AND variant_id IS NOT NULL`,
    [id, from],
  ).filter((a) => !ids.has(a.variant_id));
  for (const a of stray) {
    const vid = byName.get(a.variant_name.trim().toLowerCase());
    if (vid) run("UPDATE appointments SET variant_id = ? WHERE id = ?", [vid, a.id]);
  }
  for (const v of variants) {
    run(`UPDATE appointments SET proc_name = ?, variant_name = ?, color = ?, minutes = ?, ${setPrice}, updated_at = ? WHERE ${where} AND variant_id = ?`, [
      p.name,
      v.name,
      p.color,
      v.minutes,
      v.price,
      v.price,
      now,
      id,
      from,
      v.id,
    ]);
  }
}

export function saveProcedure(p: ProcedureInput): string {
  return write(() => {
    let id = p.id;
    if (id) {
      run("UPDATE procedures SET name=?, description=?, color=?, minutes=?, price=? WHERE id=?", [
        p.name,
        p.description,
        p.color,
        p.minutes,
        p.price,
        id,
      ]);
    } else {
      id = newId();
      const sort = one<{ n: number }>("SELECT COUNT(*) AS n FROM procedures")?.n ?? 0;
      run("INSERT INTO procedures (id, name, description, color, minutes, price, sort) VALUES (?,?,?,?,?,?,?)", [
        id,
        p.name,
        p.description,
        p.color,
        p.minutes,
        p.price,
        sort,
      ]);
    }
    // Appointments keep their own copy of the variant, so replacing rows is safe.
    const variants = p.variants.map((v) => ({ ...v, id: v.id ?? newId() }));
    run("DELETE FROM procedure_variants WHERE procedure_id = ?", [id]);
    variants.forEach((v, i) =>
      run("INSERT INTO procedure_variants (id, procedure_id, name, minutes, price, sort) VALUES (?,?,?,?,?,?)", [
        v.id,
        id!,
        v.name,
        v.minutes,
        v.price,
        i,
      ]),
    );
    if (p.id) refreshUpcoming(id, p, variants);
    return id;
  });
}

export function archiveProcedure(id: string) {
  write(() => run("UPDATE procedures SET archived = 1 WHERE id = ?", [id]));
}

// ---------- appointments ----------

const APPT_SELECT = `
  SELECT a.*, d.name AS dog_name, d.breed AS dog_breed, d.photo AS dog_photo
  FROM appointments a JOIN dogs d ON d.id = a.dog_id`;

export function appointmentsBetween(from: string, to: string): AppointmentRow[] {
  return all<AppointmentRow>(
    `${APPT_SELECT} WHERE a.starts_at >= ? AND a.starts_at < ? AND a.status != 'cancelled' ORDER BY a.starts_at`,
    [from, to],
  );
}

/** Past visits that still need cosmetics/photos/payment filled in. */
export function unfilledAppointments(): AppointmentRow[] {
  return all<AppointmentRow>(
    `${APPT_SELECT} WHERE a.status != 'cancelled' AND a.filled_at IS NULL AND a.starts_at <= ? ORDER BY a.starts_at DESC`,
    [toLocalStamp(new Date())],
  );
}

export function dogAppointments(dogId: string): AppointmentRow[] {
  return all<AppointmentRow>(`${APPT_SELECT} WHERE a.dog_id = ? ORDER BY a.starts_at DESC`, [dogId]);
}

export function getAppointment(id: string) {
  return one<AppointmentRow>(`${APPT_SELECT} WHERE a.id = ?`, [id]);
}

export function usedProducts(appointmentId: string): UsedProduct[] {
  return all<UsedProduct>(
    `SELECT p.id, p.name, b.name AS brand_name FROM appointment_products ap
     JOIN products p ON p.id = ap.product_id JOIN brands b ON b.id = p.brand_id
     WHERE ap.appointment_id = ? ORDER BY b.name, p.name`,
    [appointmentId],
  );
}

export type BookingInput = {
  dog_id: string;
  procedure: Procedure;
  variant: Variant | null;
  starts_at: string;
};

export function createAppointment(b: BookingInput): string {
  return write(() => {
    const id = newId();
    const now = nowIso();
    const minutes = b.variant?.minutes ?? b.procedure.minutes;
    const price = b.variant?.price ?? b.procedure.price;
    run(
      `INSERT INTO appointments (id, dog_id, procedure_id, variant_id, proc_name, variant_name, color, starts_at, minutes, price, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, b.dog_id, b.procedure.id, b.variant?.id ?? null, b.procedure.name, b.variant?.name ?? "", b.procedure.color, b.starts_at, minutes, price, now, now],
    );
    return id;
  });
}

export function rescheduleAppointment(id: string, startsAt: string) {
  write(() => run("UPDATE appointments SET starts_at = ?, updated_at = ? WHERE id = ?", [startsAt, nowIso(), id]));
}

/**
 * Switch a booking to another procedure/variant, copying its current name, colour, duration and price.
 * A paid amount that just mirrored the old price follows the new one; a custom amount stays.
 */
export function changeAppointmentProcedure(id: string, procedure: Procedure, variant: Variant | null) {
  const price = variant?.price ?? procedure.price;
  write(() =>
    run(
      `UPDATE appointments SET procedure_id = ?, variant_id = ?, proc_name = ?, variant_name = ?, color = ?, minutes = ?,
         paid = CASE WHEN paid = price THEN ? ELSE paid END, price = ?, updated_at = ?
       WHERE id = ?`,
      [
        procedure.id,
        variant?.id ?? null,
        procedure.name,
        variant?.name ?? "",
        procedure.color,
        variant?.minutes ?? procedure.minutes,
        price,
        price,
        nowIso(),
        id,
      ],
    ),
  );
}

export function markReminded(id: string) {
  write(() => run("UPDATE appointments SET reminded_at = ? WHERE id = ?", [nowIso(), id]));
}

export function cancelAppointment(id: string) {
  write(() => run("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?", [nowIso(), id]));
}

/**
 * A visit counts as filled when it holds something beyond the booking:
 * products, a photo or a note. Payment alone doesn't count — it is
 * prefilled from the price list.
 */
function visitHasContent(id: string): boolean {
  const row = one<{ notes: string; photo_before: string | null; photo_after: string | null; n: number }>(
    `SELECT notes, photo_before, photo_after,
       (SELECT COUNT(*) FROM appointment_products WHERE appointment_id = a.id) AS n
     FROM appointments a WHERE id = ?`,
    [id],
  );
  return !!row && (row.n > 0 || row.notes.trim() !== "" || !!row.photo_before || !!row.photo_after);
}

export function setAppointmentPhoto(id: string, which: "photo_before" | "photo_after", name: string | null) {
  write(() => {
    run(`UPDATE appointments SET ${which} = ?, updated_at = ? WHERE id = ?`, [name, nowIso(), id]);
    // Adding a photo doesn't complete a visit (that's "Сохранить визит"), but
    // removing the last piece of content makes it unfilled again.
    if (!visitHasContent(id)) run("UPDATE appointments SET filled_at = NULL WHERE id = ?", [id]);
  });
}

/** Saves the visit report; returns whether the visit now counts as filled. */
export function saveVisit(id: string, v: { paid: number | null; notes: string; productIds: string[] }): boolean {
  return write(() => {
    const now = nowIso();
    run("UPDATE appointments SET paid = ?, notes = ?, updated_at = ? WHERE id = ?", [v.paid, v.notes, now, id]);
    run("DELETE FROM appointment_products WHERE appointment_id = ?", [id]);
    v.productIds.forEach((pid) => run("INSERT INTO appointment_products (appointment_id, product_id) VALUES (?,?)", [id, pid]));
    const filled = visitHasContent(id);
    run("UPDATE appointments SET filled_at = CASE WHEN ? THEN COALESCE(filled_at, ?) ELSE NULL END WHERE id = ?", [filled ? 1 : 0, now, id]);
    return filled;
  });
}
