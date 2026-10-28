import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { emptyDog, getDog, saveDog, type DogInput } from "../db/repo";
import { PhotoSlot } from "../components/common";
import { Icon } from "../components/Icon";

export function DogFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const existing = id ? getDog(id) : undefined;
  const [d, setD] = useState<DogInput>(() => existing ?? emptyDog());
  const set = <K extends keyof DogInput>(k: K, v: DogInput[K]) => setD((x) => ({ ...x, [k]: v }));

  const save = () => {
    if (!d.name.trim()) return;
    const savedId = saveDog({ ...d, name: d.name.trim() });
    nav(`/dogs/${savedId}`, { replace: true });
  };

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <Link to={existing ? `/dogs/${existing.id}` : "/dogs"} className="row small bold muted" style={{ textDecoration: "none", gap: 4 }}>
            <Icon name="left" size={18} /> Назад
          </Link>
          <h1>{existing ? existing.name : "Новая собака"}</h1>
        </div>
      </header>

      <div className="split">
        <div className="grow">
          <section className="card">
            <h2>Собака</h2>
            <PhotoSlot name={d.photo} label="Фото собаки" tint="#FFD6E5" width={170} height={170} onChange={(n) => set("photo", n)} />
            <div className="grid-auto" style={{ ["--min" as string]: "200px", gap: 14 }}>
              <label className="field">
                Кличка
                <input className="input" value={d.name} onChange={(e) => set("name", e.target.value)} autoFocus={!existing} />
              </label>
              <label className="field">
                Порода
                <input className="input" value={d.breed} onChange={(e) => set("breed", e.target.value)} />
              </label>
              <label className="field">
                Пол
                <select className="input" value={d.sex} onChange={(e) => set("sex", e.target.value)}>
                  <option value="">—</option>
                  <option value="девочка">девочка</option>
                  <option value="мальчик">мальчик</option>
                </select>
              </label>
              <label className="field">
                Вес, кг
                <input className="input" inputMode="decimal" value={d.weight} onChange={(e) => set("weight", e.target.value)} />
              </label>
              <label className="field">
                День рождения
                <input className="input" type="date" value={d.birthday ?? ""} onChange={(e) => set("birthday", e.target.value || null)} />
              </label>
            </div>
            <label className="field">
              Особенности
              <span className="hint">Через запятую: боится фена, чувствительная кожа</span>
              <input className="input" value={d.tags} onChange={(e) => set("tags", e.target.value)} />
            </label>
            <label className="field">
              Заметки
              <textarea className="input" rows={4} value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Как стричь, что любит, чего боится" />
            </label>
          </section>
        </div>

        <aside className="side">
          <section className="card">
            <h2>Хозяин</h2>
            <label className="field">
              Имя
              <input className="input" value={d.owner_name} onChange={(e) => set("owner_name", e.target.value)} />
            </label>
            <label className="field">
              Телефон
              <input className="input" type="tel" value={d.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} />
            </label>
            <label className="field">
              Telegram
              <input className="input" value={d.owner_telegram} onChange={(e) => set("owner_telegram", e.target.value)} placeholder="@username" />
            </label>
          </section>
          <button className="btn primary big wide" disabled={!d.name.trim()} onClick={save}>
            Сохранить
          </button>
        </aside>
      </div>
    </>
  );
}
