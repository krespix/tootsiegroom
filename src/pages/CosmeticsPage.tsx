import { Fragment, useState } from "react";
import { useDbVersion } from "../db/db";
import { archiveProduct, listBrands, listProducts, productUsage, renameBrand, saveBrand, saveProduct, type Brand, type Product, type ProductInput } from "../db/repo";
import { PASTELS, plural } from "../lib/format";
import { askConfirm, askText } from "../lib/dialog";
import { usePhotoUrl } from "../lib/photos";
import { InlinePanel, PhotoSlot, SearchBox, useDesktop } from "../components/common";
import { Icon } from "../components/Icon";

function ProductRow({ p, uses, color, onOpen }: { p: Product; uses: number; color: string; onOpen: () => void }) {
  const url = usePhotoUrl(p.photo);
  return (
    <button type="button" className="pick" style={{ background: "var(--bg)" }} onClick={onOpen}>
      <span className="avatar" style={{ width: 52, height: 52, background: color }}>
        {url ? <img src={url} alt="" /> : <Icon name="bottle" size={26} stroke={1.8} />}
      </span>
      <span className="col" style={{ gap: 2 }}>
        <span className="bold">{p.name}</span>
        <span className="small bold muted">
          {uses} {plural(uses, "визит", "визита", "визитов")}
        </span>
      </span>
    </button>
  );
}

function ProductEditor({ initial, brands, lines, onDone }: { initial: ProductInput; brands: Brand[]; lines: (brandId: string) => string[]; onDone: () => void }) {
  const [p, setP] = useState(initial);
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setP((x) => ({ ...x, [k]: v }));
  const valid = p.name.trim() && p.brand_id;
  return (
    <section className="card">
      <h2>{p.id ? "Средство" : "Новое средство"}</h2>
      <PhotoSlot name={p.photo} label="Сфоткать флакон" tint="var(--bg)" width="100%" height={130} onChange={(n) => set("photo", n)} />
      <label className="field">
        Бренд
        <select className="input" value={p.brand_id} onChange={(e) => set("brand_id", e.target.value)}>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Линейка <span className="hint">необязательно</span>
        <input className="input" list="lines" value={p.line} onChange={(e) => set("line", e.target.value)} placeholder="Например, Отбеливание" />
        <datalist id="lines">
          {lines(p.brand_id).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </label>
      <label className="field">
        Название
        <input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Как написано на флаконе" />
      </label>
      <label className="field">
        Описание
        <textarea className="input" rows={3} value={p.description} onChange={(e) => set("description", e.target.value)} placeholder="Для кого, как разводить, на что была реакция" />
      </label>
      <button
        className="btn primary big wide"
        disabled={!valid}
        onClick={() => {
          saveProduct({ ...p, name: p.name.trim(), line: p.line.trim() });
          onDone();
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
              const ok = await askConfirm({
                title: `Убрать «${p.name}»?`,
                text: "Из справочника исчезнет, в истории визитов останется.",
                okText: "Убрать",
                danger: true,
              });
              if (ok) {
                archiveProduct(p.id!);
                onDone();
              }
            }}
          >
            Убрать из справочника
          </button>
        )}
      </div>
    </section>
  );
}

export function CosmeticsPage() {
  useDbVersion();
  const brands = listBrands();
  const products = listProducts();
  const usage = productUsage();
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ProductInput | null>(null);
  const desktop = useDesktop();

  const addBrand = async () => {
    const name = await askText({ title: "Новый бренд", placeholder: "Например, Гидра", okText: "Добавить" });
    if (name) setBrandFilter(saveBrand(name, PASTELS[brands.length % PASTELS.length]));
  };
  const linesOf = (brandId: string) => [...new Set(products.filter((p) => p.brand_id === brandId && p.line).map((p) => p.line))];
  // Desktop edits in the side column; the phone opens the form right where it was tapped.
  const editor = editing && (
    <ProductEditor key={editing.id ?? "new"} initial={editing} brands={brands} lines={linesOf} onDone={() => setEditing(null)} />
  );
  const newProduct = (brandId: string) =>
    setEditing({ brand_id: brandId, line: "", name: "", description: "", photo: null, low_stock: 0 });

  const q = query.trim().toLowerCase();
  const matches = (p: Product) => !q || `${p.name} ${p.line} ${p.description}`.toLowerCase().includes(q);
  const shownBrands = brands.filter((b) => brandFilter === "all" || b.id === brandFilter);

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1>Косметика</h1>
          <p className="bold muted">
            {brands.length} {plural(brands.length, "бренд", "бренда", "брендов")} · {products.length} {plural(products.length, "средство", "средства", "средств")}
          </p>
        </div>
        <div className="row">
          <button className="btn" onClick={addBrand}>
            + Бренд
          </button>
          {brands.length > 0 && (
            <button className="btn primary" onClick={() => newProduct(brandFilter === "all" ? brands[0].id : brandFilter)}>
              <Icon name="plus" size={18} /> Средство
            </button>
          )}
        </div>
      </header>

      {brands.length === 0 ? (
        <div className="empty">
          Начни с бренда — например, Гидра, SHMM или Softcare
          <button className="btn primary" onClick={addBrand}>
            + Добавить бренд
          </button>
        </div>
      ) : (
        <>
          <SearchBox value={query} onChange={setQuery} placeholder="Средство во всех брендах" />
          <div className="row" role="group" aria-label="Бренд">
            <button className={`chip${brandFilter === "all" ? " on" : ""}`} onClick={() => setBrandFilter("all")}>
              Все бренды
            </button>
            {brands.map((b) => (
              <button key={b.id} className={`chip${brandFilter === b.id ? " on" : ""}`} style={brandFilter === b.id ? undefined : { background: b.color }} onClick={() => setBrandFilter(b.id)}>
                {b.name} · {products.filter((p) => p.brand_id === b.id).length}
              </button>
            ))}
          </div>

          <div className="split">
            <div className="grow">
              {shownBrands.map((b) => {
                const items = products.filter((p) => p.brand_id === b.id && matches(p));
                if (q && items.length === 0) return null;
                const groups = new Map<string, Product[]>();
                for (const p of items) groups.set(p.line, [...(groups.get(p.line) ?? []), p]);
                return (
                  <section key={b.id} className="card" aria-label={b.name}>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <span className="avatar" style={{ width: 44, height: 44, background: b.color }}>
                        {b.name.charAt(0).toUpperCase()}
                      </span>
                      <h2 style={{ flex: 1, fontSize: 22 }}>{b.name}</h2>
                      <button
                        className="btn icon"
                        aria-label={`Переименовать ${b.name}`}
                        onClick={async () => {
                          const name = await askText({ title: "Переименовать бренд", initial: b.name, okText: "Сохранить" });
                          if (name) renameBrand(b.id, name);
                        }}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button className="btn dashed" onClick={() => newProduct(b.id)}>
                        + средство
                      </button>
                    </div>
                    {!desktop && editing && !editing.id && editing.brand_id === b.id && <InlinePanel>{editor}</InlinePanel>}
                    {items.length === 0 && <p className="small muted bold">Пока пусто</p>}
                    {[...groups.entries()].map(([line, ps]) => (
                      <div key={line} className="stack" style={{ gap: 8 }}>
                        {line && <span className="label-caps">Линейка · {line}</span>}
                        <div className="grid-auto" style={{ ["--min" as string]: "260px" }}>
                          {ps.map((p) => (
                            <Fragment key={p.id}>
                              <ProductRow p={p} uses={usage.get(p.id) ?? 0} color={b.color} onOpen={() => setEditing(p)} />
                              {!desktop && editing?.id === p.id && <InlinePanel style={{ gridColumn: "1 / -1" }}>{editor}</InlinePanel>}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </div>
            {desktop && editing && <aside className="side">{editor}</aside>}
          </div>
        </>
      )}
    </>
  );
}
