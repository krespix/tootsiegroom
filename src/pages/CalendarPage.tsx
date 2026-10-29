import { useEffect, useRef, useState, type TouchEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDbVersion } from "../db/db";
import { appointmentsBetween, dogsWithUpcoming, lastVisits, listDogs, unfilledAppointments, workHours, type AppointmentRow } from "../db/repo";
import { freeSlots, type FreeSlot } from "../lib/slots";
import { canRemind } from "../lib/remind";
import { RemindButton } from "../components/RemindButton";
import { Swipe } from "../components/Swipe";
import {
  addDays,
  addMinutes,
  dayMonth,
  daysToBirthday,
  fromLocalStamp,
  hhmm,
  sameDay,
  startOfDay,
  startOfWeek,
  toDateKey,
  weekdayLong,
  weekdayShort,
  weekLabel,
  weeksAgo,
} from "../lib/dates";
import { money, plural } from "../lib/format";
import { earningJoke, greetName, greeting, jokeLevel, todaySummary } from "../lib/prefs";
import { celebrate } from "../lib/fx";
import { Avatar, useDesktop, useNow } from "../components/common";
import { Icon } from "../components/Icon";
import { SyncLabel } from "../components/Layout";

type Status = "planned" | "todo" | "done";

/** What the visit brings: the paid amount once entered, otherwise the price list. */
const amount = (a: AppointmentRow) => a.paid ?? a.price;

function statusOf(a: AppointmentRow): Status {
  if (a.filled_at) return "done";
  return fromLocalStamp(a.starts_at) <= new Date() ? "todo" : "planned";
}

function timeRange(a: AppointmentRow) {
  const s = fromLocalStamp(a.starts_at);
  return `${hhmm(s)}–${hhmm(addMinutes(s, a.minutes))}`;
}

const what = (a: AppointmentRow) => `${a.proc_name}${a.variant_name ? ` · ${a.variant_name.toLowerCase()}` : ""}`;

function WeekCard({ a }: { a: AppointmentRow }) {
  const st = statusOf(a);
  return (
    <div className="appt-card" style={{ background: a.color }}>
      <span className="time">{timeRange(a)}</span>
      <Link to={`/appt/${a.id}`} className="who stretch">
        {a.dog_name}
      </Link>
      <span className="what">{what(a)}</span>
      {st === "todo" && <span className="fill-btn">Заполнить визит</span>}
      {st === "done" && <span className="done-badge">✓ заполнен</span>}
      {canRemind(a, new Date()) && <RemindButton a={a} compact />}
    </div>
  );
}

/** A free window in the working day; tapping it books that time. */
function FreeSlotLink({ day, slot, compact }: { day: Date; slot: FreeSlot; compact?: boolean }) {
  return (
    <Link to={`/book?date=${toDateKey(day)}&time=${slot.from}`} className={`free-slot${compact ? " compact" : ""}`} aria-label={`Записать на ${dayMonth(day)}, свободно ${slot.from}–${slot.to}`}>
      {!compact && <Icon name="plus" size={16} />}
      <span>
        {compact ? (
          <>
            <span style={{ whiteSpace: "nowrap" }}>
              {slot.from}–{slot.to}
            </span>
            <br />
            свободно
          </>
        ) : (
          <>
            Свободно {slot.from}–{slot.to}
          </>
        )}
      </span>
    </Link>
  );
}

/** Bookings and free windows of one day in time order. */
function dayItems(day: Date, appts: AppointmentRow[], now: Date) {
  const free = freeSlots(toDateKey(day), appts, workHours(), now);
  const items: ({ kind: "appt"; at: string; a: AppointmentRow } | { kind: "free"; at: string; slot: FreeSlot })[] = [
    ...appts.map((a) => ({ kind: "appt" as const, at: a.starts_at.slice(11, 16), a })),
    ...free.map((slot) => ({ kind: "free" as const, at: slot.from, slot })),
  ];
  return { items: items.sort((x, y) => x.at.localeCompare(y.at)), free, hasFree: free.length > 0 };
}

/** Phone: swipe the day list left or right to move to the next or previous day. */
function useDaySwipe(onPage: (step: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onPage(dx < 0 ? 1 : -1);
    },
  };
}

function AgendaCard({ a }: { a: AppointmentRow }) {
  const st = statusOf(a);
  const s = fromLocalStamp(a.starts_at);
  return (
    <div className="agenda-card" style={{ background: a.color }}>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52, fontWeight: 800 }}>
        <span style={{ fontSize: 17 }}>{hhmm(s)}</span>
        <span className="tiny">{hhmm(addMinutes(s, a.minutes))}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <Link to={`/appt/${a.id}`} className="stretch" style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 17, textDecoration: "none" }}>
          {a.dog_name}
        </Link>
        <span className="small bold">
          {what(a)} · {money(amount(a))}
        </span>
        {st === "todo" && <span className="fill-btn" style={{ alignSelf: "flex-start", padding: "6px 12px" }}>Заполнить визит</span>}
        {st === "done" && <span className="done-badge" style={{ marginTop: 6 }}>✓ заполнен</span>}
        {canRemind(a, new Date()) && <RemindButton a={a} />}
      </span>
      <Avatar id={a.dog_id} name={a.dog_name} photo={a.dog_photo} />
    </div>
  );
}

/** "Добрый день, Наташа! Впереди 2 собаки, ближайшая в 15:00." */
function Greeting({ now }: { now: Date }) {
  const summary = todaySummary(now);
  return (
    <p className="greeting">
      <b>{greeting(now, greetName())}</b>
      {summary}
    </p>
  );
}

/** "Сегодня" or "Пт, 30 октября". */
const dayTitle = (day: Date, now: Date) => (sameDay(day, now) ? "Сегодня" : `${weekdayShort(day)}, ${dayMonth(day)}`);

function DaySummary({ day, appts, now }: { day: Date; appts: AppointmentRow[]; now: Date }) {
  const isToday = sameDay(day, now);
  const future = day > now;
  // A visit counts as earned once it has ended.
  const ended = (a: AppointmentRow) => addMinutes(fromLocalStamp(a.starts_at), a.minutes) <= now;
  const earned = appts.filter(ended).reduce((s, a) => s + amount(a), 0);
  const total = appts.reduce((s, a) => s + amount(a), 0);
  const joke = earningJoke(earned);

  // Paws fly once each time today reaches a new joke threshold.
  const level = isToday ? jokeLevel(earned) : -1;
  useEffect(() => {
    if (level < 0) return;
    const key = `fx:joke:${toDateKey(day)}`;
    let seen = -1;
    try {
      seen = Number(localStorage.getItem(key) ?? -1);
    } catch {
      // storage unavailable: celebrate anyway
    }
    if (level > seen) {
      celebrate(true);
      try {
        localStorage.setItem(key, String(level));
      } catch {
        // ignore
      }
    }
  }, [level, day]);

  return (
    <section className="card">
      <h2>
        {dayTitle(day, now)} · {appts.length} {plural(appts.length, "собака", "собаки", "собак")}
      </h2>
      {appts.length === 0 && <p className="muted bold small">{isToday ? "Записей нет — можно выдохнуть" : "Записей нет"}</p>}
      {appts.map((a) => (
        <Link key={a.id} to={`/appt/${a.id}`} className="row" style={{ flexWrap: "nowrap", textDecoration: "none" }}>
          <Avatar id={a.dog_id} name={a.dog_name} photo={a.dog_photo} />
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span className="bold">
              {a.dog_name} · {hhmm(fromLocalStamp(a.starts_at))}
            </span>
            <span className="small muted">
              {what(a)} · {money(amount(a))}
            </span>
          </span>
        </Link>
      ))}
      {appts.length > 0 && (
        <div className="stack" style={{ gap: 6, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
          {future ? (
            <div className="row bold" style={{ justifyContent: "space-between" }}>
              <span>Ожидается</span>
              <span>{money(total)}</span>
            </div>
          ) : (
            <div className="row bold" style={{ justifyContent: "space-between" }}>
              <span>{earned !== total ? "Уже заработала" : isToday ? "Заработала сегодня" : "Заработала"}</span>
              <span>{money(earned)}</span>
            </div>
          )}
          {!future && earned !== total && (
            <div className="row bold muted" style={{ justifyContent: "space-between" }}>
              <span>К концу дня</span>
              <span>{money(total)}</span>
            </div>
          )}
        </div>
      )}
      <Link to="/stats" className="btn" style={{ alignSelf: "flex-start" }}>
        <Icon name="chart" size={18} /> Вся статистика
      </Link>
      {joke && (
        <div className="joke">
          <Icon name="heart" size={22} />
          <span>{joke}</span>
        </div>
      )}
    </section>
  );
}

function Sidebar({ day, appts, now }: { day: Date; appts: AppointmentRow[]; now: Date }) {
  const isToday = sameDay(day, now);
  // The moment the side blocks look from: now for today, otherwise the end of the picked day.
  const asOf = isToday ? now : addMinutes(addDays(day, 1), -1);

  // Unfilled visits are a to-do list, so they ignore the picked day.
  const unfilled = unfilledAppointments().slice(0, 6);
  const dogs = listDogs();
  const birthdays = dogs
    .map((d) => ({ d, days: daysToBirthday(d.birthday, day) }))
    .filter((x): x is { d: (typeof dogs)[number]; days: number } => x.days !== null && x.days <= 14)
    .sort((a, b) => a.days - b.days);
  const last = lastVisits(asOf);
  const upcoming = dogsWithUpcoming(asOf);
  const longAgo = dogs
    .filter((d) => {
      const l = last.get(d.id);
      return l && !upcoming.has(d.id) && asOf.getTime() - fromLocalStamp(l).getTime() > 8 * 7 * 86_400_000;
    })
    .slice(0, 5);

  return (
    <>
      <DaySummary day={day} appts={appts} now={now} />

      {unfilled.length > 0 && (
        <section className="card">
          <h2>Заполни визиты</h2>
          <p className="small muted bold">Приём прошёл — добавь косметику, фото и оплату</p>
          {unfilled.map((a) => (
            <Link key={a.id} to={`/appt/${a.id}`} className="list-link" style={{ background: a.color }}>
              <span>
                {a.dog_name} · {sameDay(fromLocalStamp(a.starts_at), now) ? "сегодня" : dayMonth(fromLocalStamp(a.starts_at))}
              </span>
              <Icon name="right" size={18} />
            </Link>
          ))}
        </section>
      )}

      {birthdays.length > 0 && (
        <section className="card butter">
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <Icon name="cake" size={22} />
            <div className="stack" style={{ gap: 4 }}>
              <h2>Скоро день рождения</h2>
              {birthdays.map(({ d, days }) => (
                <Link key={d.id} to={`/dogs/${d.id}`} className="bold" style={{ textDecoration: "none" }}>
                  {d.name} — {days === 0 ? (isToday ? "сегодня!" : "в этот день!") : dayMonth(addDays(day, days))}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {longAgo.length > 0 && (
        <section className="card">
          <h2>Давно не были</h2>
          {longAgo.map((d) => (
            <Link key={d.id} to={`/dogs/${d.id}`} className="row bold" style={{ justifyContent: "space-between", textDecoration: "none" }}>
              <span>{d.name}</span>
              <span className="muted">{weeksAgo(last.get(d.id)!, asOf)}</span>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

export function CalendarPage() {
  useDbVersion();
  const desktop = useDesktop();
  const now = useNow();
  // The picked day lives in the URL so it survives opening a visit and coming back.
  const [params, setParams] = useSearchParams();
  const picked = params.get("day");
  const day = picked ? fromLocalStamp(picked) : startOfDay(now);
  const week = startOfWeek(day);
  const setDay = (d: Date) => setParams(sameDay(d, new Date()) ? {} : { day: toDateKey(d) }, { replace: true });

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const appts = appointmentsBetween(toDateKey(week), toDateKey(addDays(week, 7)));
  const byDay = (d: Date) => appts.filter((a) => a.starts_at.startsWith(toDateKey(d)));
  const sidebar = <Sidebar day={day} appts={byDay(day)} now={now} />;

  const moveWeek = (n: number) => setDay(addDays(day, 7 * n));
  // Which way the day list slides in after a swipe or a tap on another day.
  const [slide, setSlide] = useState<"next" | "prev" | null>(null);
  const goTo = (d: Date) => {
    if (!sameDay(d, day)) setSlide(d > day ? "next" : "prev");
    setDay(d);
  };
  const daySwipe = useDaySwipe((step) => goTo(addDays(day, step)));
  const goToday = () => setDay(new Date());

  if (!desktop) {
    const list = byDay(day);
    const agenda = dayItems(day, list, now);
    return (
      <>
        <header className="stack" style={{ gap: 4 }}>
          <Greeting now={now} />
          <span className="tiny bold muted">
            {weekdayLong(day)}, {dayMonth(day)}
          </span>
          <div className="row" style={{ flexWrap: "nowrap", justifyContent: "space-between" }}>
            <h1 style={{ minWidth: 0 }}>{sameDay(day, now) ? "Сегодня" : weekdayShort(day) + ", " + day.getDate()}</h1>
            <div className="row" style={{ flexWrap: "nowrap", gap: 8, flex: "none" }}>
              <Link to="/stats" className="btn">
                <Icon name="chart" size={18} /> Статистика
              </Link>
              <Link to="/settings" className="btn icon" aria-label="Настройки">
                <Icon name="settings" />
              </Link>
            </div>
          </div>
        </header>
        <SyncLabel />

        <div className="strip day-list" role="group" aria-label="Дни недели" {...daySwipe}>
          <button className="btn icon" style={{ width: 36, minHeight: 36 }} aria-label="Предыдущая неделя" onClick={() => moveWeek(-1)}>
            <Icon name="left" size={18} />
          </button>
          {days.map((d) => (
            <button
              key={d.toISOString()}
              className={`strip-day${sameDay(d, day) ? " on" : ""}`}
              aria-pressed={sameDay(d, day)}
              onClick={() => goTo(d)}
            >
              <span className="tiny bold">{weekdayShort(d)}</span>
              <span className="bold">{d.getDate()}</span>
              <span className="dot" style={{ visibility: byDay(d).length ? "visible" : "hidden" }} />
            </button>
          ))}
          <button className="btn icon" style={{ width: 36, minHeight: 36 }} aria-label="Следующая неделя" onClick={() => moveWeek(1)}>
            <Icon name="right" size={18} />
          </button>
        </div>
        {!days.some((d) => sameDay(d, now)) && (
          <button className="btn link" onClick={goToday}>
            ← К сегодняшнему дню
          </button>
        )}

        <div className={`stack day-list${slide ? ` slide-${slide}` : ""}`} key={toDateKey(day)} {...daySwipe}>
          {list.length === 0 && (
            <div className="empty">
              <span>
                Записей нет
                {agenda.hasFree && (
                  <>
                    <br />
                    <span className="small">
                      свободно {agenda.free[0].from}–{agenda.free[agenda.free.length - 1].to}
                    </span>
                  </>
                )}
              </span>
              <Link to={`/book?date=${toDateKey(day)}${agenda.hasFree ? `&time=${agenda.free[0].from}` : ""}`} className="btn primary">
                <Icon name="plus" size={18} /> Записать
              </Link>
            </div>
          )}
          {list.length > 0 &&
            agenda.items.map((it) =>
              it.kind === "appt" ? (
                <Swipe
                  key={it.a.id}
                  onSwipeRight={() => goTo(addDays(day, -1))}
                  actions={[
                    { label: "Заполнить", icon: "edit", tone: "primary", to: `/appt/${it.a.id}` },
                    { label: "Перенести", icon: "clock", to: `/appt/${it.a.id}?edit=1` },
                  ]}
                >
                  <AgendaCard a={it.a} />
                </Swipe>
              ) : (
                <FreeSlotLink key={it.at} day={day} slot={it.slot} />
              ),
            )}
        </div>

        {sidebar}
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <Greeting now={now} />
          <p className="bold muted">
            {weekdayLong(now)}, {dayMonth(now)}
          </p>
          <h1>Неделя {weekLabel(week)}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={goToday}>
            Сегодня
          </button>
          <button className="btn icon" aria-label="Предыдущая неделя" onClick={() => moveWeek(-1)}>
            <Icon name="left" />
          </button>
          <button className="btn icon" aria-label="Следующая неделя" onClick={() => moveWeek(1)}>
            <Icon name="right" />
          </button>
        </div>
      </header>

      <div className="split">
        <section className="week grow" aria-label="Записи на неделю" style={{ display: "block" }}>
          <div className="week-grid">
            {days.map((d) => {
              const isToday = sameDay(d, now);
              const on = sameDay(d, day);
              const col = dayItems(d, byDay(d), now);
              return (
                <div key={d.toISOString()} className={`day-col${isToday ? " today" : ""}${on ? " selected" : ""}`}>
                  <button type="button" className="day-head" aria-pressed={on} aria-label={`${weekdayLong(d)}, ${dayMonth(d)}`} onClick={() => setDay(d)}>
                    <span className="small bold muted">{weekdayShort(d)}</span>
                    <span className={`day-num${isToday ? " today" : ""}`}>{d.getDate()}</span>
                  </button>
                  {col.items.map((it) => (it.kind === "appt" ? <WeekCard key={it.a.id} a={it.a} /> : <FreeSlotLink key={it.at} day={d} slot={it.slot} compact />))}
                  {!col.hasFree && (
                    <Link to={`/book?date=${toDateKey(d)}`} className="add-slot" aria-label={`Записать на ${dayMonth(d)}`}>
                      +
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <aside className="side" aria-label="Сводка">
          {sidebar}
        </aside>
      </div>
    </>
  );
}
