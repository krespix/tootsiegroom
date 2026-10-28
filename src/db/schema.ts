// Each entry upgrades the schema by one version. Never edit a shipped entry —
// devices may already be on it; append a new one instead.
export const MIGRATIONS: string[] = [
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
];
