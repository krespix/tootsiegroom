import { NavLink, Outlet } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { useSyncState } from "../sync/sync";
import { DialogHost } from "./DialogHost";
import { FlashHost } from "./common";

const SECTIONS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Календарь", icon: "calendar" },
  { to: "/dogs", label: "Собаки", icon: "paw" },
  { to: "/cosmetics", label: "Косметика", icon: "bottle" },
  { to: "/procedures", label: "Процедуры", icon: "scissors" },
  { to: "/stats", label: "Статистика", icon: "chart" },
];

export function SyncLabel() {
  const s = useSyncState();
  const text = {
    off: "Dropbox не подключён",
    idle: s.lastSyncAt ? `Синхронизировано ${new Date(s.lastSyncAt).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}` : "Dropbox подключён",
    syncing: "Синхронизирую…",
    offline: "Нет интернета — сохранено на устройстве",
    error: "Ошибка синхронизации",
  }[s.status];
  const color = s.status === "error" ? "var(--danger)" : s.status === "off" || s.status === "offline" ? "var(--amber-fg)" : "var(--muted)";
  return (
    <span className="tiny bold" style={{ color, display: "inline-flex", alignItems: "center", gap: 6 }}>
      <Icon name="cloud" size={14} />
      {text}
    </span>
  );
}

export function Layout() {
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Разделы">
        <NavLink to="/" className="logo">
          <img className="logo-mark" src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" />
          <span className="logo-text">
            Tootsie<span>Groom</span>
          </span>
        </NavLink>
        <div className="nav">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to} end={s.to === "/"}>
              <Icon name={s.icon} />
              {s.label}
            </NavLink>
          ))}
        </div>
        <NavLink to="/book" className="btn primary big">
          <Icon name="plus" size={18} stroke={2.5} />
          Новая запись
        </NavLink>
        <div className="spacer" />
        <div className="nav">
          <NavLink to="/settings">
            <Icon name="settings" />
            Настройки
          </NavLink>
        </div>
        <SyncLabel />
      </nav>

      <main className="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Разделы">
        <NavLink to="/" end className="tab">
          <Icon name="calendar" size={24} />
          Календарь
        </NavLink>
        <NavLink to="/dogs" className="tab">
          <Icon name="paw" size={24} />
          Собаки
        </NavLink>
        <NavLink to="/book" className="tab-fab" aria-label="Новая запись">
          <Icon name="plus" size={28} stroke={2.6} />
        </NavLink>
        <NavLink to="/cosmetics" className="tab">
          <Icon name="bottle" size={24} />
          Косметика
        </NavLink>
        <NavLink to="/procedures" className="tab">
          <Icon name="scissors" size={24} />
          Процедуры
        </NavLink>
      </nav>
      <DialogHost />
      <FlashHost />
    </div>
  );
}
