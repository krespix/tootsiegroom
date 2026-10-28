import { get, set } from "idb-keyval";
import { useSyncExternalStore } from "react";
import { exportBytes, isEmpty, onLocalChange, replaceDb } from "../db/db";
import * as dropbox from "./dropbox";

// Whole-database sync: the SQLite file is uploaded after local changes and
// downloaded when Dropbox has a newer copy. One user, so no merging —
// the most recent write wins.

const DB_PATH = "/tootsie.db";
const META_KEY = "sync_meta";
const PHOTO_QUEUE_KEY = "photo_queue";

type Meta = { rev: string | null; dirty: boolean; dirtySince: number | null };

export type SyncState = {
  connected: boolean;
  status: "off" | "idle" | "syncing" | "offline" | "error";
  lastSyncAt: number | null;
  error: string | null;
};

let state: SyncState = { connected: false, status: "off", lastSyncAt: null, error: null };
let meta: Meta = { rev: null, dirty: false, dirtySince: null };
let changeCounter = 0;
let pushTimer: number | undefined;
let running: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function saveMeta() {
  await set(META_KEY, meta);
}

export async function initSync() {
  meta = (await get<Meta>(META_KEY)) ?? meta;
  const connected = await dropbox.isConnected();
  setState({ connected, status: connected ? "idle" : "off" });

  onLocalChange(() => {
    changeCounter++;
    if (!meta.dirty) meta = { ...meta, dirty: true, dirtySince: Date.now() };
    void saveMeta();
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => void syncNow(), 1500);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  window.addEventListener("online", () => void syncNow());

  if (connected) await syncNow();
}

/** Runs one sync pass; calls are queued so passes never overlap. */
export function syncNow(): Promise<void> {
  running = running.then(doSync, doSync);
  return running;
}

async function doSync() {
  if (!state.connected) return;
  if (!navigator.onLine) return setState({ status: "offline" });
  setState({ status: "syncing", error: null });
  try {
    const remote = await dropbox.getMetadata(DB_PATH);
    if (!remote) {
      await push();
    } else if (remote.rev !== meta.rev) {
      const localIsNewer = meta.dirty && meta.rev !== null && (meta.dirtySince ?? 0) > Date.parse(remote.server_modified);
      if (localIsNewer) await push();
      else if (meta.rev === null && !isEmpty() && !confirmFirstDownload()) await push();
      else await pull();
    } else if (meta.dirty) {
      await push();
    }
    await flushPhotos();
    setState({ status: "idle", lastSyncAt: Date.now() });
  } catch (e) {
    setState({ status: navigator.onLine ? "error" : "offline", error: e instanceof Error ? e.message : String(e) });
  }
}

function confirmFirstDownload() {
  return window.confirm(
    "В Dropbox уже есть база TootsieGroom.\n\nОК — загрузить её (то, что введено на этом устройстве, заменится).\nОтмена — заменить базу в Dropbox данными с этого устройства.",
  );
}

async function push() {
  const counterAtStart = changeCounter;
  const res = await dropbox.upload(DB_PATH, exportBytes());
  meta = changeCounter === counterAtStart ? { rev: res.rev, dirty: false, dirtySince: null } : { ...meta, rev: res.rev };
  await saveMeta();
}

async function pull() {
  const file = await dropbox.download(DB_PATH);
  if (!file) return;
  await replaceDb(new Uint8Array(await file.blob.arrayBuffer()));
  meta = { rev: file.meta.rev, dirty: false, dirtySince: null };
  await saveMeta();
}

// ---------- photos ----------

export async function queuePhotoUpload(name: string) {
  const q = (await get<string[]>(PHOTO_QUEUE_KEY)) ?? [];
  await set(PHOTO_QUEUE_KEY, [...q, name]);
}

async function flushPhotos() {
  const q = (await get<string[]>(PHOTO_QUEUE_KEY)) ?? [];
  for (const name of q) {
    const blob = await get<Blob>(`photo:${name}`);
    if (blob) await dropbox.upload(`/photos/${name}`, blob);
    const rest = ((await get<string[]>(PHOTO_QUEUE_KEY)) ?? []).filter((n) => n !== name);
    await set(PHOTO_QUEUE_KEY, rest);
  }
}

/** Fetches a photo taken on the other device and caches it locally. */
export async function fetchRemotePhoto(name: string): Promise<Blob | null> {
  if (!state.connected || !navigator.onLine) return null;
  const file = await dropbox.download(`/photos/${name}`);
  if (!file) return null;
  await set(`photo:${name}`, file.blob);
  return file.blob;
}

// ---------- connection ----------

export async function connectDropbox(code: string) {
  await dropbox.finishAuth(code);
  setState({ connected: true, status: "idle" });
  await syncNow();
}

export async function disconnectDropbox() {
  await dropbox.disconnect();
  meta = { rev: null, dirty: false, dirtySince: null };
  await saveMeta();
  setState({ connected: false, status: "off", lastSyncAt: null, error: null });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSyncState() {
  return useSyncExternalStore(subscribe, () => state);
}
