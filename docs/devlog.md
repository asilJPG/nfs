# Девлог

Компактный справочник по состоянию проекта. Дата актуализации — 10 сентября 2026.
История сессий свёрнута; ниже — то, что есть сейчас и что осталось сделать.

## Что это

**Stampy** — SaaS карт лояльности для кофеен. Бумажная штамп-карточка переехала
в Telegram Mini App: гость прикладывает телефон к NFC-подставке на кассе,
получает штамп, после N штампов — бесплатный напиток по QR у бариста.

Один бот на всех, каждая кофейня внутри со своим брендом, тёмная дизайн-система
(Stampy.dc). Тарифы Solo / Chain / Group (UZS), оплата вручную — Click/Payme
пока не подключён.

- Репо: `github.com/asilJPG/nfs`, ветка `main`
- Vercel-проект: `nfsss`, регион `hnd1` (Токио, рядом с базой)
- Supabase: `qrfdpzigcarbethrsioe`, регион `ap-northeast-1` (Токио)
- Bot: `@uuiopiasodfpio_bot`, вебхук на `nfs-tau.vercel.app`

## Стек

Next.js 15 (App Router, Server Actions, TS, Tailwind 4) · Supabase
(Postgres + RLS + Auth + Storage) · Vercel · Telegram Bot API. Recharts,
zod. Время в UTC (`timestamptz`), аналитика в `Asia/Tashkent`.

## Разделы

| Путь | Кто | Что |
|---|---|---|
| `/` | публично | лендинг Stampy + StampyLivePreview (интерактивная витрина 6 экранов) |
| `/apply` | публично | заявка на подключение (rate-limit 3/день/телефон, tg-уведомление ADMIN_TELEGRAM_ID) |
| `/login` | сотрудники | логин + пароль (`<login>@stampy.local` под капотом) |
| `/dashboard` | владелец/управляющий | аналитика, оформление карты, точки, метки, рассылки, подписка |
| `/staff` | бариста | сканер QR наград (камера) |
| `/admin` | платформа | AdminSidebar + KPI + таблица кофеен, гости, заявки, метки, health-виджеты |
| `/card` | гость | мини-апп: кошелёк, карта, история, события, профиль |
| `/t` | NFC | приём тапа NTAG 424, создание stamp_token, редирект |

## Ключевые архитектурные решения

**Auth без сети.** `lib/auth.ts` использует `getClaims()` с JWKS (кеш в модуле
10 минут) вместо `getUser()`. Раньше было 2 сетевых вызова Auth на клик, стало
0 — подпись JWT проверяется локально. `React.cache` дедупицирует
`requireStaff` в рамках запроса + JOIN staff/tenant одним запросом (было 6
SQL на страницу, стало 1-2).

**Регион.** `vercel.json`: `"regions": ["hnd1"]`. Функции в том же ДЦ, что и
БД — internal RTT 5мс вместо 340мс через океан. Ташкент → Токио ~130мс на
клик. План на Frankfurt (`docs/region-migration.md`) отложен.

**NFC.** NTAG 424 DNA SUN. `NFC_MASTER_KEY` (32 байта hex) в env, из него
выводятся `K_meta` (общий) и `K_mac(UID)` (per-tag) через HMAC-SHA256. Чип
шифрует AES-CBC + подписывает CMAC, сервер (`lib/nfc/sun.ts`) проверяет.
Защита от повтора — атомарный UPDATE `stampy_nfc_tags` с `last_counter < tap.counter`.

**Демо-путь для дешёвых меток.** `startapp=tap_<slug>` в мини-аппе (см.
`claimTapDemo` в `app/api/miniapp/state/route.ts`) — без крипты, находит первую
активную метку кофейни и штампует. Для показа кофейне «почему нужен NTAG 424».

**Штампы и награды пишутся только через SECURITY DEFINER функции**
(`claim_stamp`, `add_manual_stamp`, `redeem_reward`), прямых INSERT-политик
нет.

**Рассылки.** `queue_broadcast` материализует таргеты, атомарный
`claim_broadcast_batch` (`FOR UPDATE SKIP LOCKED`) отсекает дубли при
параллельных drain'ах. Триггер после кнопки — через `after()` из
`next/server`, иначе Vercel убивает `void fetch` до завершения. Дневной cron
на `vercel.json` как страховка.

**QR-погашение.** `issue_redeem_code` выдаёт 32-hex токен (через
`gen_random_uuid()`, чтобы работало и в PGlite, и в Supabase без pgcrypto).
Мини-апп рисует QR, бариста сканит камерой в `/staff`.

**Импресонация.** Cookie `__Host-stampy_impersonate` (подпись HMAC от
SESSION_SECRET, TTL 2ч). Платформенный админ на `/admin/tenants/[id]` жмёт
«Войти как владелец» → cookie ставится → `requireStaff` возвращает контекст
владельца. В шапке дашборда жёлтый баннер + «Выйти из режима».

**Мини-апп.** Polling `/api/miniapp/state` каждые 4с пока карта открыта —
штамп появляется когда гость возвращается в Telegram после NFC-тапа. Web NFC
кнопку убрали (iOS Safari не поддерживает).

## Миграции

```
0001_init.sql             схема (14 таблиц)
0002_rls.sql              RLS-политики
0003_functions.sql        claim_stamp, redeem_reward, add_manual_stamp
0004_signup_analytics.sql create_tenant, сегменты, аналитика
0005_storage.sql          bucket stampy-logos
0006_invites.sql          приглашённые сотрудники
0007_broadcast_queue.sql  queue_broadcast
0008_admin.sql            admin_* платформенные RPC
0009_password_login.sql   логин вместо email
0010_qr_redeem.sql        32-hex токен вместо 4 цифр
0011_applications.sql     stampy_applications + RLS
0012_admin_create_tenant  создание кофейни от лица другого auth-юзера
0013_admin_manage.sql     rename/delete tenant, delete tag, tenant owner
0014_broadcast_atomic_claim  claim_broadcast_batch + claimed_at
0015_audit_medium_fixes   gen_code CSPRNG, redeem_reward venue check, revoke/grant, expire_stale TTL 1ч
0016_audience_cap.sql     daily_recipient_cap 5000/день
0017_platform_stats.sql   admin_platform_overview, admin_guests_search, admin_guest_detail
0018_fix_queue_broadcast_cast  каст к enum broadcast_status
```

## ENV

**Обязательные:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — клиент
- `SUPABASE_SERVICE_ROLE_KEY` — server actions, миниапп-трафик, cron
- `NEXT_PUBLIC_APP_URL` — базовый (`https://nfs-tau.vercel.app`)
- `NEXT_PUBLIC_BOT_USERNAME=uuiopiasodfpio_bot`, `NEXT_PUBLIC_MINIAPP_SHORT_NAME=app`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
- `NFC_MASTER_KEY` (32 байта hex) — прошиваем метки от него, не менять после первой партии
- `SESSION_SECRET` (32 байта hex) — подпись cookie
- `CRON_SECRET` — защита `/api/cron/*`

**Опциональные:**
- `ADMIN_TELEGRAM_ID` — куда уведомлять о новой заявке (личный id или -100... для группы)
- `STAMPY_DEV_MODE=1` + `DEV_TELEGRAM_ID` — dev-режим (в prod мертво)

## Первый платформенный админ

Через Supabase Auth Admin API:

```bash
curl -X POST "$URL/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
  -H "content-type: application/json" \
  -d '{"email":"admin@stampy.local","password":"admin12","email_confirm":true}'
# → id из ответа

curl -X POST "$URL/rest/v1/stampy_platform_admins" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
  -H "content-type: application/json" \
  -d '{"auth_user_id":"<id>","email":"admin@stampy.local"}'
```

Вход: `/login`, логин `admin`, пароль `admin12` → редирект на `/admin`.

## Проверка без внешних сервисов

```bash
npm run selftest     # AES-CMAC + SUN round-trip
npm run verify:sql   # все миграции на PGlite (WASM Postgres)
npm run verify:flow  # 28 e2e-тестов бизнес-логики
npm run verify       # всё сразу
npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 1   # симуляция тапа
```

## Аудит безопасности

Прогнан 5 сентября (15 находок), закрыто 14. **Оставлено #10:** атомарность
`admin_delete_tenant` + удаления auth-юзера. Риск LOW — сирота auth без
`stampy_staff_users` строки редиректит на `/login`.

Ключевые фиксы:
- Управляющий не может ронять пароль владельцу (проверка ролей в
  `resetStaffPassword`)
- `initData` TTL 24ч → 10 мин
- `devUser` гейт на явный `STAMPY_DEV_MODE=1`, не на `NODE_ENV`
- Дневной cap рассылки по получателям (5000/день) + атомарный claim батча
- CSPRNG в `gen_code`, `redeem_reward` с проверкой venue↔tenant
- Session cookie `__Host-` префикс, `webhook.my_chat_member` только для private
- Явные `revoke ... from public` + `grant ... to authenticated` на всех
  admin-функциях

## Дизайн-система

Тёмная (`#08090B` / `#0E0F11`), акцент `#5B8DEF`, mono-шрифт для eyebrow.
Токены в `app/globals.css`: `.card`, `.card-title`, `.page-title`, `.eyebrow`,
`.field-label`, `.field-hint`, `.input`, `.btn` (+ `-primary/-ghost/-danger/
-sm/-block`), `.badge` (ok/warn/bad/muted/accent), `.note`, `.empty`.

Мини-апп (`/card`): 5 вкладок (Карта / Кошелёк / История / События / Профиль),
кошелёк — веер задних карт + hero-карточка с прогрессом, свайп горизонтально
переключает. В режиме кошелька История/События берут суммы по всем кофейням.
Реакции — poll каждые 4с, вибро + анимация свежего слота.

Лендинг (`app/page.tsx`) — hero, StampyLivePreview (6 экранов Mini App
работающих, не мокапы), тарифы UZS, FAQ. Skeleton loading-страницы во всех
разделах (`components/ui/Skeleton.tsx`).

## Оптимизация

- `hnd1` рядом с БД (см. выше)
- JWKS-локальная auth (см. выше)
- Recharts через `next/dynamic ssr:false` → бандл дашборда 108KB First Load
  (было ~290)
- `RewardSheet` (qrcode ~50KB) — dynamic
- `next.config.ts`: `optimizePackageImports` для recharts/supabase/zod,
  `images.formats: [avif, webp]`, `compress`, `reactStrictMode`
- `loading.tsx` во всех разделах — вместо белого экрана моментально скелетон

## Открытые хвосты

**Дизайн:**
- `/admin/*` (кроме overview) — не под общими токенами, много хардкода
  `#14161D`/`#5B8DEF`
- MRR/Churn в `/admin` — сейчас захардкожено; либо считаем в
  `admin_platform_overview`, либо прячем

**Функционал:**
- ± штамп в админке (владельцу в дашборде, платформенному в карточке гостя) —
  обещал в задел
- Экспорт CSV на тарифе marketing — кнопки нет
- Оплата Click/Payme — сейчас `admin_set_subscription` руками

**Инфра:**
- NTAG 424 DNA: купить чипы + программатор ACR1252U, синхронизировать
  `NFC_MASTER_KEY` на Vercel с локальным (сейчас разные)
- Миграция Supabase в `eu-central-1` (Франкфурт) — план
  в `docs/region-migration.md`, `scripts/copy-storage.ts`

**Прочее:**
- Скриншот-прогон авторизованных частей визуально не проверялся
- Аудит #10 (delete_tenant не атомарен) — LOW, скипнули

**Research задача коворку:**
Отдана 8 сентября — фичи для retention/виральности/upsell, разбор
конкурентов (Loyverse, Fivestars, UDS), специфика UZ-рынка. Ждём результат.

## Ссылки

- `docs/deploy.md` — деплой на Vercel, переменные окружения, cron
- `docs/nfc-provisioning.md` — как прошивать метки
- `docs/region-migration.md` — план переезда Supabase во Frankfurt
- `docs/pre-launch.md` — чеклист перед запуском
- `дизайн/*.html` — референсы Stampy.dc
