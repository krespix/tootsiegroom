import { all, one, run, write } from "./db";
import { newId, nowIso } from "../lib/format";
import { toLocalStamp } from "../lib/dates";

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
export type Owner = { id: string; name: string; phone: string; telegram: string };
export type OwnerInput = { id?: string; name: string; phone: string; telegram: string };

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
    .filter((o) => o.name.trim() || o.phone.trim() || o.telegram.trim())
    .forEach((o, i) => {
      let id = o.id;
      if (id) {
        run("UPDATE owners SET name = ?, phone = ?, telegram = ? WHERE id = ?", [o.name.trim(), o.phone.trim(), o.telegram.trim(), id]);
      } else {
        id = newId();
        run("INSERT INTO owners (id, name, phone, telegram, created_at) VALUES (?, ?, ?, ?, ?)", [id, o.name.trim(), o.phone.trim(), o.telegram.trim(), nowIso()]);
      }
      run("INSERT OR IGNORE INTO dog_owners (dog_id, owner_id, sort) VALUES (?, ?, ?)", [dogId, id, i]);
    });
}

/** Tags and owners live only while some dog uses them — the dictionaries follow the dogs. */
function pruneDictionaries() {
  run("DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM dog_tags)");
  run("DELETE FROM owners WHERE id NOT IN (SELECT owner_id FROM dog_owners)");
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
  return all<Owner & { dogs: string }>(
    `SELECT o.*, GROUP_CONCAT(d.name, ', ') AS dogs FROM owners o
     JOIN dog_owners x ON x.owner_id = o.id JOIN dogs d ON d.id = x.dog_id
     GROUP BY o.id`,
  ).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function dogTagsMap(): Map<string, Tag[]> {
  const rows = all<Tag & { dog_id: string }>("SELECT x.dog_id, t.id, t.name FROM dog_tags x JOIN tags t ON t.id = x.tag_id");
  const m = new Map<string, Tag[]>();
  for (const r of rows) m.set(r.dog_id, [...(m.get(r.dog_id) ?? []), { id: r.id, name: r.name }].sort((a, b) => a.name.localeCompare(b.name, "ru")));
  return m;
}

export function dogOwnersMap(): Map<string, Owner[]> {
  const rows = all<Owner & { dog_id: string }>(
    "SELECT x.dog_id, o.id, o.name, o.phone, o.telegram FROM dog_owners x JOIN owners o ON o.id = x.owner_id ORDER BY x.sort",
  );
  const m = new Map<string, Owner[]>();
  for (const { dog_id, ...o } of rows) m.set(dog_id, [...(m.get(dog_id) ?? []), o]);
  return m;
}

export const tagsOf = (dogId: string) => dogTagsMap().get(dogId) ?? [];
export const ownersOf = (dogId: string) => dogOwnersMap().get(dogId) ?? [];

/** Last non-cancelled visit that already happened, per dog. */
export function lastVisits(): Map<string, string> {
  const rows = all<{ dog_id: string; last: string }>(
    `SELECT dog_id, MAX(starts_at) AS last FROM appointments
     WHERE status != 'cancelled' AND starts_at <= ? GROUP BY dog_id`,
    [toLocalStamp(new Date())],
  );
  return new Map(rows.map((r) => [r.dog_id, r.last]));
}

export function dogsWithUpcoming(): Set<string> {
  const rows = all<{ dog_id: string }>(
    "SELECT DISTINCT dog_id FROM appointments WHERE status != 'cancelled' AND starts_at > ?",
    [toLocalStamp(new Date())],
  );
  return new Set(rows.map((r) => r.dog_id));
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
    run("DELETE FROM procedure_variants WHERE procedure_id = ?", [id]);
    p.variants.forEach((v, i) =>
      run("INSERT INTO procedure_variants (id, procedure_id, name, minutes, price, sort) VALUES (?,?,?,?,?,?)", [
        v.id ?? newId(),
        id!,
        v.name,
        v.minutes,
        v.price,
        i,
      ]),
    );
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
