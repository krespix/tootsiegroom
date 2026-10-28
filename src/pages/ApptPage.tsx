import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDbVersion } from "../db/db";
import {
  cancelAppointment,
  dogAppointments,
  getAppointment,
  getDog,
  listBrands,
  listProducts,
  rescheduleAppointment,
  saveVisit,
  setAppointmentPhoto,
  usedProducts,
} from "../db/repo";
import { fromLocalStamp, hhmm, slotLabel, toDateKey } from "../lib/dates";
import { money, splitTags } from "../lib/format";
import { appointmentTitle, buildIcs, openInCalendar } from "../lib/ics";
import { Avatar, PhotoSlot, useToast } from "../components/common";
import { Icon } from "../components/Icon";

export function ApptPage() {
  useDbVersion();
  const { id = "" } = useParams();
  const appt = getAppointment(id);
  if (!appt) {
    return (
      <div className="empty">
        Запись не найдена
        <Link to="/" className="btn">
          В календарь
        </Link>
      </div>
    );
  }
  // Keyed so the form state resets when another appointment opens.
  return <ApptView key={appt.id} id={appt.id} />;
}

function ApptView({ id }: { id: string }) {
  const nav = useNavigate();
  const appt = getAppointment(id)!;
  const dog = getDog(appt.dog_id)!;
  const brands = listBrands();
  const products = listProducts();
  const [toast, showToast] = useToast();

  const [paid, setPaid] = useState(String(appt.paid ?? appt.price));
  const [notes, setNotes] = useState(appt.notes);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(usedProducts(id).map((p) => p.id)));
  const [brandId, setBrandId] = useState<string | null>(brands[0]?.id ?? null);
  const [moving, setMoving] = useState(false);
  const [newDate, setNewDate] = useState(appt.starts_at.slice(0, 10));
  const [newTime, setNewTime] = useState(appt.starts_at.slice(11, 16));

  const start = fromLocalStamp(appt.starts_at);
  const past = start <= new Date();
  const cancelled = appt.status === "cancelled";

  const toggle = (pid: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });

  const lines = new Map<string, typeof products>();
  for (const p of products.filter((p) => p.brand_id === brandId)) {
    const key = p.line || "Без линейки";
    lines.set(key, [...(lines.get(key) ?? []), p]);
  }
  const brandName = (bid: string) => brands.find((b) => b.id === bid)?.name ?? "";
  const pickedList = products.filter((p) => picked.has(p.id));

  const previous = dogAppointments(dog.id).find((a) => a.id !== id && a.filled_at && a.starts_at < appt.starts_at);
  const previousProducts = previous ? usedProducts(previous.id) : [];

  const save = () => {
    saveVisit(id, { paid: paid === "" ? null : Number(paid), notes, productIds: [...picked] });
    showToast("Визит сохранён");
  };

  const exportOne = () => void openInCalendar("tootsie-zapis.ics", buildIcs([appt], new Map([[dog.id, dog]])));

  return (
    <>
      <header className="page-head">
        <div className="titles" style={{ gap: 8 }}>
          <button className="btn link row small muted" style={{ alignSelf: "flex-start", gap: 4 }} onClick={() => nav(-1)}>
            <Icon name="left" size={18} /> Назад
          </button>
          <h1>{appointmentTitle(appt)}</h1>
          <div className="row" style={{ gap: 8 }}>
            <span className="tag">{slotLabel(appt.starts_at, appt.minutes)}</span>
            <span className="tag">{money(appt.price)} по прайсу</span>
            {cancelled ? (
              <span className="badge-off">Отменена</span>
            ) : appt.filled_at ? (
              <span className="badge-done">✓ Визит заполнен</span>
            ) : past ? (
              <span className="badge-todo">Прошла · визит не заполнен</span>
            ) : (
              <span className="badge-done">Запланирована</span>
            )}
          </div>
        </div>
        {!cancelled && (
          <div className="row">
            <button className="btn" onClick={exportOne}>
              <Icon name="calendarPlus" size={18} /> В Apple Календарь
            </button>
            <button className="btn" onClick={() => setMoving(!moving)}>
              Перенести
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (window.confirm(`Отменить запись ${appt.dog_name}?`)) {
                  cancelAppointment(id);
                  nav("/");
                }
              }}
            >
              Отменить
            </button>
          </div>
        )}
      </header>

      {moving && (
        <section className="card">
          <h2>Перенести запись</h2>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "1 1 160px" }}>
              Дата
              <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </label>
            <label className="field" style={{ flex: "1 1 120px" }}>
              Начало
              <input className="input" type="time" step={300} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </label>
            <button
              className="btn primary"
              style={{ minHeight: 48 }}
              onClick={() => {
                rescheduleAppointment(id, `${newDate}T${newTime}`);
                setMoving(false);
                showToast(`Перенесено на ${newDate.split("-").reverse().join(".")} ${newTime}`);
              }}
            >
              Сохранить
            </button>
          </div>
          <p className="small muted bold">Если запись уже в Apple Календаре — удали старое событие и нажми «В Apple Календарь» ещё раз.</p>
        </section>
      )}

      <div className="split">
        <div className="grow">
          <section className="card">
            <h2>Оплата</h2>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: "1 1 180px" }}>
                По прайсу
                <span className="input" style={{ display: "flex", alignItems: "center", background: "transparent", borderStyle: "dashed" }}>
                  {money(appt.price)}
                </span>
              </div>
              <label className="field" style={{ flex: "1 1 180px" }}>
                Оплачено, ₾
                <input className="input" type="number" min={0} step={5} inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} style={{ background: "var(--butter)", fontWeight: 800 }} />
              </label>
            </div>
          </section>

          <section className="card">
            <h2>Косметика</h2>
            {brands.length === 0 ? (
              <div className="empty">
                Косметики пока нет
                <Link to="/cosmetics" className="btn">
                  Добавить в справочник
                </Link>
              </div>
            ) : (
              <>
                <p className="small muted bold">Сначала бренд, потом конкретное средство. Можно из нескольких брендов.</p>
                <div className="row" role="group" aria-label="Бренд">
                  {brands.map((b) => {
                    const n = pickedList.filter((p) => p.brand_id === b.id).length;
                    return (
                      <button key={b.id} type="button" className={`chip${b.id === brandId ? " on" : ""}`} aria-pressed={b.id === brandId} style={{ minHeight: 44, fontFamily: "var(--head)" }} onClick={() => setBrandId(b.id)}>
                        {b.name}
                        {n ? ` · ${n}` : ""}
                      </button>
                    );
                  })}
                </div>
                <div className="stack" style={{ padding: 14, borderRadius: 18, background: "var(--bg)" }}>
                  {lines.size === 0 && <p className="small muted bold">В этом бренде пока нет средств</p>}
                  {[...lines.entries()].map(([line, items]) => (
                    <div key={line} className="stack" style={{ gap: 8 }}>
                      <span className="label-caps">{line}</span>
                      <div className="grid-auto" style={{ ["--min" as string]: "230px", gap: 8 }}>
                        {items.map((p) => {
                          const on = picked.has(p.id);
                          return (
                            <button key={p.id} type="button" className={`pick tinted${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggle(p.id)}>
                              <span className="box" aria-hidden="true">
                                {on && <Icon name="check" size={14} stroke={3} />}
                              </span>
                              <span className="bold">{p.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <span className="bold">Использовано</span>
                  {pickedList.length === 0 && <span className="small muted bold">Пока ничего не выбрано</span>}
                  <div className="row" style={{ gap: 8 }}>
                    {pickedList.map((p) => (
                      <span key={p.id} className="chip on" style={{ paddingRight: 4 }}>
                        {brandName(p.brand_id)} · {p.name}
                        <button type="button" className="btn icon" style={{ width: 28, minHeight: 28, borderRadius: 999, border: 0 }} aria-label={`Убрать ${p.name}`} onClick={() => toggle(p.id)}>
                          <Icon name="x" size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="card">
            <h2>Фото и заметки</h2>
            <p className="small muted bold">Фото сохраняются сразу, как сделаешь.</p>
            <div className="row">
              <PhotoSlot name={appt.photo_before} label="Фото «до»" tint="#FFE9A8" onChange={(n) => setAppointmentPhoto(id, "photo_before", n)} />
              <PhotoSlot name={appt.photo_after} label="Фото «после»" tint="#CFF3E9" onChange={(n) => setAppointmentPhoto(id, "photo_after", n)} />
            </div>
            <label className="field">
              Заметка к визиту
              <textarea className="input" rows={3} value={notes} placeholder="Как прошло, что учесть в следующий раз" onChange={(e) => setNotes(e.target.value)} />
            </label>
          </section>
        </div>

        <aside className="side">
          <section className="card">
            <Link to={`/dogs/${dog.id}`} className="row" style={{ flexWrap: "nowrap", textDecoration: "none" }}>
              <Avatar id={dog.id} name={dog.name} photo={dog.photo} size={56} />
              <span className="stack" style={{ gap: 0 }}>
                <span style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 18 }}>{dog.name}</span>
                <span className="small bold muted">{[dog.breed, dog.owner_name].filter(Boolean).join(" · ")}</span>
              </span>
            </Link>
            {dog.owner_phone && (
              <a href={`tel:${dog.owner_phone}`} className="btn">
                <Icon name="phone" size={16} /> {dog.owner_phone}
              </a>
            )}
            {(dog.notes || dog.tags) && (
              <div className="stack" style={{ padding: 12, borderRadius: 14, background: "var(--butter)", gap: 8 }}>
                {dog.tags && (
                  <div className="row" style={{ gap: 6 }}>
                    {splitTags(dog.tags).map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {dog.notes && <p className="small bold" style={{ lineHeight: 1.45, whiteSpace: "pre-line" }}>{dog.notes}</p>}
              </div>
            )}
            {previous && (
              <p className="small muted bold">
                Прошлый раз ({toDateKey(fromLocalStamp(previous.starts_at)).split("-").reverse().join(".")}, {hhmm(fromLocalStamp(previous.starts_at))}):{" "}
                {previousProducts.length ? previousProducts.map((p) => `${p.brand_name} · ${p.name}`).join(", ") : "косметика не отмечена"}
              </p>
            )}
          </section>
          {!cancelled && (
            <>
              <button className="btn primary big wide" onClick={save}>
                Сохранить визит
              </button>
              <p className="small muted bold" style={{ textAlign: "center" }}>
                Можно сохранять частями — например, фото «до» сразу, остальное потом.
              </p>
            </>
          )}
        </aside>
      </div>
      {toast}
    </>
  );
}
