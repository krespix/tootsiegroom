import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { openDb } from "./db/db";
import { initSync } from "./sync/sync";
import { Layout } from "./components/Layout";
import { CalendarPage } from "./pages/CalendarPage";
import { DogsPage } from "./pages/DogsPage";
import { DogFormPage } from "./pages/DogFormPage";
import { BookPage } from "./pages/BookPage";
import { ApptPage } from "./pages/ApptPage";
import { CosmeticsPage } from "./pages/CosmeticsPage";
import { ProceduresPage } from "./pages/ProceduresPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CrashScreen } from "./components/ErrorBoundary";
import { StatsPage } from "./pages/StatsPage";

// A home-screen app can stay in memory for days, so look for a new version
// whenever it comes to the foreground; autoUpdate reloads once it is installed.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && navigator.onLine) void reg.update();
    });
  },
});

async function start() {
  await openDb();
  // Don't block the first paint on the network; sync catches up in the background.
  void initSync();

  // Hash routing: GitHub Pages has no server-side fallback for deep links.
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<CalendarPage />} />
            <Route path="dogs" element={<DogsPage />} />
            <Route path="dogs/new" element={<DogFormPage />} />
            <Route path="dogs/:id" element={<DogsPage />} />
            <Route path="dogs/:id/edit" element={<DogFormPage />} />
            <Route path="book" element={<BookPage />} />
            <Route path="appt/:id" element={<ApptPage />} />
            <Route path="cosmetics" element={<CosmeticsPage />} />
            <Route path="procedures" element={<ProceduresPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="stats" element={<StatsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </StrictMode>,
  );
}

/** The logo shown by index.html until the app has drawn its first screen. */
function hideBoot() {
  const boot = document.getElementById("boot");
  if (!boot) return;
  boot.classList.add("gone");
  window.setTimeout(() => boot.remove(), 400);
}

start()
  .then(hideBoot)
  .catch((error) => {
    // The base could not open (storage blocked, a broken update…): say so instead of a blank page.
    createRoot(document.getElementById("root")!).render(<CrashScreen error={error} />);
    hideBoot();
  });
