import { useSyncExternalStore } from "react";

// In-app replacements for window.prompt/confirm, which look out of place
// (especially in an iOS home-screen app). A single <DialogHost> renders them.

type Common = { title: string; text?: string; okText?: string; cancelText?: string; danger?: boolean };
export type TextRequest = Common & { kind: "text"; label?: string; initial?: string; placeholder?: string };
export type ConfirmRequest = Common & { kind: "confirm" };
export type DialogRequest = (TextRequest | ConfirmRequest) & { resolve: (value: string | boolean | null) => void };

let current: DialogRequest | null = null;
const listeners = new Set<() => void>();

function open(req: DialogRequest) {
  current?.resolve(current.kind === "text" ? null : false);
  current = req;
  listeners.forEach((l) => l());
}

export function closeDialog(value: string | boolean | null) {
  const req = current;
  current = null;
  listeners.forEach((l) => l());
  req?.resolve(value);
}

/** Resolves with the trimmed text, or null if cancelled or left empty. */
export function askText(opts: Omit<TextRequest, "kind">): Promise<string | null> {
  return new Promise((resolve) =>
    open({ ...opts, kind: "text", resolve: (v) => resolve(typeof v === "string" && v.trim() ? v.trim() : null) }),
  );
}

export function askConfirm(opts: Omit<ConfirmRequest, "kind">): Promise<boolean> {
  return new Promise((resolve) => open({ ...opts, kind: "confirm", resolve: (v) => resolve(v === true) }));
}

export function useDialogRequest() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
