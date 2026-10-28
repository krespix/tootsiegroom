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
  tags: string;
  notes: string;
  owner_name: string;
  owner_phone: string;
  owner_telegram: string;
  photo: string | null;
  created_at: string;
  updated_at: string;
};

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

export function saveDog(d: DogInput): string {
  return write(() => {
    const now = nowIso();
    if (d.id) {
      run(
        `UPDATE dogs SET name=?, breed=?, sex=?, weight=?, birthday=?, tags=?, notes=?, owner_name=?,
         owner_phone=?, owner_telegram=?, photo=?, updated_at=? WHERE id=?`,
        [d.name, d.breed, d.sex, d.weight, d.birthday, d.tags, d.notes, d.owner_name, d.owner_phone, d.owner_telegram, d.photo, now, d.id],
      );
      return d.id;
    }
    const id = newId();
    run(
      `INSERT INTO dogs (id, name, breed, sex, weight, birthday, tags, notes, owner_name, owner_phone, owner_telegram, photo, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.name, d.breed, d.sex, d.weight, d.birthday, d.tags, d.notes, d.owner_name, d.owner_phone, d.owner_telegram, d.photo, now, now],
    );
    return id;
  });
}

export function emptyDog(): DogInput {
  return {
    name: "",
    breed: "",
    sex: "",
    weight: "",
    birthday: null,
    tags: "",
    notes: "",
    owner_name: "",
    owner_phone: "",
    owner_telegram: "",
    photo: null,
  };
}

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
