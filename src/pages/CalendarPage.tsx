import { Link, useSearchParams } from "react-router-dom";
import { useDbVersion } from "../db/db";
import { appointmentsBetween, dogsWithUpcoming, lastVisits, listDogs, unfilledAppointments, type AppointmentRow } from "../db/repo";
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
import { earningJoke, money, plural } from "../lib/format";
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
    <Link to={`/appt/${a.id}`} className="appt-card" style={{ background: a.color }}>
      <span className="time">{timeRange(a)}</span>
      <span className="who">{a.dog_name}</span>
      <span className="what">{what(a)}</span>
      {st === "todo" && <span className="fill-btn">Заполнить визит</span>}
      {st === "done" && <span className="done-badge">✓ заполнен</span>}
    </Link>
  );
}

function AgendaCard({ a }: { a: AppointmentRow }) {
  const st = statusOf(a);
  const s = fromLocalStamp(a.starts_at);
  return (
    <Link to={`/appt/${a.id}`} className="agenda-card" style={{ background: a.color }}>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 52, fontWeight: 800 }}>
        <span style={{ fontSize: 17 }}>{hhmm(s)}</span>
        <span className="tiny">{hhmm(addMinutes(s, a.minutes))}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: "var(--head)", fontWeight: 700, fontSize: 17 }}>{a.dog_name}</span>
        <span className="small bold">
          {what(a)} · {money(amount(a))}
        </span>
        {st === "todo" && <span className="fill-btn" style={{ alignSelf: "flex-start", padding: "6px 12px" }}>Заполнить визит</span>}
        {st === "done" && <span className="done-badge" style={{ marginTop: 6 }}>✓ заполнен</span>}
      </span>
      <Avatar id={a.dog_id} name={a.dog_name} photo={a.dog_photo} />
    </Link>
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
      <Link to="/stats" className="small bold" style={{ alignSelf: "flex-start" }}>
        Вся статистика →
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
  const goToday = () => setDay(new Date());

  if (!desktop) {
    const list = byDay(day);
    return (
      <>
        <header className="page-head" style={{ alignItems: "center", flexWrap: "nowrap" }}>
          <div className="titles">
            <span className="tiny bold muted">
              {weekdayLong(day)}, {dayMonth(day)}
            </span>
            <h1>{sameDay(day, now) ? "Сегодня" : weekdayShort(day) + ", " + day.getDate()}</h1>
          </div>
          <Link to="/settings" className="btn icon" aria-label="Настройки">
            <Icon name="settings" />
          </Link>
        </header>
        <SyncLabel />

        <div className="strip" role="group" aria-label="Дни недели">
          <button className="btn icon" style={{ width: 36, minHeight: 36 }} aria-label="Предыдущая неделя" onClick={() => moveWeek(-1)}>
            <Icon name="left" size={18} />
          </button>
          {days.map((d) => (
            <button
              key={d.toISOString()}
              className={`strip-day${sameDay(d, day) ? " on" : ""}`}
              aria-pressed={sameDay(d, day)}
              onClick={() => setDay(d)}
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

        <div className="stack">
          {list.length === 0 && (
            <div className="empty">
              Записей нет
              <Link to={`/book?date=${toDateKey(day)}`} className="btn primary">
                <Icon name="plus" size={18} /> Записать
              </Link>
            </div>
          )}
          {list.map((a) => (
            <AgendaCard key={a.id} a={a} />
          ))}
        </div>

        {sidebar}
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div className="titles">
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
              return (
                <div key={d.toISOString()} className={`day-col${isToday ? " today" : ""}${on ? " selected" : ""}`}>
                  <button type="button" className="day-head" aria-pressed={on} aria-label={`${weekdayLong(d)}, ${dayMonth(d)}`} onClick={() => setDay(d)}>
                    <span className="small bold muted">{weekdayShort(d)}</span>
                    <span className={`day-num${isToday ? " today" : ""}`}>{d.getDate()}</span>
                  </button>
                  {byDay(d).map((a) => (
                    <WeekCard key={a.id} a={a} />
                  ))}
                  <Link to={`/book?date=${toDateKey(d)}`} className="add-slot" aria-label={`Записать на ${dayMonth(d)}`}>
                    +
                  </Link>
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
