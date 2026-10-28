import type { Database } from "sql.js";

// Each entry upgrades the schema by one version. Never edit a shipped entry —
// devices may already be on it; append a new one instead. An entry is SQL,
// or a function when data has to be reshaped.
export type Migration = string | ((d: Database) => void);

export const MIGRATIONS: Migration[] = [
  `
  CREATE TABLE dogs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    breed TEXT NOT NULL DEFAULT '',
    sex TEXT NOT NULL DEFAULT '',
    weight TEXT NOT NULL DEFAULT '',
    birthday TEXT,
    tags TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    owner_name TEXT NOT NULL DEFAULT '',
    owner_phone TEXT NOT NULL DEFAULT '',
    owner_telegram TEXT NOT NULL DEFAULT '',
    photo TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE products (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id),
    line TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    photo TEXT,
    low_stock INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE procedures (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL,
    minutes INTEGER NOT NULL DEFAULT 60,
    price REAL NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE procedure_variants (
    id TEXT PRIMARY KEY,
    procedure_id TEXT NOT NULL REFERENCES procedures(id),
    name TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    price REAL NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0
  );

  -- Procedure/variant names, color and price are copied in so that history
  -- keeps showing what was booked even after the price list changes.
  CREATE TABLE appointments (
    id TEXT PRIMARY KEY,
    dog_id TEXT NOT NULL REFERENCES dogs(id),
    procedure_id TEXT,
    variant_id TEXT,
    proc_name TEXT NOT NULL,
    variant_name TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    minutes INTEGER NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'planned',
    paid REAL,
    notes TEXT NOT NULL DEFAULT '',
    photo_before TEXT,
    photo_after TEXT,
    filled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX appointments_starts_at ON appointments(starts_at);
  CREATE INDEX appointments_dog ON appointments(dog_id);

  CREATE TABLE appointment_products (
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    product_id TEXT NOT NULL REFERENCES products(id),
    PRIMARY KEY (appointment_id, product_id)
  );
  `,

  // v2: tags and owners become shared dictionaries; a dog can have several
  // owners. The old dogs.tags / dogs.owner_* columns are left in place but
  // no longer read. Name matching is done here in JS because SQLite's NOCASE
  // only folds ASCII, not Cyrillic.
  (d) => {
    d.exec(`
      CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE dog_tags (
        dog_id TEXT NOT NULL REFERENCES dogs(id),
        tag_id TEXT NOT NULL REFERENCES tags(id),
        PRIMARY KEY (dog_id, tag_id)
      );
      CREATE TABLE owners (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        telegram TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE TABLE dog_owners (
        dog_id TEXT NOT NULL REFERENCES dogs(id),
        owner_id TEXT NOT NULL REFERENCES owners(id),
        sort INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (dog_id, owner_id)
      );
    `);
    const rows = (d.exec("SELECT id, tags, owner_name, owner_phone, owner_telegram FROM dogs")[0]?.values ?? []) as string[][];
    const tagIds = new Map<string, string>();
    const ownerIds = new Map<string, string>();
    const now = new Date().toISOString();
    for (const [dogId, tags, name, phone, telegram] of rows) {
      for (const raw of (tags ?? "").split(",")) {
        const tag = raw.trim();
        if (!tag) continue;
        let id = tagIds.get(tag.toLowerCase());
        if (!id) {
          id = crypto.randomUUID();
          tagIds.set(tag.toLowerCase(), id);
          d.run("INSERT INTO tags (id, name) VALUES (?, ?)", [id, tag]);
        }
        d.run("INSERT OR IGNORE INTO dog_tags (dog_id, tag_id) VALUES (?, ?)", [dogId, id]);
      }
      if (!(name ?? "").trim() && !(phone ?? "").trim() && !(telegram ?? "").trim()) continue;
      const key = `${(name ?? "").trim().toLowerCase()}|${(phone ?? "").replace(/\D/g, "")}`;
      let id = ownerIds.get(key);
      if (!id) {
        id = crypto.randomUUID();
        ownerIds.set(key, id);
        d.run("INSERT INTO owners (id, name, phone, telegram, created_at) VALUES (?, ?, ?, ?, ?)", [
          id,
          (name ?? "").trim(),
          (phone ?? "").trim(),
          (telegram ?? "").trim(),
          now,
        ]);
      }
      d.run("INSERT OR IGNORE INTO dog_owners (dog_id, owner_id, sort) VALUES (?, ?, 0)", [dogId, id]);
    }
  },
];
