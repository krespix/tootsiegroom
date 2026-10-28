import { del, get, set } from "idb-keyval";

// Public client id of the Dropbox app; PKCE needs no secret, so this is safe in the bundle.
export const DROPBOX_APP_KEY: string = import.meta.env.VITE_DROPBOX_APP_KEY ?? "";

const AUTH_KEY = "dropbox_auth";
const VERIFIER_KEY = "dropbox_verifier";

type Auth = { access_token: string; refresh_token: string; expires_at: number };

export type FileMeta = { rev: string; server_modified: string };

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Builds the Dropbox consent URL. We use the "no redirect" variant: Dropbox
 * shows a code that Natasha pastes back. Redirects are unreliable for
 * home-screen apps on iOS, which open external pages in a separate browser.
 */
export async function startAuth(): Promise<string> {
  // Reuse the pending verifier: iOS often reloads a home-screen app after a
  // trip to Safari, and a fresh verifier would orphan the code Dropbox showed.
  let verifier = await get<string>(VERIFIER_KEY);
  if (!verifier) {
    verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    await set(VERIFIER_KEY, verifier);
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const q = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: "code",
    code_challenge: b64url(new Uint8Array(digest)),
    code_challenge_method: "S256",
    token_access_type: "offline",
  });
  return `https://www.dropbox.com/oauth2/authorize?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ ...body, client_id: DROPBOX_APP_KEY }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (body.grant_type === "authorization_code" && text.includes("invalid_grant")) {
      throw new Error("Код не подошёл: он одноразовый и живёт несколько минут. Нажми «Открыть Dropbox» ещё раз и сразу вставь новый код.");
    }
    throw new Error(`Dropbox: ${res.status} ${text}`);
  }
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function finishAuth(code: string) {
  const verifier = await get<string>(VERIFIER_KEY);
  if (!verifier) throw new Error("Сначала нажми «Открыть Dropbox»");
  const j = await tokenRequest({ code: code.trim(), grant_type: "authorization_code", code_verifier: verifier });
  await set(AUTH_KEY, { access_token: j.access_token, refresh_token: j.refresh_token!, expires_at: Date.now() + (j.expires_in - 60) * 1000 });
  await del(VERIFIER_KEY);
}

export async function isConnected() {
  return !!(await get<Auth>(AUTH_KEY));
}

export async function disconnect() {
  await del(AUTH_KEY);
}

async function accessToken(forceRefresh = false): Promise<string> {
  const auth = await get<Auth>(AUTH_KEY);
  if (!auth) throw new Error("Dropbox не подключён");
  if (!forceRefresh && Date.now() < auth.expires_at) return auth.access_token;
  const j = await tokenRequest({ grant_type: "refresh_token", refresh_token: auth.refresh_token });
  const next = { ...auth, access_token: j.access_token, expires_at: Date.now() + (j.expires_in - 60) * 1000 };
  await set(AUTH_KEY, next);
  return next.access_token;
}

async function call(url: string, init: RequestInit): Promise<Response> {
  const go = async (force: boolean) =>
    fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${await accessToken(force)}` } });
  let res = await go(false);
  if (res.status === 401) res = await go(true);
  return res;
}

const isNotFound = async (res: Response) => res.status === 409 && (await res.clone().text()).includes("not_found");

export async function getMetadata(path: string): Promise<FileMeta | null> {
  const res = await call("https://api.dropboxapi.com/2/files/get_metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (await isNotFound(res)) return null;
  if (!res.ok) throw new Error(`Dropbox: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function upload(path: string, data: Blob | Uint8Array): Promise<FileMeta> {
  const res = await call("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }),
    },
    body: data instanceof Blob ? data : new Blob([data as BlobPart]),
  });
  if (!res.ok) throw new Error(`Dropbox: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function download(path: string): Promise<{ blob: Blob; meta: FileMeta } | null> {
  const res = await call("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: { "Dropbox-API-Arg": JSON.stringify({ path }) },
  });
  if (await isNotFound(res)) return null;
  if (!res.ok) throw new Error(`Dropbox: ${res.status} ${await res.text()}`);
  const meta = JSON.parse(res.headers.get("Dropbox-API-Result") ?? "{}") as FileMeta;
  return { blob: await res.blob(), meta };
}
