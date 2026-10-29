import { useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";
import { askConfirm } from "../lib/dialog";
import { initial, pastelFor } from "../lib/format";
import { savePhoto, usePhotoUrl } from "../lib/photos";
import { fxEnabled } from "../lib/fx";

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export const useDesktop = () => useMedia("(min-width: 900px)");

export function Avatar({ id, name, photo, size = 44 }: { id: string; name: string; photo?: string | null; size?: number }) {
  const url = usePhotoUrl(photo);
  return (
    <span className="avatar" style={{ width: size, height: size, background: pastelFor(id), fontSize: size * 0.4 }}>
      {url ? <img src={url} alt="" /> : initial(name)}
    </span>
  );
}

/** Full-screen photo with optional actions; closes on backdrop tap or Esc. */
function PhotoViewer({ url, label, onClose, children }: { url: string; label: string; onClose: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="viewer"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <img src={url} alt={label} />
      <div className="row" style={{ justifyContent: "center" }}>
        {children}
        <button type="button" className="btn" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </dialog>
  );
}

/**
 * Empty: tap to pick or shoot a photo (compressed, stored, file name handed to `onChange`).
 * Filled: tap to view it large, with "Заменить" and "Удалить".
 */
export function PhotoSlot({
  name,
  label,
  tint = "#FFF4D6",
  width = 140,
  height = 140,
  onChange,
}: {
  name: string | null;
  label: string;
  tint?: string;
  width?: number | string;
  height?: number;
  onChange: (name: string | null) => void;
}) {
  const url = usePhotoUrl(name);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`photo${url ? " filled" : ""}`}
        style={{ width, height, background: url ? undefined : tint }}
        onClick={() => (url ? setViewing(true) : input.current?.click())}
        aria-label={url ? `${label}: открыть` : label}
      >
        {url ? (
          <img src={url} alt={label} />
        ) : (
          <>
            <Icon name="camera" size={26} />
            {busy ? "Сохраняю…" : label}
          </>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onChange(await savePhoto(file));
          } finally {
            setBusy(false);
          }
        }}
      />
      {viewing && url && (
        <PhotoViewer url={url} label={label} onClose={() => setViewing(false)}>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setViewing(false);
              input.current?.click();
            }}
          >
            <Icon name="camera" size={18} /> Заменить
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={async () => {
              const ok = await askConfirm({ title: "Удалить фото?", okText: "Удалить", danger: true });
              if (ok) {
                setViewing(false);
                onChange(null);
              }
            }}
          >
            Удалить
          </button>
        </PhotoViewer>
      )}
    </>
  );
}

/** Small photo thumbnail; tap to view it large. */
export function Thumb({ name, label, size = 72 }: { name: string | null; label: string; size?: number }) {
  const url = usePhotoUrl(name);
  const [viewing, setViewing] = useState(false);
  if (!name) return null;
  return (
    <>
      <button type="button" className="photo filled" style={{ width: size, height: size }} onClick={() => url && setViewing(true)} aria-label={`${label}: открыть`}>
        {url ? <img src={url} alt={label} /> : <span className="tiny">{label}</span>}
      </button>
      {viewing && url && <PhotoViewer url={url} label={label} onClose={() => setViewing(false)} />}
    </>
  );
}

/**
 * Number input that can be cleared while typing (a controlled numeric value
 * would snap an emptied field back to "0"). Empty counts as 0; focus selects
 * the whole value so a new number replaces it.
 */
export function NumberInput({
  value,
  onChange,
  ...rest
}: { value: number; onChange: (n: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((t) => (Number(t || 0) === value ? t : String(value)));
  }, [value]);
  return (
    <input
      className="input"
      type="number"
      inputMode="decimal"
      {...rest}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value === "" ? 0 : Math.max(0, Number(e.target.value)));
      }}
    />
  );
}

export function DurationFields({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <div className="row" style={{ flexWrap: "nowrap" }}>
      <label className="field" style={{ flex: 1 }}>
        Часы
        <NumberInput inputMode="numeric" min={0} value={h} onChange={(n) => onChange(Math.floor(n) * 60 + m)} />
      </label>
      <label className="field" style={{ flex: 1 }}>
        Минуты
        <NumberInput inputMode="numeric" min={0} max={59} step={5} value={m} onChange={(n) => onChange(h * 60 + Math.floor(n))} />
      </label>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <Icon name="search" size={18} />
      <span className="sr-only">Поиск</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Toast({ children }: { children: ReactNode }) {
  return (
    <div className="toast" role="status">
      {children}
    </div>
  );
}

export function useToast(): [ReactNode, (msg: ReactNode) => void] {
  const [msg, setMsg] = useState<ReactNode>(null);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2200);
    return () => window.clearTimeout(t);
  }, [msg]);
  return [msg ? <Toast>{msg}</Toast> : null, setMsg];
}

/** Wrapper for a form opened in place (phone): scrolls so the tapped item sits on top with the form under it. */
export function InlinePanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const anchor = el?.previousElementSibling ?? el;
    if (anchor instanceof HTMLElement) anchor.style.scrollMarginTop = "16px";
    anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}

/** Current local time, refreshed every minute so time-dependent views stay correct while open. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    const wake = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", wake);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);
  return now;
}

/** App-wide toast that survives navigation, e.g. "saved" after a form closes. */
let showFlash: ((msg: ReactNode) => void) | null = null;
/** `ok` adds a check mark that draws itself, for "done" moments. */
export const flash = (msg: string, ok = false) =>
  showFlash?.(
    ok ? (
      <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
        <CheckMark animate />
        {msg}
      </span>
    ) : (
      msg
    ),
  );

export function CheckMark({ animate = false, size = 16 }: { animate?: boolean; size?: number }) {
  return (
    <svg className={`check-mark${animate ? " draw" : ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function FlashHost() {
  const [toast, show] = useToast();
  useEffect(() => {
    showFlash = show;
    return () => {
      showFlash = null;
    };
  }, [show]);
  return toast;
}

/** A number that counts up to `value` when it appears or changes. */
export function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(() => (fxEnabled() ? 0 : value));
  const current = useRef(shown);
  useEffect(() => {
    if (!fxEnabled()) {
      current.current = value;
      setShown(value);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const v = from + (value - from) * (1 - Math.pow(1 - k, 3));
      current.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Renders a count-up number through `format`. */
export function CountUp({ value, format = (n) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  return <>{format(useCountUp(value))}</>;
}
