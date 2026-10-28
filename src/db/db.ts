import initSqlJs from "sql.js";
import type { Database, SqlJsStatic, SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import { MIGRATIONS } from "./schema";

const IDB_KEY = "db";

let SQL: SqlJsStatic;
let db: Database;
let version = 0;
const listeners = new Set<() => void>();
const changeHooks = new Set<() => void>();
let persisting: Promise<void> = Promise.resolve();
let persistQueued = false;

export type Params = SqlValue[] | Record<string, SqlValue>;

function migrate(d: Database) {
  const current = (d.exec("PRAGMA user_version")[0]?.values[0]?.[0] as number) ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    d.exec("BEGIN");
    d.exec(MIGRATIONS[v]);
    d.exec(`PRAGMA user_version = ${v + 1}`);
    d.exec("COMMIT");
  }
  d.exec("PRAGMA foreign_keys = ON");
}

export async function openDb() {
  SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await get<Uint8Array>(IDB_KEY);
  db = saved ? new SQL.Database(saved) : new SQL.Database();
  migrate(db);
  if (!saved) await persistNow();
  // Ask Safari not to evict our storage; harmless if refused.
  navigator.storage?.persist?.().catch(() => {});
}

function notify() {
  version++;
  listeners.forEach((l) => l());
}

async function persistNow() {
  await set(IDB_KEY, db.export());
}

// Persist right away (a closed tab must not lose the last edit), but coalesce
// bursts: while one save is in flight, at most one more is queued.
function schedulePersist() {
  if (persistQueued) return;
  persistQueued = true;
  persisting = persisting.then(() => {
    persistQueued = false;
    return persistNow();
  });
}

export function all<T>(sql: string, params: Params = []): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

export function one<T>(sql: string, params: Params = []): T | undefined {
  return all<T>(sql, params)[0];
}

export function run(sql: string, params: Params = []) {
  db.run(sql, params);
}

/** Runs `fn` in a transaction, then persists and tells the app the data changed. */
export function write<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    schedulePersist();
    notify();
    changeHooks.forEach((h) => h());
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function exportBytes(): Uint8Array {
  return db.export();
}

/** Replaces the whole local database, e.g. with a copy downloaded from Dropbox. */
export async function replaceDb(bytes: Uint8Array) {
  const next = new SQL.Database(bytes);
  migrate(next);
  db.close();
  db = next;
  await persistNow();
  notify();
}

export function isEmpty(): boolean {
  const row = one<{ n: number }>(
    "SELECT (SELECT COUNT(*) FROM dogs) + (SELECT COUNT(*) FROM procedures) + (SELECT COUNT(*) FROM brands) AS n",
  );
  return !row || row.n === 0;
}

/** Called after every local write; the sync layer uses it to schedule an upload. */
export function onLocalChange(hook: () => void) {
  changeHooks.add(hook);
  return () => changeHooks.delete(hook);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-renders the calling component whenever the database changes. */
export function useDbVersion() {
  return useSyncExternalStore(subscribe, () => version);
}
