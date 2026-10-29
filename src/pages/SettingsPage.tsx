import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { exportBytes, replaceDb, useDbVersion, write } from "../db/db";
import { DEFAULT_WORK_HOURS, getSetting, setSetting, setWorkHours, workHours } from "../db/repo";
import { DEFAULT_REMIND_TEMPLATE, REMIND_FIELDS, REMIND_TEMPLATE_KEY, fillTemplate } from "../lib/remind";
import { DEFAULT_JOKES, fxOn, greetName, greeting, jokes, jokesOn, type Joke } from "../lib/prefs";
import { toDateKey } from "../lib/dates";
import { bytesLabel, plural } from "../lib/format";
import { localPhotoUsage } from "../lib/photos";
import { badgeOn, badgeSupported, isAndroid, updateBadge } from "../lib/badge";
import { installed } from "../lib/session";
import { CHANGES } from "../lib/changelog";
import { askConfirm } from "../lib/dialog";
import { DROPBOX_APP_KEY, folderUsage, startAuth } from "../sync/dropbox";
import { connectDropbox, disconnectDropbox, syncNow, useSyncState } from "../sync/sync";
import { SyncLabel } from "../components/Layout";
import { NumberInput, useToast } from "../components/common";
import { Icon } from "../components/Icon";

function DropboxSection() {
  const sync = useSyncState();
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prepared ahead of time: Safari blocks pop-ups opened after an await.
  useEffect(() => {
    if (!sync.connected && DROPBOX_APP_KEY) void startAuth().then(setAuthUrl);
  }, [sync.connected]);

  if (!DROPBOX_APP_KEY) {
    return <p className="bold" style={{ color: "var(--danger)" }}>Ключ Dropbox не задан при сборке (VITE_DROPBOX_APP_KEY).</p>;
  }

  if (sync.connected) {
    return (
      <>
        <SyncLabel />
        {sync.error && <p className="small bold" style={{ color: "var(--danger)" }}>{sync.error}</p>}
        <div className="row">
          <button className="btn primary" onClick={() => void syncNow()} disabled={sync.status === "syncing"}>
            Синхронизировать сейчас
          </button>
          <button
            className="btn danger"
            onClick={async () => {
              const ok = await askConfirm({
                title: "Отключить Dropbox?",
                text: "Только на этом устройстве. Данные здесь и в Dropbox останутся.",
                okText: "Отключить",
                danger: true,
              });
              if (ok) void disconnectDropbox();
            }}
          >
            Отключить
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
        <li>
          <a className="btn primary" href={authUrl ?? undefined} target="_blank" rel="noreferrer" aria-disabled={!authUrl}>
            Открыть Dropbox
          </a>
          <p className="small muted bold" style={{ marginTop: 6 }}>
            Войди в Dropbox и нажми «Разрешить». Dropbox покажет код — скопируй его.
          </p>
        </li>
        <li>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "1 1 240px" }}>
              Код из Dropbox
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
            </label>
            <button
              className="btn primary"
              style={{ minHeight: 48 }}
              disabled={!code.trim() || busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await connectDropbox(code);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Подключить
            </button>
          </div>
        </li>
      </ol>
      {error && <p className="small bold" style={{ color: "var(--danger)" }}>{error}</p>}
    </>
  );
}

/** Which settings blocks are open is a per-device convenience. */
const openKey = (id: string) => `settings-open:${id}`;
const readOpen = (id: string) => {
  try {
    return localStorage.getItem(openKey(id)) === "1";
  } catch {
    return false;
  }
};

/** A settings block that folds to its title and a one-line hint of what is inside. */
function Card({ id, title, hint, children }: { id: string; title: string; hint?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(() => readOpen(id));
  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(openKey(id), open ? "0" : "1");
    } catch {
      // remembering is optional
    }
  };
  return (
    <section className={`card fold${open ? " open" : ""}`} id={id}>
      <h2>
        <button type="button" className="fold-head" aria-expanded={open} onClick={toggle}>
          <span className="fold-title">
            {title}
            {!open && hint && <span className="fold-hint">{hint}</span>}
          </span>
          <Icon name="right" size={18} />
        </button>
      </h2>
      {open && children}
    </section>
  );
}

function WorkHoursCard() {
  useDbVersion();
  const saved = workHours();
  const [start, setStart] = useState(saved.start);
  const [end, setEnd] = useState(saved.end);
  const valid = !!start && !!end && start < end;
  const save = (h: { start: string; end: string }) => {
    if (h.start && h.end && h.start < h.end) setWorkHours(h);
  };
  return (
    <Card id="work" title="Рабочий день" hint={`${saved.start}–${saved.end}`}>
      <p className="small muted bold">Календарь показывает свободные окна в эти часы, а новая запись на пустой день начинается с начала рабочего дня.</p>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <label className="field" style={{ flex: "1 1 120px" }}>
          С
          <input
            className="input"
            type="time"
            step={1800}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              save({ start: e.target.value, end });
            }}
          />
        </label>
        <label className="field" style={{ flex: "1 1 120px" }}>
          До
          <input
            className="input"
            type="time"
            step={1800}
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              save({ start, end: e.target.value });
            }}
          />
        </label>
        {(saved.start !== DEFAULT_WORK_HOURS.start || saved.end !== DEFAULT_WORK_HOURS.end) && (
          <button
            className="btn link"
            onClick={() => {
              setStart(DEFAULT_WORK_HOURS.start);
              setEnd(DEFAULT_WORK_HOURS.end);
              setWorkHours(DEFAULT_WORK_HOURS);
            }}
          >
            Вернуть 11:00–20:00
          </button>
        )}
      </div>
      {!valid && <p className="small bold" style={{ color: "var(--danger)" }}>Конец рабочего дня должен быть позже начала</p>}
    </Card>
  );
}

function RemindTemplateCard() {
  useDbVersion();
  const saved = getSetting(REMIND_TEMPLATE_KEY) ?? DEFAULT_REMIND_TEMPLATE;
  const [text, setText] = useState(saved);
  const area = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  // Put the caret after an inserted field once React has rendered the new text.
  useLayoutEffect(() => {
    if (caret.current === null) return;
    area.current?.focus();
    area.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);
  const save = (v: string) => setSetting(REMIND_TEMPLATE_KEY, v.trim() && v.trim() !== DEFAULT_REMIND_TEMPLATE ? v.trim() : null);
  const insert = (field: string) => {
    const el = area.current;
    const at = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const next = text.slice(0, at) + field + text.slice(end);
    caret.current = at + field.length;
    setText(next);
    save(next);
  };
  const example = fillTemplate(text || DEFAULT_REMIND_TEMPLATE, { owner: "Ольга", dog: "Тутси", when: "завтра", time: "11:00", procedure: "комплекс (мини)" });

  return (
    <Card id="remind" title="Напоминание хозяину" hint={saved.length > 42 ? `${saved.slice(0, 42)}…` : saved}>
      <p className="small muted bold">Этот текст копируется кнопкой «Напомнить хозяину». Слова в фигурных скобках заменятся на данные записи.</p>
      <label className="field">
        Шаблон
        <textarea ref={area} className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => save(text)} />
      </label>
      <div className="row" style={{ gap: 6 }} role="group" aria-label="Вставить">
        {REMIND_FIELDS.map((f) => (
          <button key={f} type="button" className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="stack" style={{ gap: 4, padding: "12px 14px", borderRadius: 14, background: "var(--bg)" }}>
        <span className="tiny bold muted">Как получится</span>
        <span className="small">{example}</span>
      </div>
      {text.trim() !== DEFAULT_REMIND_TEMPLATE && (
        <button
          className="btn link"
          style={{ alignSelf: "flex-start" }}
          onClick={() => {
            setText(DEFAULT_REMIND_TEMPLATE);
            save(DEFAULT_REMIND_TEMPLATE);
          }}
        >
          Вернуть исходный текст
        </button>
      )}
    </Card>
  );
}

function LookCard() {
  useDbVersion();
  const [name, setName] = useState(greetName());
  const animate = fxOn();
  return (
    <Card id="look" title="Приветствие и анимации" hint={`${greetName() || "без имени"} · анимации ${animate ? "включены" : "выключены"}`}>
      <label className="field">
        Имя для приветствия
        <input className="input" value={name} placeholder="Например, Наташа" onChange={(e) => setName(e.target.value)} onBlur={() => setSetting("greet_name", name.trim() || null)} />
      </label>
      <p className="small muted bold">На главном экране: «{greeting(new Date(), name)}»</p>
      <label className="row bold" style={{ gap: 10, flexWrap: "nowrap", cursor: "pointer" }}>
        <input type="checkbox" checked={animate} onChange={(e) => setSetting("fx_off", e.target.checked ? null : "1")} style={{ width: 22, height: 22, accentColor: "var(--pink)" }} />
        Лапки и анимации
      </label>
    </Card>
  );
}

function JokesCard() {
  useDbVersion();
  const [list, setList] = useState<Joke[]>(() => jokes());
  const on = jokesOn();
  const isDefault = JSON.stringify(list) === JSON.stringify(DEFAULT_JOKES);
  const save = (next: Joke[]) => {
    setList(next);
    const same = JSON.stringify(next) === JSON.stringify(DEFAULT_JOKES);
    setSetting("jokes", same ? null : JSON.stringify(next));
  };
  const patch = (i: number, p: Partial<Joke>) => save(list.map((j, k) => (k === i ? { ...j, ...p } : j)));

  return (
    <Card id="jokes" title="Шутки про заработок" hint={on ? `${list.length} ${plural(list.length, "шутка", "шутки", "шуток")}` : "выключены"}>
      <label className="row bold" style={{ gap: 10, flexWrap: "nowrap", cursor: "pointer" }}>
        <input type="checkbox" checked={on} onChange={(e) => setSetting("jokes_off", e.target.checked ? null : "1")} style={{ width: 22, height: 22, accentColor: "var(--pink)" }} />
        Показывать шутки
      </label>
      {on && (
        <>
          <p className="small muted bold">Показывается одна шутка — с самым большим порогом, который уже заработан за день.</p>
          {list.map((j, i) => (
            <div key={i} className="stack" style={{ gap: 8, padding: 12, borderRadius: 14, background: "var(--bg)" }}>
              <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-end" }}>
                <label className="field" style={{ flex: "0 1 140px" }}>
                  От, ₾
                  <NumberInput min={0} value={j.min} onChange={(min) => patch(i, { min })} />
                </label>
                <button type="button" className="btn link danger" style={{ marginLeft: "auto" }} onClick={() => save(list.filter((_, k) => k !== i))}>
                  Убрать
                </button>
              </div>
              <label className="field">
                Текст
                <textarea className="input" rows={2} value={j.text} onChange={(e) => setList(list.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} onBlur={() => save(list)} />
              </label>
            </div>
          ))}
          <div className="row">
            <button type="button" className="btn dashed" onClick={() => save([...list, { min: (Math.max(0, ...list.map((j) => j.min)) || 0) + 100, text: "" }])}>
              + Шутка
            </button>
            {!isDefault && (
              <button type="button" className="btn link" onClick={() => save(DEFAULT_JOKES)}>
                Вернуть исходные
              </button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

const DROPBOX_FREE = 2 * 1024 ** 3;

function StorageCard() {
  const sync = useSyncState();
  const [local, setLocal] = useState<{ files: number; bytes: number } | null>(null);
  const [cloud, setCloud] = useState<{ files: number; bytes: number } | "error" | null>(null);
  const dbBytes = exportBytes().length;

  useEffect(() => {
    void localPhotoUsage().then(setLocal);
  }, []);
  useEffect(() => {
    if (!sync.connected) return;
    folderUsage()
      .then(setCloud)
      .catch(() => setCloud("error"));
  }, [sync.connected]);

  return (
    <Card id="storage" title="Место" hint={`база ${bytesLabel(dbBytes)}${local ? ` · фото ${bytesLabel(local.bytes)}` : ""}`}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="row bold" style={{ justifyContent: "space-between" }}>
          <span>База</span>
          <span>{bytesLabel(dbBytes)}</span>
        </span>
        <span className="row bold" style={{ justifyContent: "space-between" }}>
          <span>Фото на этом устройстве</span>
          <span>{local ? `${local.files} ${plural(local.files, "фото", "фото", "фото")} · ${bytesLabel(local.bytes)}` : "считаю…"}</span>
        </span>
        {sync.connected && (
          <span className="row bold" style={{ justifyContent: "space-between" }}>
            <span>В Dropbox</span>
            <span>
              {cloud === null ? "считаю…" : cloud === "error" ? "не удалось посчитать" : `${bytesLabel(cloud.bytes)} из 2 ГБ`}
            </span>
          </span>
        )}
      </div>
      {sync.connected && cloud && cloud !== "error" && (
        <>
          <span className="st-track" aria-hidden="true">
            <span className="st-fill" style={{ width: `${Math.max(1, (cloud.bytes / DROPBOX_FREE) * 100)}%` }} />
          </span>
          <p className="small muted bold">
            Бесплатного Dropbox хватит ещё примерно на {Math.max(0, Math.floor((DROPBOX_FREE - cloud.bytes) / (250 * 1024))).toLocaleString("ru-RU")} фото (по ~250 КБ).
          </p>
        </>
      )}
    </Card>
  );
}

function BadgeCard() {
  useDbVersion();
  if (isAndroid()) return null; // Android launchers ignore web app badges
  const [permission, setPermission] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"));
  if (!badgeSupported())
    return (
      <Card id="badge" title="Цифра на иконке" hint="недоступно здесь">
        <p className="small muted bold">
          {installed()
            ? "Этот телефон или браузер не умеет показывать цифру на иконке."
            : "Цифра на иконке работает, когда приложение добавлено на экран «Домой». Открой его оттуда и вернись сюда."}
        </p>
      </Card>
    );
  const on = badgeOn();
  return (
    <Card id="badge" title="Цифра на иконке" hint={permission !== "granted" ? "не включена" : on ? "включена" : "выключена"}>
      <p className="small muted bold">На иконке приложения — сколько прошедших визитов ещё не заполнено.</p>
      {permission !== "granted" && permission !== "unsupported" ? (
        <>
          <p className="small bold">
            {permission === "denied"
              ? "Уведомления для приложения запрещены. Разреши их в настройках телефона: Настройки → Уведомления → TootsieGroom, и включи «Наклейки»."
              : "Айфон показывает цифру только приложениям, которым разрешены уведомления. Присылать уведомления приложение не будет — это нужно только для цифры."}
          </p>
          {permission === "default" && (
            <button
              className="btn primary"
              style={{ alignSelf: "flex-start" }}
              onClick={async () => {
                const p = await Notification.requestPermission();
                setPermission(p);
                updateBadge();
              }}
            >
              Включить цифру на иконке
            </button>
          )}
        </>
      ) : (
        <label className="row bold" style={{ gap: 10, flexWrap: "nowrap", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => {
              setSetting("badge_off", e.target.checked ? null : "1");
              updateBadge();
            }}
            style={{ width: 22, height: 22, accentColor: "var(--pink)" }}
          />
          Показывать цифру
        </label>
      )}
    </Card>
  );
}

function HistoryCard() {
  return (
    <Card id="history" title="История обновлений" hint={`${CHANGES[0].title} · ${CHANGES[0].date}`}>
      {CHANGES.map((c, i) => (
        <details key={c.id} className="history" open={i === 0}>
          <summary>
            <span className="bold">{c.title}</span>
            <span className="small muted bold"> · {c.date}</span>
          </summary>
          <ul className="whats-new">
            {c.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </details>
      ))}
    </Card>
  );
}

export function SettingsPage() {
  const sync = useSyncState();
  const file = useRef<HTMLInputElement>(null);
  const [toast, showToast] = useToast();

  const downloadBackup = () => {
    const url = URL.createObjectURL(new Blob([exportBytes() as BlobPart], { type: "application/x-sqlite3" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tootsiegroom-${toDateKey(new Date())}.db`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <>
      <header className="page-head">
        <h1>Настройки</h1>
      </header>
      <div className="split">
        <div className="grow">
          <WorkHoursCard />

          <RemindTemplateCard />

          <LookCard />

          <JokesCard />

          <BadgeCard />

          <Card id="dropbox" title="Синхронизация через Dropbox" hint={sync.connected ? "подключён" : "не подключён"}>
            <p className="small muted bold">
              База и фото хранятся на устройстве и копируются в папку приложения в Dropbox. Подключи один и тот же Dropbox на маке и на телефоне.
            </p>
            <DropboxSection />
          </Card>

          <Card id="backup" title="Резервная копия" hint="скачать или восстановить базу">
            <p className="small muted bold">Файл базы целиком. Фото в него не входят — они лежат в Dropbox.</p>
            <div className="row">
              <button className="btn" onClick={downloadBackup}>
                Скачать копию базы
              </button>
              <button className="btn danger" onClick={() => file.current?.click()}>
                Восстановить из файла
              </button>
              <input
                ref={file}
                type="file"
                accept=".db,.sqlite,application/x-sqlite3,application/octet-stream"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const ok = await askConfirm({
                    title: "Восстановить из файла?",
                    text: "Все данные на этом устройстве заменятся содержимым файла, и он уйдёт в Dropbox.",
                    okText: "Восстановить",
                    danger: true,
                  });
                  if (!ok) return;
                  await replaceDb(new Uint8Array(await f.arrayBuffer()));
                  write(() => {}); // mark as changed so the restored copy is uploaded
                  showToast("База восстановлена");
                }}
              />
            </div>
          </Card>

          <StorageCard />

          <HistoryCard />
          <p className="tiny bold muted" style={{ textAlign: "center" }}>
            Версия от {new Date(__BUILD__).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
      {toast}
    </>
  );
}
