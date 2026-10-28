import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDbVersion } from "../db/db";
import {
  createAppointment,
  emptyDog,
  listDogs,
  listProcedures,
  saveDog,
  saveProcedure,
  type Procedure,
  type Variant,
} from "../db/repo";
import { addMinutes, fromLocalStamp, hhmm, slotLabel, toDateKey } from "../lib/dates";
import { PASTELS, duration, money } from "../lib/format";
import { Avatar, DurationFields, NumberInput, SearchBox } from "../components/common";
import { Icon } from "../components/Icon";

export function BookPage() {
  useDbVersion();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const dogs = listDogs();
  const procs = listProcedures();

  const [dogId, setDogId] = useState<string | null>(params.get("dog"));
  const [dogQuery, setDogQuery] = useState("");
  const [newDog, setNewDog] = useState(false);
  const [nd, setNd] = useState({ name: "", breed: "", owner_name: "", owner_phone: "" });

  const [procId, setProcId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [newProc, setNewProc] = useState(false);
  const [np, setNp] = useState({ name: "", minutes: 60, price: 0 });

  const [date, setDate] = useState(params.get("date") ?? toDateKey(new Date()));
  const [time, setTime] = useState("10:00");

  const proc = procs.find((p) => p.id === procId) ?? null;
  const variant = proc?.variants.find((v) => v.id === variantId) ?? null;
  const needVariant = !newProc && !!proc && proc.variants.length > 0 && !variant;

  const minutes = newProc ? np.minutes : variant?.minutes ?? proc?.minutes ?? 0;
  const price = newProc ? np.price : variant?.price ?? proc?.price ?? 0;
  const hasProc = newProc ? np.name.trim() !== "" : !!proc;
  const hasDog = newDog ? nd.name.trim() !== "" : !!dogId;
  const canSave = hasDog && hasProc && !needVariant && !!date && !!time;

  const startsAt = `${date}T${time}`;
  const end = date && time ? hhmm(addMinutes(fromLocalStamp(startsAt), minutes)) : "—";

  const q = dogQuery.trim().toLowerCase();
  const shownDogs = dogs.filter((d) => !q || `${d.name} ${d.breed} ${d.owner_name}`.toLowerCase().includes(q));

  const save = () => {
    if (!canSave) return;
    const finalDogId = newDog ? saveDog({ ...emptyDog(), ...nd, name: nd.name.trim() }) : dogId!;
    let finalProc: Procedure = proc!;
    let finalVariant: Variant | null = variant;
    if (newProc) {
      const id = saveProcedure({
        name: np.name.trim(),
        description: "",
        color: PASTELS[procs.length % PASTELS.length],
        minutes: np.minutes,
        price: np.price,
        variants: [],
      });
      finalProc = listProcedures().find((p) => p.id === id)!;
      finalVariant = null;
    }
    createAppointment({ dog_id: finalDogId, procedure: finalProc, variant: finalVariant, starts_at: startsAt });
    nav("/");
  };

  const dogName = newDog ? nd.name || "Новая собака" : dogs.find((d) => d.id === dogId)?.name ?? "не выбрана";
  const procName = newProc ? np.name || "Новая процедура" : proc ? `${proc.name}${variant ? `, ${variant.name.toLowerCase()}` : ""}` : "не выбрана";

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <Link to="/" className="row small bold muted" style={{ textDecoration: "none", gap: 4 }}>
            <Icon name="left" size={18} /> Календарь
          </Link>
          <h1>Новая запись</h1>
          <p className="muted bold small">Только бронь. Косметику, фото, заметки и оплату добавишь после приёма.</p>
        </div>
      </header>

      <div className="split">
        <div className="grow">
          <section className="card">
            <h2>Кто придёт</h2>
            {dogs.length > 6 && <SearchBox value={dogQuery} onChange={setDogQuery} placeholder="Кличка, порода, хозяин" />}
            <div className="grid-auto" style={{ ["--min" as string]: "140px" }}>
              {shownDogs.map((d) => {
                const on = !newDog && d.id === dogId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`pick${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() => {
                      setDogId(d.id);
                      setNewDog(false);
                    }}
                  >
                    <Avatar id={d.id} name={d.name} photo={d.photo} size={40} />
                    <span className="col">
                      <span className="bold">{d.name}</span>
                      <span className="tiny muted bold">{d.breed}</span>
                    </span>
                  </button>
                );
              })}
              <button type="button" className={`pick${newDog ? " on" : ""}`} aria-pressed={newDog} style={{ borderStyle: "dashed", justifyContent: "center" }} onClick={() => setNewDog(!newDog)}>
                <Icon name="plus" size={18} />
                <span className="bold">Новая собака</span>
              </button>
            </div>
            {newDog && (
              <div className="grid-auto" style={{ ["--min" as string]: "200px", padding: 16, borderRadius: 18, background: "var(--bg)", border: "1.5px dashed var(--dash)" }}>
                <label className="field">
                  Кличка
                  <input className="input" value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} placeholder="Например, Ричи" autoFocus />
                </label>
                <label className="field">
                  Порода
                  <input className="input" value={nd.breed} onChange={(e) => setNd({ ...nd, breed: e.target.value })} />
                </label>
                <label className="field">
                  Хозяин
                  <input className="input" value={nd.owner_name} onChange={(e) => setNd({ ...nd, owner_name: e.target.value })} />
                </label>
                <label className="field">
                  Телефон
                  <input className="input" type="tel" value={nd.owner_phone} onChange={(e) => setNd({ ...nd, owner_phone: e.target.value })} />
                </label>
                <p className="small muted bold" style={{ gridColumn: "1 / -1" }}>
                  Фото, день рождения и заметки — потом в карточке собаки.
                </p>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Процедура</h2>
            <div className="grid-auto" style={{ ["--min" as string]: "180px" }}>
              {procs.map((p) => {
                const on = !newProc && p.id === procId;
                const meta = p.variants.length
                  ? `${p.variants.length} ${p.variants.length === 1 ? "подтип" : "подтипа"} · от ${money(Math.min(...p.variants.map((v) => v.price)))}`
                  : `${duration(p.minutes)} · ${money(p.price)}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pick${on ? " on" : ""}`}
                    aria-pressed={on}
                    style={{ background: p.color, flexDirection: "column", alignItems: "flex-start", gap: 4 }}
                    onClick={() => {
                      setProcId(p.id);
                      setVariantId(p.variants.length === 1 ? p.variants[0].id : null);
                      setNewProc(false);
                    }}
                  >
                    <span className="bold">{p.name}</span>
                    <span className="small bold">{meta}</span>
                  </button>
                );
              })}
              <button type="button" className={`pick${newProc ? " on" : ""}`} aria-pressed={newProc} style={{ borderStyle: "dashed", justifyContent: "center" }} onClick={() => setNewProc(!newProc)}>
                <Icon name="plus" size={18} />
                <span className="bold">Новая процедура</span>
              </button>
            </div>

            {proc && !newProc && proc.variants.length > 0 && (
              <div className="stack" style={{ paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
                <span className="bold">Подтип: {proc.name}</span>
                <div className="grid-auto" style={{ ["--min" as string]: "160px" }}>
                  {proc.variants.map((v) => {
                    const on = v.id === variantId;
                    return (
                      <button key={v.id} type="button" className={`pick tinted${on ? " on" : ""}`} aria-pressed={on} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }} onClick={() => setVariantId(v.id)}>
                        <span className="bold">{v.name}</span>
                        <span className="small bold">
                          {duration(v.minutes)} · {money(v.price)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {newProc && (
              <div className="stack" style={{ padding: 16, borderRadius: 18, background: "var(--bg)", border: "1.5px dashed var(--dash)" }}>
                <label className="field">
                  Название
                  <input className="input" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="Например, Стрижка когтей" autoFocus />
                </label>
                <DurationFields minutes={np.minutes} onChange={(m) => setNp({ ...np, minutes: m })} />
                <label className="field">
                  Цена, ₾
                  <NumberInput min={0} value={np.price} onChange={(price) => setNp({ ...np, price })} />
                </label>
                <p className="small muted bold">Сохранится в справочник. Подтипы и цвет — потом в «Процедурах».</p>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Когда</h2>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <label className="field" style={{ flex: "1 1 160px" }}>
                Дата
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="field" style={{ flex: "1 1 120px" }}>
                Начало
                <input className="input" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <div className="bold" style={{ flex: "1 1 160px", minHeight: 48, padding: "12px 14px", borderRadius: 14, background: "var(--butter)" }}>
                Закончим ≈ в {hasProc && !needVariant ? end : "…"}
              </div>
            </div>
          </section>
        </div>

        <aside className="side">
          <section className="card butter">
            <h2>Итог</h2>
            <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px" }}>
              <dt className="bold">Собака</dt>
              <dd style={{ margin: 0 }} className="bold">
                {dogName}
              </dd>
              <dt className="bold">Процедура</dt>
              <dd style={{ margin: 0 }} className="bold">
                {procName}
              </dd>
              <dt className="bold">Когда</dt>
              <dd style={{ margin: 0 }} className="bold">
                {date && time && hasProc && !needVariant ? slotLabel(startsAt, minutes) : "—"}
              </dd>
              <dt className="bold">Цена</dt>
              <dd style={{ margin: 0 }} className="bold">
                {needVariant ? "выбери подтип" : hasProc ? money(price) : "—"}
              </dd>
            </dl>
            <button className="btn primary big wide" disabled={!canSave} onClick={save}>
              {needVariant ? "Выбери подтип процедуры" : "Записать"}
            </button>
            <Link to="/" className="btn link" style={{ alignSelf: "center" }}>
              Отмена
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
