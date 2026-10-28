import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  countDogAppointments,
  deleteDog,
  emptyDog,
  getDog,
  listBreeds,
  listOwners,
  listTags,
  ownersOf,
  saveDog,
  tagsOf,
  type DogInput,
  type OwnerInput,
} from "../db/repo";
import { askConfirm } from "../lib/dialog";
import { plural } from "../lib/format";
import { PhotoSlot } from "../components/common";
import { OwnersEditor, Suggest, TagEditor } from "../components/pickers";
import { Icon } from "../components/Icon";

export function DogFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const existing = id ? getDog(id) : undefined;
  const [d, setD] = useState<DogInput>(() => existing ?? emptyDog());
  const [tags, setTags] = useState<string[]>(() => (existing ? tagsOf(existing.id).map((t) => t.name) : []));
  const [owners, setOwners] = useState<OwnerInput[]>(() => (existing ? ownersOf(existing.id) : []));
  const set = <K extends keyof DogInput>(k: K, v: DogInput[K]) => setD((x) => ({ ...x, [k]: v }));

  const breeds = listBreeds();
  const allTags = listTags().map((t) => t.name);
  const knownOwners = listOwners();

  const save = () => {
    if (!d.name.trim()) return;
    const savedId = saveDog({ ...d, name: d.name.trim() }, { tags, owners });
    nav(`/dogs/${savedId}`, { replace: true });
  };

  const remove = async () => {
    if (!existing) return;
    const n = countDogAppointments(existing.id);
    const ok = await askConfirm({
      title: `Удалить ${existing.name}?`,
      text: n ? `Вместе с ${n} ${plural(n, "записью", "записями", "записями")} и историей визитов. Это не отменить.` : "Это не отменить.",
      okText: "Удалить",
      danger: true,
    });
    if (!ok) return;
    deleteDog(existing.id);
    nav("/dogs", { replace: true });
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
              <Suggest
                label="Порода"
                value={d.breed}
                onChange={(v) => set("breed", v)}
                onPick={(o) => set("breed", o.label)}
                options={breeds.map((b) => ({ key: b, label: b }))}
                showAllOnFocus
              />
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
            <div className="field">
              Особенности
              <span className="hint">Выбери из списка или впиши новую</span>
              <TagEditor value={tags} onChange={setTags} all={allTags} />
            </div>
            <label className="field">
              Заметки
              <textarea className="input" rows={4} value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Как стричь, что любит, чего боится" />
            </label>
          </section>
        </div>

        <aside className="side">
          <section className="card">
            <h2>{owners.length > 1 ? "Хозяева" : "Хозяин"}</h2>
            <OwnersEditor value={owners} onChange={setOwners} known={knownOwners} />
          </section>
          <button className="btn primary big wide" disabled={!d.name.trim()} onClick={save}>
            Сохранить
          </button>
          {existing && (
            <button className="btn link danger" style={{ alignSelf: "center" }} onClick={remove}>
              Удалить собаку
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
