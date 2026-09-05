# Девлог

Состояние проекта на 4 сентября 2026. Файл для того, чтобы продолжить работу с
другой машины, не поднимая контекст заново.

## Что это

**Stampy** — SaaS карт лояльности для кофеен. Бумажная карточка со штампами
переехала в Telegram Mini App: гость прикладывает телефон к NFC-подставке на
кассе, получает штамп, после N штампов — бесплатный напиток по коду.

Все кофейни живут внутри **одного** общего бота: каждая регистрируется сама,
настраивает своё оформление и получает карту в том же мини-аппе. Отдельные боты
не заводятся.

Репозиторий: `github.com/asilJPG/nfs` (ветка `main`).
Vercel-проект: `nfsss` (`prj_DBV0FkqCxLIbuOkWSwZp96ypZo6O`).
Supabase: `qrfdpzigcarbethrsioe`.

## Стек

Next.js 15 (App Router, Server Actions, TypeScript, Tailwind 4) · Supabase
(Postgres + RLS + Auth + Storage) · Vercel (хостинг и cron) · Telegram Bot API.
Recharts для графиков, zod для валидации входа server actions.

Время в базе — UTC (`timestamptz`), аналитика и расписания считаются в
`Asia/Tashkent`.

## Что реализовано

### Роли и разделы

| Путь | Кто | Что уже работает |
|---|---|---|
| `/` | кофейня | лендинг |
| `/register` | кофейня | саморегистрация: название, логин, пароль; триал 30 дней |
| `/login` | кофейня | вход по логину и паролю |
| `/dashboard` | владелец, управляющий | аналитика, оформление карты, точки, метки, рассылки, подписка |
| `/staff` | бариста | выдать награду по коду, ручной штамп |
| `/admin` | платформа | кофейни, подписки, регистрация меток, заявки на комплекты |
| `/card` | гость | мини-апп: карта, штампы, награды |
| `/t` | — | эндпоинт NFC-касания |

### Путь одного штампа

1. Тап по метке → браузер открывает `/t?picc_data=…&cmac=…`.
2. `app/t/route.ts` расшифровывает PICCData, проверяет CMAC (`lib/nfc/sun.ts`),
   требует, чтобы счётчик касаний вырос — это защита от повтора ссылки.
3. Создаётся одноразовый `stamp_token` (TTL 3 минуты) → 302 в мини-апп.
4. Мини-апп отдаёт подписанный Telegram `initData` в `/api/miniapp/state`.
5. SQL-функция `claim_stamp` одной транзакцией проверяет токен, подписку и
   антифрод-паузу, пишет штамп и, если карта заполнилась, выдаёт награду.

Штампы и награды пишутся **только** через SECURITY DEFINER функции
(`claim_stamp`, `add_manual_stamp`, `redeem_reward`). Прямых INSERT-политик нет —
это осознанно, чтобы никакой клиент не смог начислить штамп мимо проверок.

### NFC

Метки — **NTAG 424 DNA** (SUN/SDM). NTAG213/215/216 не годятся: у них статичная
ссылка, её копируют и ставят штампы дома. Ключи каждой метки выводятся из
`NFC_MASTER_KEY`: `K_meta` общий (UID лежит внутри шифротекста, иначе его не
расшифровать), `K_mac` уникален по UID. Прошивка описана в
`docs/nfc-provisioning.md`.

**Важно:** прод-мастер-ключ выбирается один раз, до прошивки первой партии.
Метка, прошитая одним ключом, не работает в окружении с другим.

### Вход без почты

Supabase Auth умеет опознавать только email, поэтому под капотом заводится
служебный адрес `<логин>@stampy.local` — наружу не показывается, письма не
уходят. Аккаунты создаются админским API с `email_confirm: true`. Сотрудников
заводит владелец сам (логин + пароль, передаёт лично), сброс пароля — кнопкой в
кабинете. Почта осталась необязательным контактным полем.

### Тарифы и доступ

Два тарифа: `loyalty` (290 000 сум/мес) и `marketing` (490 000 сум/мес —
рассылки, тепловая карта, когорты, несколько точек, экспорт). Триал открывает
всё, чтобы кофейня видела, за что платит. Логика в `lib/plan.ts` и зеркалящей её
`tenant_is_serving()` в SQL — менять надо обе.

### Рассылки

Очередь не ждёт планировщик: стартует сразу после создания рассылки, после
каждого батча эндпоинт вызывает сам себя, пока есть адресаты (~25 сообщений/с,
обработка 429 и блокировок). Причина — Hobby-план Vercel отклоняет **весь
деплой** при расписании чаще суточного («Hobby accounts are limited to daily
cron jobs»). Суточные задания в `vercel.json` остались страховкой, если цепочка
оборвалась. На Pro можно вернуть `* * * * *`, поведение не изменится.

### Тенанты

`tenant_id` во всех таблицах, RLS по `stampy_staff_users`. Гости мини-аппа не
аутентифицируются в Postgres: их личность — подпись Telegram, проверенная на
сервере, а запросы идут через service-role.

### Именование

Все таблицы с префиксом `stampy_`, бакет — `stampy-logos`. Типы и функции
префикса не имеют. Если схему придётся делить с другим продуктом — правильнее
вынести всё в отдельную схему `stampy`, а не наращивать префиксы.

## Миграции

```
0001_init.sql             схема (14 таблиц)
0002_rls.sql              политики доступа
0003_functions.sql        штампы, награды, погашение
0004_signup_analytics.sql регистрация, сегменты, аналитика
0005_storage.sql          бакет логотипов
0006_invites.sql          привязка приглашённых сотрудников
0007_broadcast_queue.sql  очередь рассылок
0008_admin.sql            платформенные операции
0009_password_login.sql   вход по логину, username_available()
```

## Проверка без внешних сервисов

```bash
npm run verify   # selftest + verify:sql + verify:flow
```

- `selftest` — AES-CMAC против векторов RFC 4493, round-trip касания, отказ при
  подделанном CMAC и чужом мастер-ключе;
- `verify:sql` — все миграции на настоящем Postgres (PGlite, WASM);
- `verify:flow` — 28 проверок бизнес-логики: повтор токена, пауза, выдача и
  погашение награды, приостановленная подписка, изоляция кофеен под RLS, сверка
  счётчиков с леджером.

`scripts/supabase-stubs.ts` воспроизводит то, что даёт платформа Supabase (роли
`anon`/`authenticated`/`service_role`, схемы `auth` и `storage`, гранты) — иначе
RLS локально проверять не на чем.

## Как продолжить с мака

```bash
git clone https://github.com/asilJPG/nfs.git && cd nfs
npm install
cp .env.example .env.local        # заполнить, см. ниже
npx supabase db push
npm run seed                      # демо-кофейня
npm run dev
```

`.env.local` в git не лежит и не должен. Значения берутся из Vercel:
`npx vercel link` → `npx vercel env pull .env.local`. Локальный `NFC_MASTER_KEY`
можно сгенерировать свой — метки под него будут только для разработки.

Демо-данные из `npm run seed`: кофейня «Кофе Тест» (`/test-coffee`, тариф с
маркетингом), точка, карта на 6 штампов, 14 гостей с историей за 45 дней,
незабранная награда, NFC-метка `04A1B2C3D4E580`. Владелец: логин `test-owner`,
пароль `stampy-test-2026`, вход на `/login`.

Мини-апп открывается в обычном браузере, без Telegram:

```
DEV_TELEGRAM_ID=900000000
NEXT_PUBLIC_DEV_MINIAPP=1
```

затем `/card?startapp=t_test-coffee`. В production-сборке обе переменные мертвы:
`devUser()` возвращает null при `NODE_ENV=production`.

Полный прогон касания:

```bash
npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 1   # открыть ссылку
npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 1   # повтор → «отметка уже использована»
npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 2   # новое касание → штамп
```

Файл личных правил `all_rules.md` лежит в корне и в git не попадает — на маке
его нужно положить рядом самому.

## Что ещё не сделано

- **Оплата.** Страница `/dashboard/billing` показывает тарифы и статус, но счёт
  выставляется вручную: «напишите нам в Telegram». Click/Payme не подключены —
  это следующий крупный кусок. Подписку пока переключает платформенный админ на
  `/admin` (`admin_set_subscription`).
- **Прод не проверен на живой метке.** `mock-tag` подписывает ссылку локальным
  ключом, прод ждёт прод-ключ. Пока не прошита первая партия NTAG 424 DNA
  прод-ключом, цикл касания на проде не проверен.
- **Первый платформенный админ заводится вручную** SQL-запросом (см. ниже) — UI
  для этого нет и, наверное, не нужен.
- **Экспорт данных** заявлен в тарифе `marketing`, кнопки пока нет.
- Автотестов в привычном смысле нет: вместо них три скрипта `npm run verify`.

```sql
insert into stampy_platform_admins (auth_user_id, email)
select id, email from auth.users where email = '<ваш-логин>@stampy.local';
```

## Сессия 4 сентября 2026 — что поменялось

- **QR вместо 4 цифр.** `issue_redeem_code` теперь выдаёт 32-символьный hex-токен
  (миграция `0010_qr_redeem.sql`). Мини-апп рисует QR через `qrcode`, `/staff`
  сканирует камерой (`BarcodeDetector`, fallback-сообщение для старых браузеров).
  Ручной ввод кода награды и ручное начисление штампа удалены полностью
  (`manualStampAction` + вкладки в StaffConsole вырезаны).
- **Саморегистрация выкинута.** `/register` удалён, вместо неё `/apply` —
  простая форма-заявка (название, город, имя, телефон, Telegram, сообщение),
  пишется в новую таблицу `stampy_applications` (миграция `0011_applications.sql`,
  RLS: анонимный insert через service_role, чтение/апдейт — только платформенные
  админы через `admin_set_application_status`).
- **`/admin` теперь платформенный CRM.** Три новые секции:
  1. **Заявки на подключение** — контакты гостя, кнопки «Связались/Отклонить»
     и «Создать кофейню» с формой прямо в списке (префилл из заявки).
  2. **Создать кофейню вручную** — тот же флоу без заявки, для админа.
  3. Существующий раздел про метки, комплекты и подписки.
  Всё создание идёт через `admin_create_tenant` (миграция
  `0012_admin_create_tenant.sql`) — как `create_tenant`, но от лица указанного
  auth-пользователя, а не `auth.uid()`, потому что админ не должен становиться
  владельцем кофейни. Auth-аккаунт владельцу заводится через
  `supabase.auth.admin.createUser(loginToAuthEmail(login), password)`.
- **Первый платформенный админ.** Заводится не SQL-запросом, а через Auth Admin
  API (см. в конце). Логин `admin`, пароль `admin12`, привязан к
  `admin@stampy.local`. `/login` теперь редиректит платформенных админов сразу в
  `/admin`, а не в `/dashboard`.
- **Бот ожил.** Вебхук привязан к `nfs-tau.vercel.app`. Кнопка «Открыть карту»
  теперь `web_app` инлайн — не требует настройки Mini App short_name в
  BotFather. Menu Button бота — постоянная кнопка «Мои карты» рядом с полем
  ввода, тоже открывает `/card` как web_app. Команды `/start` и `/help` в
  автокомплит через `setMyCommands`. Пустой `/start` показывает все карты
  гостя (новый ветка в `/api/miniapp/state`: если tenant не определён —
  возвращает `{ cards: [...] }` через `listCards()`). Одна карта — сразу
  открывается, без промежуточного экрана.
- **Мелочи.** Секция «Код карты для бариста» с карты гостя убрана (после
  перехода на QR больше не нужна). `env.ts` теперь `.trim()`-ит все значения —
  Vercel иногда сохраняет с висячим переносом. `verifyInitData` больше не
  удаляет поле `signature` перед HMAC — Telegram теперь его тоже включает в
  check_data, без этого фикса подпись не сходилась.

### Заметки на будущее

- **NFC_MASTER_KEY на Vercel и локально сейчас разные** — mock-tag не будет
  проверяться на проде. Синхронизировать, когда дойдёт до реальных меток.
- **BotFather Mini App short_name** можно вообще не настраивать: web_app-кнопки
  из инлайн-клавиатуры и menu button работают напрямую по URL. `miniAppLink()`
  в `lib/env.ts` остаётся для рассылок (там url-кнопка требует t.me-формата).
- **`admin_set_kit_status` в стаффе не используется** — кнопки на кассе для
  этого нет. Заказы комплектов админ обрабатывает в `/admin`.

### Команды для быстрого сброса стенда

```bash
# в Supabase SQL Editor
delete from stampy_customers;
delete from stampy_tenants;
delete from stampy_applications;
# каскад через FK почистит memberships/stamps/rewards/venues/programs/staff/tags/kit_orders
```

Auth-пользователи владельцев остаются висеть в `auth.users` — их удалять
отдельно через Supabase Dashboard → Authentication → Users, либо оставить как
есть (без строки в `stampy_staff_users` они безобидны).

### Первый платформенный админ (без SQL)

```bash
SERVICE_KEY=...  # SUPABASE_SERVICE_ROLE_KEY
URL=https://qrfdpzigcarbethrsioe.supabase.co

# создать auth-юзера
curl -X POST "$URL/auth/v1/admin/users" -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "content-type: application/json" \
  -d '{"email":"admin@stampy.local","password":"admin12","email_confirm":true}'

# записать его в платформенные админы (id из ответа выше)
curl -X POST "$URL/rest/v1/stampy_platform_admins" -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" -H "content-type: application/json" \
  -d '{"auth_user_id":"<id>","email":"admin@stampy.local"}'
```

## Сессия 5 сентября 2026 — аудит и админка

### Аудит безопасности

Прогнал полный аудит (subagent) на 15 находок; закрыто 14, оставлена одна.

**Закрытые:**

1. **CRITICAL — угон владельца через управляющего.** `resetStaffPassword` под
   `requireRole("owner","manager")` использовал service_role для смены пароля.
   Управляющий мог сбросить пароль владельцу и войти как он. Фикс:
   `app/dashboard/venues/actions.ts` — check ролей caller vs target перед
   вызовом `auth.admin.updateUserById`. Управляющий больше не может ронять
   пароль ни владельцу, ни другому управляющему.
2. **HIGH — дубли рассылки при параллельных drain.** Два одновременных
   `drain()` брали одни и те же `pending` таргеты. Фикс: RPC
   `claim_broadcast_batch` (миграция `0014`) с `FOR UPDATE SKIP LOCKED` +
   колонка `claimed_at`. Только один воркер получает батч, `claimed_at` старше
   5 минут перезаявляется.
3. **HIGH — `updateTag`/`requestKit`/`createStaff` принимали чужой `venue_id`.**
   RLS проверял только `tenant_id`. Управляющий мог тыкать метку на venue
   чужой кофейни. Фикс: явная проверка `(id, tenant_id)` перед update/insert.
4. **HIGH — `initData` жил 24 часа.** Скриншот с `initData` = валидная
   идентичность гостя на сутки. `lib/telegram/initData.ts`: `MAX_AGE_SECONDS`
   → 10 мин.
5. **HIGH — `devUser` байпас через `NODE_ENV`.** Если `NODE_ENV != "production"`
   (пусто, `"prod"`, `"development"`), любой мог POSTить `{"initData":"dev"}`
   и стать `DEV_TELEGRAM_ID`. Теперь гейт на явный `STAMPY_DEV_MODE=1`.
6. **HIGH — `/apply` без rate-limit.** Скрапер мог залить 100k заявок. Cap 3
   в сутки на телефон.
7. **HIGH #15 — управляющий заводит управляющих.** `createStaff` теперь режет
   `role !== "cashier"` для caller.role !== "owner".
8. **MEDIUM — `gen_code` на `random()`.** Не CSPRNG. Заменено на
   `gen_random_uuid()` в миграции `0015`. Работает и на PGlite (в
   `verify-sql`), и на Supabase — без `pgcrypto` extension. `public_code`
   карт больше не предсказуем.
9. **MEDIUM — webhook `my_chat_member` писал по `from.id`.** В private ок,
   в группах багало. Теперь `chat.id` и только для `chat.type === "private"`.
10. **MEDIUM — `stamp_tokens` жили 2 суток.** TTL самого токена 3 мин, чистка
    была раз в сутки → раздувалась таблица. `expire_stale` → 1 час.
11. **MEDIUM — `redeem_reward` принимал чужой `p_venue`.** Cross-tenant leak
    в аналитику. Проверка `(venue, tenant)` в SQL.
12. **MEDIUM — `daily_broadcast_cap` считал рассылки, не сообщения.** Одна
    кампания на всю базу гостей проходила. Миграция `0016`: новая колонка
    `daily_recipient_cap` (по умолч. 5000), `queue_broadcast` считает
    суммарных получателей за день.
13. **LOW — cookie `stampy_tenant` без `__Host-` префикса.** Переименовано в
    `__Host-stampy_tenant`, старое имя — fallback для чтения до истечения.
14. **LOW — новые `admin_*` функции без явного `revoke`.** Миграция `0015`
    добавляет `revoke ... from public, anon` + `grant ... to authenticated`
    на всех: `admin_set_application_status`, `admin_create_tenant`,
    `admin_update_tenant`, `admin_delete_tenant`, `admin_delete_tag`,
    `admin_tenant_owner`.

**Оставлено:** #10 (`admin_delete_tenant` + auth-юзер не атомарны). Сирота
auth-аккаунт безобиден: без `stampy_staff_users` строки `requireStaff`
редиректит на `/login`. Если когда-то станет мешать — nightly cleanup в
`expire_stale`.

### Telegram-уведомление о заявках

`/apply` → если `ADMIN_TELEGRAM_ID` задан, бот шлёт админу сообщение с
контактами и кнопкой «Открыть админку». Работает и в личку (id пользователя),
и в группу/канал (id с минусом). Требует чтобы бот хотя бы раз получил
сообщение от адресата (Telegram не даёт слать в никуда).

### Переработка `/admin` — панель, а не сплошная страница

**Табы** (`app/admin/layout.tsx` + `components/admin/AdminTabs.tsx`):
Обзор / Кофейни / Гости / Заявки / Метки. Активная подчёркивается.

**Обзор** (`/admin`) — тайлы, каждый кликабельный. RPC
`admin_platform_overview` (миграция `0017`) возвращает одним jsonb: активных
кофеен, платящих, новых за неделю, гостей всего/активны за 30 дн, штампов
сегодня/за 7 дн, наград за 7 дн, заявок открытых, меток всего/без привязки.

**Гости** (`/admin/guests`) — SSR-поиск с `?q=` через RPC
`admin_guests_search(text, int)` (ILIKE по имени/username/telegram_id).
Показывает агрегаты: карт, штампов, наград, дата последнего штампа.

**Карточка гостя** (`/admin/guests/[id]`) — RPC `admin_guest_detail`
возвращает jsonb с массивами cards + recent_stamps. Действие «заблокировать»
через `admin_set_guest_blocked` — переводит `can_message = false` +
`blocked_at`, чтобы рассылка не долбилась.

**Карточка кофейни** (`/admin/tenants/[id]`) — точки, сотрудники, число
меток, последние 25 штампов, кнопка **«Войти как владелец»**.

**Импресонация** (`lib/impersonate.ts` + правки `lib/auth.ts`):

- Подписанный cookie `__Host-stampy_impersonate` = `<tenantId>.<hmac>`,
  подпись HMAC-SHA256 от `SESSION_SECRET`, TTL 2 часа.
- `requireStaff`: если у платформенного админа выставлен cookie, вытаскиваем
  владельца этого tenant'а из `stampy_staff_users` и возвращаем контекст с
  `impersonating: true`. Сотрудник смотрит своими глазами (все действия
  реально выполняются).
- В шапке дашборда жёлтый баннер «Вы смотрите как владелец X · Выйти из
  режима» → `stopImpersonatingAction` чистит cookie и возвращает на
  `/admin/tenants/{id}`.

### Рефакторинг компонентов админки

`components/admin/AdminConsole.tsx` (679 строк) разбит: секции экспортируются
(`TenantRow`, `ApplicationRow`, `CreateTenantSection`), под каждый таб —
свой Panel (`TenantsPanel`, `ApplicationsPanel`, `TagsPanel`, `GuestsPanel`).
Общий помощник `components/admin/shared.ts` с `useAdminAction()` hook
(notice + pending + run) и стилевой константой `input`.

Старый `AdminConsole` main-export остался, но никем не используется — можно
удалить в следующую волну.

### Косметика и чистка комментариев

Прошёл grep'ом по `app/`/`lib/`/`components/` — снёс/переписал ~30 JSDoc-
блоков в английском стиле с многострочным prose. Оставил только те, где
объясняется WHY (не WHAT) — короткие русские однострочники. Файл в среднем
стал на 5–10 строк короче.

### Обновлённые ENV

Локально в `.env.local` можно добавить (для запуска мини-аппа в браузере):

```
STAMPY_DEV_MODE=1
DEV_TELEGRAM_ID=2141257356
NEXT_PUBLIC_DEV_MINIAPP=1
```

Без `STAMPY_DEV_MODE=1` dev-режим не работает — `NODE_ENV` больше не гейт.

На Vercel добавьте:

```
ADMIN_TELEGRAM_ID=<ваш id или -100... для группы>
```

### Что применить на Supabase (по порядку)

`0014_broadcast_atomic_claim.sql`, `0015_audit_medium_fixes.sql`,
`0016_audience_cap.sql`, `0017_platform_stats.sql` — все SQL-Editor'ом.
`verify-sql` подтверждает применимость на PGlite.

## Ссылки

- `docs/deploy.md` — деплой на Vercel, переменные окружения, cron.
- `docs/nfc-provisioning.md` — как прошивать метки.
