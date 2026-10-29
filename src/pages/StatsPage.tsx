import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDbVersion } from "../db/db";
import { listProducts, productUsesBetween, statVisits, type StatVisit } from "../db/repo";
import { addDays, addMinutes, fromLocalStamp, startOfDay, startOfWeek, toDateKey } from "../lib/dates";
import { initial, money, pastelFor, plural } from "../lib/format";
import { CountUp, useNow } from "../components/common";
import { Icon } from "../components/Icon";

type Period = "week" | "month" | "year";

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_DAT = ["январю", "февралю", "марту", "апрелю", "маю", "июню", "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WD_FULL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const PERIOD_END = { week: "недели", month: "месяца", year: "года" };

/** Monday-first weekday index. */
const weekday = (d: Date) => (d.getDay() + 6) % 7;
const dayLabel = (d: Date) => `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${WD_FULL[weekday(d)]}`;

function rangeOf(period: Period, offset: number, now: Date) {
  if (period === "week") {
    const start = addDays(startOfWeek(now), 7 * offset);
    return { start, end: addDays(start, 7) };
  }
  if (period === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth() + offset, 1), end: new Date(now.getFullYear(), now.getMonth() + offset + 1, 1) };
  }
  return { start: new Date(now.getFullYear() + offset, 0, 1), end: new Date(now.getFullYear() + offset + 1, 0, 1) };
}

type Bucket = { tick: string; full: string };

function bucketsOf(period: Period, start: Date, end: Date): Bucket[] {
  if (period === "year") return MONTHS.map((m, i) => ({ tick: MONTHS_SHORT[i], full: `${m} ${start.getFullYear()}` }));
  const out: Bucket[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) {
    const tick = period === "week" ? WD[weekday(d)] : [1, 8, 15, 22, 29].includes(d.getDate()) ? String(d.getDate()) : "";
    out.push({ tick, full: dayLabel(d) });
  }
  return out;
}

function bucketOf(period: Period, start: Date, d: Date) {
  if (period === "year") return d.getMonth();
  if (period === "month") return d.getDate() - 1;
  return Math.round((startOfDay(d).getTime() - start.getTime()) / 86_400_000);
}

function rangeLabel(period: Period, start: Date, end: Date) {
  if (period === "year") return String(start.getFullYear());
  if (period === "month") return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  const last = addDays(end, -1);
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} — ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`;
}

function compareLabel(period: Period, prevStart: Date) {
  if (period === "year") return `к ${prevStart.getFullYear()}`;
  if (period === "month") return `к ${MONTHS_DAT[prevStart.getMonth()]}`;
  return "к прошлой неделе";
}

/** Bookings with procedures that were later removed still group by the name they were booked with. */
const procKey = (v: StatVisit) => v.procedure_id ?? `name:${v.proc_name}`;
/** What a visit brings: the paid amount once entered, otherwise the price list. */
const amountOf = (v: StatVisit) => v.paid ?? v.price;

function sumBy<T>(items: T[], key: (t: T) => string, value: (t: T) => number) {
  const m = new Map<string, number>();
  for (const t of items) m.set(key(t), (m.get(key(t)) ?? 0) + value(t));
  return m;
}

const visitsWord = (n: number) => `${n} ${plural(n, "визит", "визита", "визитов")}`;

export function StatsPage() {
  useDbVersion();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const period = (["week", "month", "year"].includes(params.get("p") ?? "") ? params.get("p") : "month") as Period;
  const offset = Number(params.get("o") ?? 0) || 0;
  const proc = params.get("proc");
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const { start, end } = rangeOf(period, offset, now);
  const prev = rangeOf(period, offset - 1, now);
  const ended = (v: StatVisit) => addMinutes(fromLocalStamp(v.starts_at), v.minutes) <= now;

  const all = statVisits(toDateKey(start), toDateKey(end));
  const byProc = (v: StatVisit) => !proc || procKey(v) === proc;
  const visits = all.filter(byProc);
  const done = visits.filter(ended);

  // Procedure chips: every procedure booked in this period, plus the picked one even if it has none here.
  const procNames = new Map<string, string>();
  for (const v of all) procNames.set(procKey(v), v.proc_name);
  const chips = [...procNames.entries()];
  if (proc && !procNames.has(proc)) chips.push([proc, "Выбранная процедура"]);

  const earned = done.reduce((s, v) => s + amountOf(v), 0);
  const planned = visits.filter((v) => !ended(v)).reduce((s, v) => s + amountOf(v), 0);

  // Compare with the previous period up to the same point, so a month in progress is not set against a whole one.
  const ongoing = now >= start && now < end;
  const limit = ongoing ? new Date(prev.start.getTime() + (now.getTime() - start.getTime())) : prev.end;
  const prevEarned = statVisits(toDateKey(prev.start), toDateKey(prev.end))
    .filter(byProc)
    .filter((v) => ended(v) && fromLocalStamp(v.starts_at) < limit)
    .reduce((s, v) => s + amountOf(v), 0);
  const delta = prevEarned > 0 ? Math.round(((earned - prevEarned) / prevEarned) * 100) : null;

  const dogs = new Set(done.map((v) => v.dog_id));
  const over = done.reduce((s, v) => s + (v.paid != null ? Math.max(0, v.paid - v.price) : 0), 0);

  const buckets = bucketsOf(period, start, end).map((b) => ({ ...b, earned: 0, planned: 0 }));
  for (const v of visits) {
    const b = buckets[bucketOf(period, start, fromLocalStamp(v.starts_at))];
    if (!b) continue;
    if (ended(v)) b.earned += amountOf(v);
    else b.planned += amountOf(v);
  }

  const procRows = [...sumBy(all.filter(ended), procKey, amountOf).entries()]
    .map(([key, amount]) => ({ key, amount, name: procNames.get(key) ?? "", count: all.filter((v) => ended(v) && procKey(v) === key).length }))
    .sort((a, b) => b.amount - a.amount);
  const procTotal = procRows.reduce((s, r) => s + r.amount, 0);

  const wd = WD.map(() => 0);
  for (const v of done) wd[weekday(fromLocalStamp(v.starts_at))] += amountOf(v);
  const best = earned > 0 ? wd.indexOf(Math.max(...wd)) : -1;

  const dogRows = [...sumBy(done, (v) => v.dog_id, amountOf).entries()]
    .map(([id, amount]) => ({ id, amount, name: done.find((v) => v.dog_id === id)!.dog_name, count: done.filter((v) => v.dog_id === id).length }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Cosmetics: how many visits in the period used each product.
  const visitIds = new Set(visits.map((v) => v.id));
  const uses = productUsesBetween(toDateKey(start), toDateKey(end)).filter((u) => visitIds.has(u.appointment_id));
  const productRows = [...sumBy(uses, (u) => u.product_id, () => 1).entries()]
    .map(([id, count]) => {
      const u = uses.find((x) => x.product_id === id)!;
      return { id, count, name: u.product_name, brand: u.brand_name, dogs: new Set(uses.filter((x) => x.product_id === id).map((x) => x.dog_id)).size };
    })
    .sort((a, b) => b.count - a.count);
  const brandRows = [...sumBy(uses, (u) => u.brand_id, () => 1).entries()]
    .map(([id, count]) => ({ id, count, name: uses.find((u) => u.brand_id === id)!.brand_name }))
    .sort((a, b) => b.count - a.count);
  const usedIds = new Set(uses.map((u) => u.product_id));
  const catalog = listProducts();
  const unused = catalog.filter((p) => !usedIds.has(p.id));
  const filledVisits = new Set(uses.map((u) => u.appointment_id)).size;

  return (
    <div className="stats">
      <header className="page-head">
        <div className="titles">
          <h1>Статистика</h1>
          <p className="small muted bold">
            Заработано — только прошедшие визиты: сколько оплатили, а если не вписано — по прайсу. Будущие записи идут в «ожидается». Отменённые не считаются.
          </p>
        </div>
        <div className="row st-nav">
          <button className="btn icon" aria-label="Предыдущий период" onClick={() => set({ o: String(offset - 1) })}>
            <Icon name="left" />
          </button>
          <span className="st-range">{rangeLabel(period, start, end)}</span>
          <button className="btn icon" aria-label="Следующий период" onClick={() => set({ o: String(offset + 1) })}>
            <Icon name="right" />
          </button>
        </div>
      </header>

      <div className="st-filters">
        <div className="st-segments" role="group" aria-label="Период">
          {(
            [
              ["week", "Неделя"],
              ["month", "Месяц"],
              ["year", "Год"],
            ] as [Period, string][]
          ).map(([p, label]) => (
            <button key={p} className={period === p ? "on" : ""} aria-pressed={period === p} onClick={() => set({ p, o: null })}>
              {label}
            </button>
          ))}
        </div>
        {offset !== 0 && (
          <button className="btn link small" onClick={() => set({ o: null })}>
            ← К текущему
          </button>
        )}
        {chips.length > 0 && (
          <div className="st-chips" role="group" aria-label="Процедура">
            <button className={`chip${!proc ? " on" : ""}`} aria-pressed={!proc} onClick={() => set({ proc: null })}>
              Все процедуры
            </button>
            {chips.map(([key, name]) => (
              <button key={key} className={`chip${proc === key ? " on" : ""}`} aria-pressed={proc === key} onClick={() => set({ proc: key })}>
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="st-tiles">
        <section className="card st-hero">
          <span className="small bold muted">Заработано{proc ? ` · ${procNames.get(proc) ?? ""}` : ""}</span>
          <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
            <span className="st-big">
              <CountUp value={earned} format={(n) => money(Math.round(n))} />
            </span>
            {delta !== null && (
              <span className={`st-delta${delta < 0 ? " down" : ""}`}>
                {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                {Math.abs(delta)}% {compareLabel(period, prev.start)}
              </span>
            )}
          </div>
          {planned > 0 && (
            <span className="row small bold muted" style={{ gap: 8 }}>
              <span className="st-swatch planned" aria-hidden="true" />
              ещё {money(planned)} ожидается до конца {PERIOD_END[period]}
            </span>
          )}
        </section>
        <section className="card st-tile">
          <span className="small bold muted">Визитов</span>
          <span className="st-mid">
            <CountUp value={done.length} />
          </span>
          <span className="tiny bold muted">
            {dogs.size} {plural(dogs.size, "собака", "собаки", "собак")}
          </span>
        </section>
        <section className="card st-tile">
          <span className="small bold muted">Средний чек</span>
          <span className="st-mid">
            <CountUp value={done.length ? earned / done.length : 0} format={(n) => money(Math.round(n))} />
          </span>
          <span className="tiny bold muted">за один визит</span>
        </section>
      </div>

      <DaysChart key={`${period}${offset}`} period={period} buckets={buckets} todayIndex={ongoing ? bucketOf(period, start, now) : -1} />

      <div className="st-grid">
        <section className="card" aria-label="По процедурам">
          <h2>По процедурам</h2>
          {procRows.length === 0 && <p className="small muted bold">Пока нет прошедших визитов</p>}
          {procRows.map((r) => (
            <button key={r.key} className={`st-row${proc === r.key ? " on" : ""}`} aria-pressed={proc === r.key} onClick={() => set({ proc: proc === r.key ? null : r.key })}>
              <span className="st-row-head">
                <span>{r.name}</span>
                <span>{money(r.amount)}</span>
              </span>
              <span className="st-track">
                <span className={`st-fill${proc && proc !== r.key ? " dim" : ""}`} style={{ width: `${(r.amount / procRows[0].amount) * 100}%` }} />
              </span>
              <span className="tiny bold muted">
                {visitsWord(r.count)} · {Math.round((r.amount / procTotal) * 100)}% дохода
              </span>
            </button>
          ))}
        </section>

        <section className="card" aria-label="По дням недели">
          <h2>По дням недели</h2>
          {best >= 0 ? (
            <p className="small muted bold">
              Самый денежный день — <b className="ink">{WD_FULL[best]}</b>
            </p>
          ) : (
            <p className="small muted bold">Пока нет прошедших визитов</p>
          )}
          <div className="st-week">
            {WD.map((d, i) => (
              <div key={d} className="st-week-col" role="img" aria-label={`${WD_FULL[i]}: ${wd[i] ? money(wd[i]) : "нет визитов"}`}>
                <span className="tiny bold">{i === best ? money(wd[i]) : ""}</span>
                <span className={`st-week-bar${i === best ? " best" : wd[i] ? "" : " zero"}`} style={{ height: Math.max(3, best >= 0 ? (wd[i] / wd[best]) * 100 : 0) }} />
                <span className="tiny bold muted">{d}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-label="Лучшие клиенты">
          <h2>Лучшие клиенты</h2>
          {dogRows.length === 0 && <p className="small muted bold">Пока нет прошедших визитов</p>}
          {dogRows.map((r) => (
            <Link key={r.id} to={`/dogs/${r.id}`} className="st-dog">
              <span className="avatar" style={{ width: 40, height: 40, background: pastelFor(r.id) }}>
                {initial(r.name)}
              </span>
              <span className="st-dog-body">
                <span className="st-row-head">
                  <span>{r.name}</span>
                  <span>{money(r.amount)}</span>
                </span>
                <span className="st-track thin">
                  <span className="st-fill" style={{ width: `${(r.amount / dogRows[0].amount) * 100}%` }} />
                </span>
                <span className="tiny bold muted">{visitsWord(r.count)}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>

      <div className="st-grid two">
        <section className="card" aria-label="Чаще всего из косметики">
          <h2>Косметика: чаще всего</h2>
          <p className="small muted bold">
            {filledVisits ? `Отмечена в ${filledVisits} ${plural(filledVisits, "визите", "визитах", "визитах")}` : "В визитах этого периода косметику не отмечали"}
          </p>
          {productRows.slice(0, 6).map((r) => (
            <div key={r.id} className="st-row static">
              <span className="st-row-head">
                <span>
                  {r.name}
                  <span className="muted"> · {r.brand}</span>
                </span>
                <span>{r.count}×</span>
              </span>
              <span className="st-track">
                <span className="st-fill" style={{ width: `${(r.count / productRows[0].count) * 100}%` }} />
              </span>
              <span className="tiny bold muted">
                {r.dogs} {plural(r.dogs, "собака", "собаки", "собак")}
              </span>
            </div>
          ))}
        </section>

        <section className="card" aria-label="Косметика по брендам">
          <h2>Косметика по брендам</h2>
          {brandRows.length === 0 && <p className="small muted bold">Пока нечего показать</p>}
          {brandRows.map((r) => (
            <div key={r.id} className="st-row static">
              <span className="st-row-head">
                <span>{r.name}</span>
                <span>{Math.round((r.count / uses.length) * 100)}%</span>
              </span>
              <span className="st-track">
                <span className="st-fill" style={{ width: `${(r.count / brandRows[0].count) * 100}%` }} />
              </span>
              <span className="tiny bold muted">
                {r.count} {plural(r.count, "раз", "раза", "раз")}
              </span>
            </div>
          ))}
          {catalog.length > 0 && (
            <div className="st-unused">
              <span className="small bold">
                Не пригодились за период: {unused.length} из {catalog.length}
              </span>
              {unused.length > 0 && (
                <span className="tiny bold muted">
                  {unused
                    .slice(0, 8)
                    .map((p) => p.name)
                    .join(", ")}
                  {unused.length > 8 ? ` и ещё ${unused.length - 8}` : ""}
                </span>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="st-grid two">
        <section className="card st-fun">
          <span className="st-fun-icon green" aria-hidden="true">
            <Icon name="heart" size={26} />
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="st-mid">
              +<CountUp value={over} format={(n) => money(Math.round(n))} />
            </span>
            <span className="small bold muted">оплатили сверх прайса — чаевые и доплаты</span>
          </span>
        </section>
        <section className="card st-fun butter">
          <span className="st-fun-icon" aria-hidden="true">
            <Icon name="coffee" size={26} />
          </span>
          <span className="stack" style={{ gap: 2 }}>
            <span className="st-mid">
              <CountUp value={Math.floor(earned / 10)} /> коф
            </span>
            <span className="small bold muted">столько кофе можно купить на заработанное, по 10 ₾ за штуку</span>
          </span>
        </section>
      </div>
    </div>
  );
}

function DaysChart({ period, buckets, todayIndex }: { period: Period; buckets: (Bucket & { earned: number; planned: number })[]; todayIndex: number }) {
  const lastWithData = buckets.reduce((last, b, i) => (b.earned || b.planned ? i : last), 0);
  const [sel, setSel] = useState(todayIndex >= 0 ? todayIndex : lastWithData);
  const top = Math.max(10, ...buckets.map((b) => b.earned + b.planned));
  const step = top > 1000 ? 500 : top > 300 ? 100 : 50;
  const max = Math.ceil(top / step) * step;
  const describe = (b: (typeof buckets)[number]) =>
    [b.earned ? `заработано ${money(b.earned)}` : "", b.planned ? `ожидается ${money(b.planned)}` : "", !b.earned && !b.planned ? "записей нет" : ""].filter(Boolean);
  const current = buckets[sel] ?? buckets[0];

  return (
    <section className="card" aria-label={period === "year" ? "Доход по месяцам" : "Доход по дням"}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{period === "year" ? "По месяцам" : "По дням"}</h2>
        <div className="row tiny bold muted" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 6 }}>
            <span className="st-swatch" aria-hidden="true" />
            Заработано
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="st-swatch planned" aria-hidden="true" />
            Ожидается
          </span>
        </div>
      </div>
      <div className="st-info" role="status">
        {[current.full, ...describe(current)].join(" · ")}
      </div>
      <div className="st-chart">
        <span className="st-gridline" aria-hidden="true">
          {money(max)}
        </span>
        <span className="st-gridline mid" aria-hidden="true">
          {money(max / 2)}
        </span>
        <div className="st-bars">
          {buckets.map((b, i) => (
            <button
              key={i}
              type="button"
              className={`st-col${i === sel ? " on" : ""}`}
              aria-label={`${b.full}: ${describe(b).join(", ")}`}
              onClick={() => setSel(i)}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
            >
              <span className="st-plot">
                {b.planned > 0 && <span className={`st-seg planned${b.earned ? " gap" : ""}`} style={{ height: `${(b.planned / max) * 100}%` }} />}
                {b.earned > 0 && <span className={`st-seg${b.planned ? " flat" : ""}`} style={{ height: `${(b.earned / max) * 100}%` }} />}
              </span>
              <span className="st-tick">{b.tick}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="tiny bold muted">Наведи или тапни на столбик — покажу сумму</p>
    </section>
  );
}
