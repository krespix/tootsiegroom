import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDbVersion } from "../db/db";
import {
  dogAppointments,
  dogOwnersMap,
  dogsWithUpcoming,
  dogTagsMap,
  getDog,
  lastVisits,
  listDogs,
  ownersOf,
  saveDog,
  tagsOf,
  usedProducts,
  type Dog,
  type Owner,
} from "../db/repo";
import { ageLabel, dayMonth, fromLocalStamp, hhmm, weeksAgo } from "../lib/dates";
import { money, plural } from "../lib/format";
import { Avatar, PhotoSlot, SearchBox, Thumb, useDesktop } from "../components/common";
import { Icon } from "../components/Icon";

type Filter = "all" | "booked" | "long";

function DogList({ selected }: { selected?: string }) {
  const dogs = listDogs();
  const upcoming = dogsWithUpcoming();
  const last = lastVisits();
  const tagMap = dogTagsMap();
  const ownerMap = dogOwnersMap();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const longAgo = (d: Dog) => {
    const l = last.get(d.id);
    return !!l && !upcoming.has(d.id) && Date.now() - fromLocalStamp(l).getTime() > 8 * 7 * 86_400_000;
  };
  const q = query.trim().toLowerCase();
  const haystack = (d: Dog) =>
    [d.name, d.breed, ...(ownerMap.get(d.id) ?? []).flatMap((o) => [o.name, o.phone]), ...(tagMap.get(d.id) ?? []).map((t) => t.name)]
      .join(" ")
      .toLowerCase();
  const shown = dogs
    .filter((d) => !q || haystack(d).includes(q))
    .filter((d) => (filter === "booked" ? upcoming.has(d.id) : filter === "long" ? longAgo(d) : true));

  return (
    <section className="stack" aria-label="Список собак" style={{ gap: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
        <h1>Собаки</h1>
        <Link to="/dogs/new" className="btn primary">
          <Icon name="plus" size={18} /> Собака
        </Link>
      </div>
      <SearchBox value={query} onChange={setQuery} placeholder="Кличка, порода, хозяин, особенность" />
      <div className="row" style={{ gap: 8 }}>
        {(
          [
            ["all", `Все · ${dogs.length}`],
            ["booked", "Записаны"],
            ["long", "Давно не были"],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button key={f} className={`chip${filter === f ? " on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>
      {dogs.length === 0 && (
        <div className="empty">
          Пока ни одной собаки
          <Link to="/dogs/new" className="btn primary">
            Добавить первую
          </Link>
        </div>
      )}
      <div className="stack" style={{ gap: 10 }}>
        {shown.map((d) => (
          <Link
            key={d.id}
            to={`/dogs/${d.id}`}
            className="pick"
            style={{ textDecoration: "none", ...(d.id === selected ? { background: "var(--tint)", borderColor: "var(--tint)" } : {}) }}
          >
            <Avatar id={d.id} name={d.name} photo={d.photo} size={52} />
            <span className="col" style={{ flex: 1 }}>
              <span style={{ fontFamily: "var(--head)", fontWeight: 700 }}>{d.name}</span>
              <span className="small bold muted">
                {[d.breed, ageLabel(d.birthday), (ownerMap.get(d.id) ?? []).map((o) => o.name).filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
              </span>
            </span>
            {upcoming.has(d.id) && <span className="badge-done">записана</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function OwnerRow({ owner, label = "Хозяин" }: { owner: Owner; label?: string }) {
  const tg = owner.telegram.replace(/^@/, "");
  return (
    <div className="row" style={{ padding: "12px 14px", borderRadius: 16, background: "var(--bg)" }}>
      <div className="stack" style={{ gap: 0, flex: "1 1 160px" }}>
        <span className="small bold muted">{label}</span>
        <span className="bold">{[owner.name, owner.phone].filter(Boolean).join(" · ")}</span>
      </div>
      {owner.phone && (
        <a href={`tel:${owner.phone}`} className="btn">
          <Icon name="phone" size={16} /> Позвонить
        </a>
      )}
      {tg && (
        <a href={`https://t.me/${tg}`} target="_blank" rel="noreferrer" className="btn">
          <Icon name="send" size={16} /> Telegram
        </a>
      )}
    </div>
  );
}

function DogDetail({ dog }: { dog: Dog }) {
  const visits = dogAppointments(dog.id);
  const tags = tagsOf(dog.id);
  const owners = ownersOf(dog.id);
  const facts = [dog.breed, dog.sex, dog.weight && `${dog.weight} кг`].filter(Boolean).join(" · ");

  return (
    <article className="stack" style={{ gap: 20 }} aria-label="Карточка собаки">
      <div className="card" style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
        <PhotoSlot name={dog.photo} label="Фото собаки" tint="#FFD6E5" width={170} height={170} onChange={(photo) => saveDog({ ...dog, photo })} />
        <div className="stack" style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: 4 }}>
              <h1>{dog.name}</h1>
              {facts && <p className="bold">{facts}</p>}
            </div>
            <Link to={`/dogs/${dog.id}/edit`} className="btn">
              <Icon name="edit" size={16} /> Изменить
            </Link>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {dog.birthday && (
              <span className="tag" style={{ background: "#FFE9A8" }}>
                <Icon name="cake" size={16} /> {dayMonth(fromLocalStamp(dog.birthday))} {fromLocalStamp(dog.birthday).getFullYear()} · {ageLabel(dog.birthday)}
              </span>
            )}
            {tags.map((t, i) => (
              <span key={t.id} className="tag" style={{ background: ["#CFF3E9", "#E4DDFF", "#D4ECFF", "#FFD6E5"][i % 4] }}>
                {t.name}
              </span>
            ))}
          </div>
          {owners.map((o) => (
            <OwnerRow key={o.id} owner={o} />
          ))}
        </div>
      </div>

      <div className="split">
        {dog.notes && (
          <section className="card butter side">
            <h2>Заметки</h2>
            <p style={{ lineHeight: 1.5, whiteSpace: "pre-line" }}>{dog.notes}</p>
          </section>
        )}
        <section className="card grow" style={{ flexBasis: 380 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>
              {visits.length} {plural(visits.length, "визит", "визита", "визитов")}
            </h2>
            <Link to={`/book?dog=${dog.id}`} className="btn primary">
              Записать
            </Link>
          </div>
          {visits.length === 0 && <p className="small muted bold">Ещё не было визитов</p>}
          {visits.map((a) => {
            const start = fromLocalStamp(a.starts_at);
            const past = start <= new Date();
            const products = usedProducts(a.id);
            return (
              <div key={a.id} className="timeline-item">
                <span className="timeline-dot" style={past ? undefined : { background: "var(--pink)" }} />
                <div className="timeline-body">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <Link to={`/appt/${a.id}`} className="bold" style={{ textDecoration: "none" }}>
                      {dayMonth(start)} · {a.proc_name}
                      {a.variant_name ? `, ${a.variant_name.toLowerCase()}` : ""}
                    </Link>
                    <span className="small bold muted">
                      {a.status === "cancelled" ? "отменена" : past ? `${weeksAgo(a.starts_at)} · ${a.paid != null ? `оплачено ${money(a.paid)}` : money(a.price)}` : `${hhmm(start)} · запланирована`}
                    </span>
                  </div>
                  {a.status !== "cancelled" && past && !a.filled_at && (
                    <div className="row">
                      <span className="badge-todo">визит не заполнен</span>
                      <Link to={`/appt/${a.id}`} className="small bold">
                        Заполнить визит →
                      </Link>
                    </div>
                  )}
                  {products.length > 0 && (
                    <div className="row" style={{ gap: 6 }}>
                      {products.map((p) => (
                        <span key={p.id} className="tag">
                          {p.brand_name} · {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {a.notes && <p className="small" style={{ lineHeight: 1.5, whiteSpace: "pre-line" }}>{a.notes}</p>}
                  {(a.photo_before || a.photo_after) && (
                    <div className="row">
                      <Thumb name={a.photo_before} label="до" />
                      <Thumb name={a.photo_after} label="после" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </article>
  );
}

export function DogsPage() {
  useDbVersion();
  const desktop = useDesktop();
  const { id } = useParams();
  const dog = id ? getDog(id) : undefined;

  if (!desktop) {
    if (!id) return <DogList />;
    return (
      <>
        <Link to="/dogs" className="btn link row small muted" style={{ alignSelf: "flex-start", gap: 4, textDecoration: "none" }}>
          <Icon name="left" size={18} /> Все собаки
        </Link>
        {dog ? <DogDetail dog={dog} /> : <div className="empty">Собака не найдена</div>}
      </>
    );
  }

  return (
    <div className="split">
      <div className="side" style={{ flex: "1 1 320px", maxWidth: 400 }}>
        <DogList selected={id} />
      </div>
      <div className="grow">{dog ? <DogDetail dog={dog} /> : <div className="empty">Выбери собаку слева</div>}</div>
    </div>
  );
}
