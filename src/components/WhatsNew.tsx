import { useEffect, useRef, useState } from "react";
import { CHANGES } from "../lib/changelog";
import { isEmpty } from "../db/db";

const KEY = "seenChanges";

const seen = () => {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) return Number(v);
    // A brand-new install has nothing to compare with: start from the current list.
    if (isEmpty()) {
      localStorage.setItem(KEY, String(CHANGES[0].id));
      return CHANGES[0].id;
    }
    return 0;
  } catch {
    return Number.MAX_SAFE_INTEGER; // no storage: don't nag on every open
  }
};

/** After an update, lists what changed since the last time — once. */
export function WhatsNew() {
  const ref = useRef<HTMLDialogElement>(null);
  // Someone who never saw the list gets only the latest release; the rest is in settings.
  const [fresh] = useState(() => {
    const last = seen();
    return last === 0 ? CHANGES.slice(0, 1) : CHANGES.filter((c) => c.id > last);
  });

  useEffect(() => {
    if (!fresh.length) return;
    // Wait for the splash so the two don't stack.
    const t = window.setInterval(() => {
      if (document.querySelector(".splash, #boot")) return;
      window.clearInterval(t);
      ref.current?.showModal();
    }, 300);
    return () => window.clearInterval(t);
  }, [fresh]);

  if (!fresh.length) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, String(CHANGES[0].id));
    } catch {
      // ignore
    }
    ref.current?.close();
  };
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="whats-new" onCancel={close}>
      <div className="stack" style={{ gap: 14 }}>
        <h2 id="whats-new">Что нового</h2>
        {fresh.map((c) => (
          <div key={c.id} className="stack" style={{ gap: 8 }}>
            <span className="bold">
              {c.title} · {c.date}
            </span>
            <ul className="whats-new">
              {c.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
        <p className="small muted bold">Вся история обновлений — внизу настроек.</p>
        <button className="btn primary" onClick={close}>
          Понятно
        </button>
      </div>
    </dialog>
  );
}
