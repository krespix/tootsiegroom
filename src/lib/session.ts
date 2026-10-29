import { useSyncExternalStore } from "react";

/**
 * Tracks when the app was last in use, so features can react to "came back after
 * a while": the splash (6 hours) and the earnings paws (3 hours).
 */
const KEY = "lastActive";
const PAWS_AWAY_MS = 3 * 3_600_000;

const read = () => {
  try {
    return Number(localStorage.getItem(KEY) ?? 0);
  } catch {
    return 0;
  }
};
const touch = () => {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage unavailable: everything just treats each open as a return
  }
};

/** The installed home-screen app, where a fresh page load means it was closed and opened again. */
export const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/** Joke-tier paws already shown per day are remembered so they fire once per return. */
function forgetPaws() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("fx:joke:")) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}

// How long the app was away before the current open. A closed-and-reopened installed app counts as long away.
let state = { round: 0, away: installed() ? Infinity : Date.now() - read() };
if (state.away > PAWS_AWAY_MS) forgetPaws();
touch();

const listeners = new Set<() => void>();
window.setInterval(touch, 60_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") return touch();
  const away = Date.now() - read();
  if (away > PAWS_AWAY_MS) forgetPaws();
  state = { round: state.round + 1, away };
  touch();
  listeners.forEach((l) => l());
});

/** `round` changes each time the app comes back to the foreground; `away` is how long it was gone. */
export function useReturn() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
