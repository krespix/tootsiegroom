import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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
          </Route>
        </Routes>
      </HashRouter>
    </StrictMode>,
  );
}

void start();
