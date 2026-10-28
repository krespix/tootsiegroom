import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { initial, pastelFor } from "../lib/format";
import { savePhoto, usePhotoUrl } from "../lib/photos";

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

/** Tap to pick or shoot a photo; it is compressed and stored, and its file name handed to `onChange`. */
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
  onChange: (name: string) => void;
}) {
  const url = usePhotoUrl(name);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`photo${url ? " filled" : ""}`}
      style={{ width, height, background: url ? undefined : tint }}
      onClick={() => input.current?.click()}
      aria-label={url ? `${label}: заменить фото` : label}
    >
      {url ? (
        <img src={url} alt={label} />
      ) : (
        <>
          <Icon name="camera" size={26} />
          {busy ? "Сохраняю…" : label}
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
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
    </button>
  );
}

/** Small read-only photo thumbnail. */
export function Thumb({ name, label, size = 72 }: { name: string | null; label: string; size?: number }) {
  const url = usePhotoUrl(name);
  if (!name) return null;
  return (
    <span className="photo filled" style={{ width: size, height: size, cursor: "default" }}>
      {url ? <img src={url} alt={label} /> : <span className="tiny">{label}</span>}
    </span>
  );
}

export function DurationFields({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return (
    <div className="row" style={{ flexWrap: "nowrap" }}>
      <label className="field" style={{ flex: 1 }}>
        Часы
        <input className="input" type="number" min={0} value={h} onChange={(e) => onChange(Math.max(0, +e.target.value) * 60 + m)} />
      </label>
      <label className="field" style={{ flex: 1 }}>
        Минуты
        <input className="input" type="number" min={0} max={55} step={5} value={m} onChange={(e) => onChange(h * 60 + Math.max(0, +e.target.value))} />
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

export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2200);
    return () => window.clearTimeout(t);
  }, [msg]);
  return [msg ? <Toast>{msg}</Toast> : null, setMsg];
}
