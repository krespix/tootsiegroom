import { useId, useState, type ReactNode } from "react";
import type { Contact, Owner, OwnerInput } from "../db/repo";
import { CONTACT_KINDS, contactLabel, kindMeta } from "../lib/contacts";
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
    .map((o) => ({
      key: o.id,
      label: o.name || (o.contacts[0] ? contactLabel(o.contacts[0]) : "Без имени"),
      hint: [...o.contacts.map(contactLabel), o.dogs && `собаки: ${o.dogs}`].filter(Boolean).join(" · "),
    }));
}

export const emptyOwner = (): OwnerInput => ({ name: "", contacts: [] });

/** Contacts start empty; "+ Контакт" asks for a type, then adds a field for it. */
function ContactsEditor({ value, onChange }: { value: Contact[]; onChange: (v: Contact[]) => void }) {
  const [choosing, setChoosing] = useState(false);
  const set = (i: number, c: Contact) => onChange(value.map((x, j) => (j === i ? c : x)));
  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.map((c, i) => {
        const meta = kindMeta(c.kind);
        return (
          <div key={i} className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
            <span className="avatar" style={{ width: 40, height: 40, background: "var(--bg)", borderRadius: 12 }} title={meta.label}>
              <Icon name={meta.icon} size={18} />
            </span>
            <input
              className="input"
              aria-label={meta.label}
              type={c.kind === "phone" ? "tel" : "text"}
              inputMode={meta.inputMode}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={meta.placeholder}
              value={c.value}
              autoFocus={!c.value}
              onChange={(e) => set(i, { ...c, value: e.target.value })}
            />
            <button
              type="button"
              className="btn icon danger"
              style={{ flex: "none" }}
              aria-label={`Удалить ${meta.label}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        );
      })}
      {choosing ? (
        <div className="row" style={{ gap: 8 }} role="group" aria-label="Тип контакта">
          {CONTACT_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              className="chip"
              style={{ minHeight: 44 }}
              onClick={() => {
                onChange([...value, { kind: k.kind, value: "" }]);
                setChoosing(false);
              }}
            >
              <Icon name={k.icon} size={16} /> {k.label}
            </button>
          ))}
          <button type="button" className="btn link small" onClick={() => setChoosing(false)}>
            Отмена
          </button>
        </div>
      ) : (
        <button type="button" className="btn dashed" style={{ alignSelf: "flex-start" }} onClick={() => setChoosing(true)}>
          + Контакт
        </button>
      )}
    </div>
  );
}

/** One owner: name (suggests people already in the book, by name or contact) and contacts. */
export function OwnerFields({
  owner,
  onChange,
  known,
  taken,
}: {
  owner: OwnerInput;
  onChange: (o: OwnerInput) => void;
  known: KnownOwner[];
  taken: Set<string>;
}) {
  const pick = (o: Option) => {
    const k = known.find((x) => x.id === o.key);
    if (k) onChange({ id: k.id, name: k.name, contacts: k.contacts });
  };
  const linked = owner.id ? known.find((k) => k.id === owner.id) : undefined;
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Suggest
        label="Имя"
        value={owner.name}
        onChange={(name) => onChange({ ...owner, name })}
        onPick={pick}
        options={ownerOptions(known, taken)}
        placeholder="Начни вводить — подскажу знакомых"
      />
      <ContactsEditor value={owner.contacts} onChange={(contacts) => onChange({ ...owner, contacts })} />
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
