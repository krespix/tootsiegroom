import { useId, useState, type ReactNode } from "react";
import type { Owner, OwnerInput } from "../db/repo";
import { Icon } from "./Icon";

export type Option = { key: string; label: string; hint?: string };

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Text input with a dropdown of matching suggestions. Typing a new value is
 * always allowed; picking a suggestion calls `onPick` with it.
 */
export function Suggest({
  value,
  onChange,
  onPick,
  onEnter,
  options,
  placeholder,
  label,
  inputMode,
  type = "text",
  showAllOnFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (o: Option) => void;
  onEnter?: () => void;
  options: Option[];
  placeholder?: string;
  label?: ReactNode;
  inputMode?: "text" | "tel";
  type?: string;
  showAllOnFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const q = norm(value);
  const matches = options
    .filter((o) => (q ? norm(o.label).includes(q) || norm(o.hint ?? "").includes(q) : showAllOnFocus))
    .filter((o) => norm(o.label) !== q)
    .slice(0, 8);
  const show = open && matches.length > 0;

  return (
    <label className="field" style={{ position: "relative" }}>
      {label}
      <input
        className="input"
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      {show && (
        <div className="suggest" id={listId} role="listbox">
          {matches.map((o) => (
            <button
              key={o.key}
              type="button"
              role="option"
              aria-selected={false}
              className="suggest-item"
              // Keep focus in the input so the list doesn't vanish before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(o);
                setOpen(false);
              }}
            >
              <span className="bold">{o.label}</span>
              {o.hint && <span className="tiny bold muted">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

/** Chips for chosen tags plus an input that suggests existing tags or creates a new one. */
export function TagEditor({ value, onChange, all }: { value: string[]; onChange: (v: string[]) => void; all: string[] }) {
  const [text, setText] = useState("");
  const has = (name: string) => value.some((v) => norm(v) === norm(name));
  const add = (name: string) => {
    const n = name.trim();
    if (n && !has(n)) onChange([...value, all.find((a) => norm(a) === norm(n)) ?? n]);
    setText("");
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      {value.length > 0 && (
        <div className="row" style={{ gap: 8 }}>
          {value.map((t) => (
            <span key={t} className="chip on" style={{ paddingRight: 4 }}>
              {t}
              <button
                type="button"
                className="btn icon"
                style={{ width: 28, minHeight: 28, borderRadius: 999, border: 0, background: "transparent" }}
                aria-label={`Убрать ${t}`}
                onClick={() => onChange(value.filter((v) => v !== t))}
              >
                <Icon name="x" size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="row" style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Suggest
            value={text}
            onChange={setText}
            onPick={(o) => add(o.label)}
            onEnter={() => add(text)}
            options={all.filter((t) => !has(t)).map((t) => ({ key: t, label: t }))}
            placeholder="Например, боится фена"
            showAllOnFocus
          />
        </div>
        <button type="button" className="btn" style={{ minHeight: 48 }} disabled={!text.trim()} onClick={() => add(text)}>
          Добавить
        </button>
      </div>
    </div>
  );
}

type KnownOwner = Owner & { dogs: string };

function ownerOptions(known: KnownOwner[], taken: Set<string>): Option[] {
  return known
    .filter((o) => !taken.has(o.id))
    .map((o) => ({ key: o.id, label: o.name || o.phone, hint: [o.phone, o.dogs && `собаки: ${o.dogs}`].filter(Boolean).join(" · ") }));
}

export const emptyOwner = (): OwnerInput => ({ name: "", phone: "", telegram: "" });

/** One owner's fields; name and phone suggest people already in the book. */
export function OwnerFields({
  owner,
  onChange,
  known,
  taken,
  compact = false,
}: {
  owner: OwnerInput;
  onChange: (o: OwnerInput) => void;
  known: KnownOwner[];
  taken: Set<string>;
  compact?: boolean;
}) {
  const options = ownerOptions(known, taken);
  const pick = (o: Option) => {
    const k = known.find((x) => x.id === o.key);
    if (k) onChange({ id: k.id, name: k.name, phone: k.phone, telegram: k.telegram });
  };
  const linked = owner.id ? known.find((k) => k.id === owner.id) : undefined;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Suggest
        label="Имя"
        value={owner.name}
        onChange={(name) => onChange({ ...owner, name })}
        onPick={pick}
        options={options}
        placeholder="Начни вводить — подскажу знакомых"
      />
      <Suggest
        label="Телефон"
        type="tel"
        inputMode="tel"
        value={owner.phone}
        onChange={(phone) => onChange({ ...owner, phone })}
        onPick={pick}
        options={options}
      />
      {!compact && (
        <label className="field">
          Telegram
          <input className="input" value={owner.telegram} placeholder="@username" onChange={(e) => onChange({ ...owner, telegram: e.target.value })} />
        </label>
      )}
      {linked && (
        <p className="tiny bold muted">
          Уже есть в базе{linked.dogs ? ` (собаки: ${linked.dogs})` : ""}. Изменения применятся ко всем его собакам.{" "}
          <button type="button" className="btn link tiny" style={{ minHeight: 0, padding: 0 }} onClick={() => onChange({ ...emptyOwner() })}>
            Это другой человек
          </button>
        </p>
      )}
    </div>
  );
}

export function OwnersEditor({ value, onChange, known }: { value: OwnerInput[]; onChange: (v: OwnerInput[]) => void; known: KnownOwner[] }) {
  const list = value.length ? value : [emptyOwner()];
  const set = (i: number, o: OwnerInput) => onChange(list.map((x, j) => (j === i ? o : x)));
  return (
    <div className="stack" style={{ gap: 16 }}>
      {list.map((o, i) => {
        const taken = new Set(list.filter((_, j) => j !== i).map((x) => x.id).filter((x): x is string => !!x));
        return (
          <div key={i} className="stack" style={{ gap: 10, ...(i > 0 ? { paddingTop: 16, borderTop: "1px solid var(--line-soft)" } : {}) }}>
            {list.length > 1 && (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="label-caps">Хозяин {i + 1}</span>
                <button type="button" className="btn link danger small" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                  Убрать
                </button>
              </div>
            )}
            <OwnerFields owner={o} onChange={(x) => set(i, x)} known={known} taken={taken} />
          </div>
        );
      })}
      <button type="button" className="btn dashed" onClick={() => onChange([...list, emptyOwner()])}>
        + Ещё хозяин
      </button>
    </div>
  );
}
