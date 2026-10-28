# TootsieGroom

Заметки груминг-салона: собаки, записи, процедуры с подтипами, косметика по брендам, журнал визитов.

Веб-приложение (PWA), которое ставится на экран «Домой» айфона и в Dock мака. Сервера нет:

- база — SQLite прямо в браузере ([sql.js](https://sql.js.org)), своя копия на каждом устройстве;
- синхронизация — файл базы целиком через Dropbox (папка приложения): скачиваем при открытии, заливаем после изменений, последняя запись побеждает;
- фото сжимаются до ~1600px JPEG и лежат отдельными файлами в `photos/` в Dropbox, в базе только имя файла;
- Apple Календарь — кнопкой «В Apple Календарь» (файл .ics).

Код выкладывается на GitHub Pages автоматически при пуше в `main`. Данных там нет — только код.

## Разработка

```sh
npm install
echo "VITE_DROPBOX_APP_KEY=<app key>" > .env.local
npm run dev        # http://localhost:5173
npm run build      # проверка типов + сборка в dist/
```

Иконки генерируются из `public/logo.svg`: `npm run icons`.

## Dropbox: настройка один раз

1. Зайти на <https://www.dropbox.com/developers/apps> **под тем Dropbox, где будут храниться данные** (лучше Наташиным) и нажать **Create app**.
2. **Choose an API** → *Scoped access*. **Type of access** → *App folder*. Имя — любое уникальное, например `TootsieGroom-Natasha`. Create app.
3. Вкладка **Permissions** → отметить `files.metadata.read`, `files.content.write`, `files.content.read` → **Submit** внизу.
4. Вкладка **Settings**:
   - **App key** — скопировать (секрет не нужен).
   - **Allow public clients (Implicit Grant & PKCE)** — *Allow*.
   - Redirect URI добавлять не нужно: приложение показывает код, который вставляется вручную.
   - Если входить будет другой аккаунт Dropbox, а не владелец приложения, — нажать **Enable additional users**.
5. Положить ключ в GitHub: репозиторий → Settings → Secrets and variables → Actions → вкладка **Variables** → *New repository variable* `DROPBOX_APP_KEY` = App key. Затем Actions → *Deploy to GitHub Pages* → *Run workflow*.

App key — публичный идентификатор (вход через PKCE, без секрета), его не страшно держать в сборке.

## Установка

- **iPhone**: открыть адрес в Safari → «Поделиться» → «На экран „Домой“».
- **Mac**: Safari → «Файл» → «Добавить в Dock» (или Chrome → «Установить приложение»).
- На каждом устройстве: «Настройки» → «Открыть Dropbox» → «Разрешить» → вставить код → «Подключить».
