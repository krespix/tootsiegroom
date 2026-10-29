import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { exportBytes, replaceDb, useDbVersion, write } from "../db/db";
import { DEFAULT_WORK_HOURS, getSetting, setSetting, setWorkHours, workHours } from "../db/repo";
import { DEFAULT_REMIND_TEMPLATE, REMIND_FIELDS, REMIND_TEMPLATE_KEY, fillTemplate } from "../lib/remind";
import { DEFAULT_JOKES, fxOn, greetName, greeting, jokes, jokesOn, type Joke } from "../lib/prefs";
import { toDateKey } from "../lib/dates";
import { askConfirm } from "../lib/dialog";
import { DROPBOX_APP_KEY, startAuth } from "../sync/dropbox";
import { connectDropbox, disconnectDropbox, syncNow, useSyncState } from "../sync/sync";
import { SyncLabel } from "../components/Layout";
import { NumberInput, useToast } from "../components/common";

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
    <section className="card">
      <h2>Рабочий день</h2>
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
    </section>
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
    <section className="card">
      <h2>Напоминание хозяину</h2>
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
    </section>
  );
}

function LookCard() {
  useDbVersion();
  const [name, setName] = useState(greetName());
  const animate = fxOn();
  return (
    <section className="card">
      <h2>Приветствие и анимации</h2>
      <label className="field">
        Имя для приветствия
        <input className="input" value={name} placeholder="Например, Наташа" onChange={(e) => setName(e.target.value)} onBlur={() => setSetting("greet_name", name.trim() || null)} />
      </label>
      <p className="small muted bold">На главном экране: «{greeting(new Date(), name)}»</p>
      <label className="row bold" style={{ gap: 10, flexWrap: "nowrap", cursor: "pointer" }}>
        <input type="checkbox" checked={animate} onChange={(e) => setSetting("fx_off", e.target.checked ? null : "1")} style={{ width: 22, height: 22, accentColor: "var(--pink)" }} />
        Лапки и анимации
      </label>
    </section>
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
    <section className="card">
      <h2>Шутки про заработок</h2>
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
    </section>
  );
}

export function SettingsPage() {
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

          <section className="card">
            <h2>Синхронизация через Dropbox</h2>
            <p className="small muted bold">
              База и фото хранятся на устройстве и копируются в папку приложения в Dropbox. Подключи один и тот же Dropbox на маке и на телефоне.
            </p>
            <DropboxSection />
          </section>

          <section className="card">
            <h2>Резервная копия</h2>
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
          </section>
          <p className="tiny bold muted" style={{ textAlign: "center" }}>
            Версия от {new Date(__BUILD__).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
      {toast}
    </>
  );
}
