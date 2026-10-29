import { Fragment, useRef, useState, type MutableRefObject } from "react";
import { useDbVersion } from "../db/db";
import { archiveProcedure, listProcedures, saveProcedure, type ProcedureInput, type VariantInput } from "../db/repo";
import { PASTELS, duration, money } from "../lib/format";
import { askConfirm } from "../lib/dialog";
import { DurationFields, InlinePanel, NumberInput, useDesktop } from "../components/common";
import { Icon } from "../components/Icon";

const COLOR_NAMES = ["Розовый", "Мятный", "Жёлтый", "Сиреневый", "Голубой"];

/** `saveRef` lets the list save the open form when its row is tapped; it returns false if the form is not valid. */
function ProcedureEditor({ initial, onDone, saveRef }: { initial: ProcedureInput; onDone: () => void; saveRef: MutableRefObject<(() => boolean) | null> }) {
  const [p, setP] = useState(initial);
  const set = <K extends keyof ProcedureInput>(k: K, v: ProcedureInput[K]) => setP((x) => ({ ...x, [k]: v }));
  const setVariant = (i: number, patch: Partial<VariantInput>) =>
    set(
      "variants",
      p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)),
    );
  const valid = p.name.trim() && p.variants.every((v) => v.name.trim() && v.minutes > 0);
  const save = () => {
    if (!valid) return false;
    saveProcedure({ ...p, name: p.name.trim(), variants: p.variants.map((v) => ({ ...v, name: v.name.trim() })) });
    return true;
  };
  saveRef.current = save;

  return (
    <section className="card">
      <h2>{p.id ? p.name || "Процедура" : "Новая процедура"}</h2>
      <label className="field">
        Название
        <input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label className="field">
        Описание
        <textarea className="input" rows={2} value={p.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <fieldset style={{ margin: 0, padding: 0, border: 0 }} className="stack">
        <legend className="bold" style={{ paddingBottom: 6 }}>
          Цвет в календаре
        </legend>
        <div className="row">
          {PASTELS.map((c, i) => (
            <button key={c} type="button" className={`swatch${p.color === c ? " on" : ""}`} aria-label={COLOR_NAMES[i]} aria-pressed={p.color === c} style={{ background: c }} onClick={() => set("color", c)} />
          ))}
        </div>
      </fieldset>

      <div className="stack" style={{ padding: 14, borderRadius: 18, background: "var(--bg)" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="bold">Подтипы</span>
          <span className="small bold muted">при записи — выбрать один</span>
        </div>
        {p.variants.length > 0 && (
          <div className="variant-row tiny bold muted" aria-hidden="true">
            <span>Название</span>
            <span>Часы</span>
            <span>Мин</span>
            <span>Цена, ₾</span>
            <span />
          </div>
        )}
        {p.variants.map((v, i) => (
          <div key={i} className="variant-row">
            <input className="input" aria-label="Название подтипа" value={v.name} placeholder="Мини · до 5 кг" onChange={(e) => setVariant(i, { name: e.target.value })} />
            <NumberInput aria-label="Часы" inputMode="numeric" min={0} value={Math.floor(v.minutes / 60)} onChange={(n) => setVariant(i, { minutes: Math.floor(n) * 60 + (v.minutes % 60) })} />
            <NumberInput aria-label="Минуты" inputMode="numeric" min={0} max={59} step={5} value={v.minutes % 60} onChange={(n) => setVariant(i, { minutes: Math.floor(v.minutes / 60) * 60 + Math.floor(n) })} />
            <NumberInput aria-label="Цена" min={0} value={v.price} onChange={(price) => setVariant(i, { price })} />
            <button
              type="button"
              className="btn icon danger"
              style={{ width: 40, minHeight: 40 }}
              aria-label="Удалить подтип"
              onClick={() =>
                set(
                  "variants",
                  p.variants.filter((_, j) => j !== i),
                )
              }
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        <button type="button" className="btn dashed" onClick={() => set("variants", [...p.variants, { name: "", minutes: p.minutes, price: p.price }])}>
          + Подтип
        </button>
        {p.variants.length === 0 && (
          <>
            <p className="small muted bold">Без подтипов — общее время и цена:</p>
            <DurationFields minutes={p.minutes} onChange={(m) => set("minutes", m)} />
            <label className="field">
              Цена, ₾
              <NumberInput min={0} value={p.price} onChange={(n) => set("price", n)} />
            </label>
          </>
        )}
      </div>

      <button
        className="btn primary big wide"
        disabled={!valid}
        onClick={() => {
          if (save()) onDone();
        }}
      >
        Сохранить
      </button>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn link" onClick={onDone}>
          Отмена
        </button>
        {p.id && (
          <button
            className="btn link danger"
            onClick={async () => {
              const ok = await askConfirm({ title: `Убрать «${p.name}»?`, text: "Из списка исчезнет, старые записи останутся.", okText: "Убрать", danger: true });
              if (ok) {
                archiveProcedure(p.id!);
                onDone();
              }
            }}
          >
            Убрать процедуру
          </button>
        )}
      </div>
    </section>
  );
}

export function ProceduresPage() {
  useDbVersion();
  const procs = listProcedures();
  const [editing, setEditing] = useState<ProcedureInput | null>(null);
  const saveOpen = useRef<(() => boolean) | null>(null);
  // Tapping a row while a form is open saves that form first; tapping its own row closes it.
  const tapRow = (p: (typeof procs)[number]) => {
    if (editing && !(saveOpen.current?.() ?? true)) return;
    setEditing(editing?.id === p.id ? null : { ...p, variants: p.variants.map(({ id, name, minutes, price }) => ({ id, name, minutes, price })) });
  };
  const desktop = useDesktop();
  // Desktop edits in the side column; the phone opens the form right where it was tapped.
  const editor = editing && <ProcedureEditor key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} saveRef={saveOpen} />;

  const startNew = () =>
    setEditing({ name: "", description: "", color: PASTELS[procs.length % PASTELS.length], minutes: 60, price: 0, variants: [] });

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1>Процедуры</h1>
          <p className="bold muted">Подтипы — своё время и цена. Цвет процедуры = цвет записи в календаре.</p>
        </div>
        <button className="btn primary" onClick={startNew}>
          <Icon name="plus" size={18} /> Процедура
        </button>
      </header>

      <div className="split">
        <section className="grow" aria-label="Список процедур" style={{ gap: 14 }}>
          {procs.length === 0 && (
            <div className="empty">
              Добавь первую процедуру — например, «Комплекс» с подтипами по размеру собаки
              <button className="btn primary" onClick={startNew}>
                + Процедура
              </button>
            </div>
          )}
          {!desktop && editing && !editing.id && <InlinePanel>{editor}</InlinePanel>}
          {procs.map((p) => (
            <Fragment key={p.id}>
              <button
                type="button"
                className={`pick${editing?.id === p.id ? " on" : ""}`}
                style={{ background: p.color, flexDirection: "column", alignItems: "stretch", gap: 12, padding: "16px 18px", borderRadius: 22 }}
                onClick={() => tapRow(p)}
              >
                <span className="stack" style={{ gap: 2 }}>
                  <span style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 18 }}>{p.name}</span>
                  {p.description && <span className="small bold">{p.description}</span>}
                </span>
                <span className="row" style={{ gap: 8 }}>
                  {p.variants.length === 0 ? (
                    <span className="tag" style={{ borderStyle: "dashed" }}>
                      Без подтипов · {duration(p.minutes)} · <b>{money(p.price)}</b>
                    </span>
                  ) : (
                    p.variants.map((v) => (
                      <span key={v.id} className="tag">
                        {v.name} · {duration(v.minutes)} · <b>{money(v.price)}</b>
                      </span>
                    ))
                  )}
                </span>
              </button>
              {!desktop && editing?.id === p.id && <InlinePanel>{editor}</InlinePanel>}
            </Fragment>
          ))}
        </section>
        {desktop && editing && (
          <aside className="side" style={{ flexBasis: 380 }}>
            {editor}
          </aside>
        )}
      </div>
    </>
  );
}
