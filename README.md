# Stampy

Карта лояльности для кофеен: бумажная карточка со штампами, перенесённая в Telegram
Mini App. Гость прикладывает телефон к NFC-подставке на кассе — штамп начисляется,
после N штампов кофейня выдаёт напиток по коду.

SaaS: каждая кофейня регистрируется сама, настраивает свою карту (цвета, логотип,
награда) и получает её внутри одного общего бота.

## Стек

Next.js 15 (App Router, TypeScript, Tailwind) · Supabase (Postgres + RLS + Auth +
Storage) · Vercel (веб и cron) · Telegram Bot API.

Время в базе — UTC (`timestamptz`); вся аналитика и расписания считаются в
`Asia/Tashkent`.

## Быстрый старт

```bash
npm install
cp .env.example .env.local        # заполнить
npx supabase db push              # применить миграции
npm run dev
```

## Проверка без внешних сервисов

```bash
npm run verify
```

Прогоняет три вещи, ни одной из которых не нужен ни Supabase, ни Telegram, ни метка:

| Скрипт | Что проверяет |
|---|---|
| `npm run selftest` | AES-CMAC против векторов RFC 4493, round-trip касания, отказ при подделанном CMAC и чужом мастер-ключе |
| `npm run verify:sql` | все миграции применяются на настоящем Postgres (PGlite, WASM) |
| `npm run verify:flow` | 28 проверок бизнес-логики: повтор токена, пауза, выдача и погашение награды, приостановленная подписка, изоляция кофеен под RLS, сверка счётчиков с леджером |

`scripts/supabase-stubs.ts` воспроизводит то, что даёт платформа Supabase (роли
`anon`/`authenticated`/`service_role`, схемы `auth` и `storage`, дефолтные гранты) —
иначе проверять RLS локально было бы не на чем.

Отдельно, ссылка «как от реальной метки»:

```bash
npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 1
```

## Тестовый стенд

После `db push` наполнить базу демо-кофейней:

```bash
npm run seed -- --email you@example.com          # --reset пересоздаёт набор
```

Создаёт кофейню «Кофе Тест» (`/test-coffee`, тариф с маркетингом), точку, карту на
6 штампов, 14 гостей с историей за 45 дней, незабранную награду и NFC-метку
`04A1B2C3D4E580`. Роль owner привязывается к указанной почте — дальше обычный вход
через `/login`.

Мини-апп открывается в обычном браузере, без Telegram:

```
DEV_TELEGRAM_ID=900000000
NEXT_PUBLIC_DEV_MINIAPP=1
```

затем `/card?startapp=t_test-coffee`. В production-сборке обе переменные мертвы:
`devUser()` возвращает null при `NODE_ENV=production`.

Полный прогон касания:

```bash
npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 1   # открыть ссылку в браузере
npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 1   # повтор → «отметка уже использована»
npm run mock-tag -- --uid 04A1B2C3D4E580 --counter 2   # новое касание → штамп
```

## Переменные окружения

| Переменная | Зачем |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | клиент Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | серверные операции мини-аппа и cron (обходит RLS) |
| `NEXT_PUBLIC_APP_URL` | базовый адрес; в него ведут NFC-метки |
| `NEXT_PUBLIC_BOT_USERNAME` / `NEXT_PUBLIC_MINIAPP_SHORT_NAME` | сборка ссылок `t.me/<bot>/<app>` |
| `TELEGRAM_BOT_TOKEN` | Bot API и проверка подписи initData |
| `TELEGRAM_WEBHOOK_SECRET` | защита вебхука |
| `NFC_MASTER_KEY` | 32 байта hex; из него выводятся ключи всех меток |
| `SESSION_SECRET` | подпись cookie «какая кофейня открыта» |
| `CRON_SECRET` | защита `/api/cron/*` |

## Настройка бота

1. @BotFather → создать бота, включить Mini App с URL `https://<домен>/card`,
   задать короткое имя (`NEXT_PUBLIC_MINIAPP_SHORT_NAME`).
2. `npx tsx scripts/setup-webhook.ts` — привязать вебхук.
3. В Supabase → Authentication → URL Configuration добавить
   `https://<домен>/auth/callback` в Redirect URLs.

## Как устроено

| Путь | Кто | Что |
|---|---|---|
| `/` | кофейня | лендинг |
| `/onboarding` | кофейня | саморегистрация: карта за пару минут, триал 30 дней |
| `/dashboard` | владелец, управляющий | аналитика, оформление карты, точки, метки, рассылки, подписка |
| `/staff` | бариста | выдать награду по коду, ручной штамп |
| `/admin` | платформа | кофейни, подписки, регистрация меток, заявки на комплекты |
| `/card` | гость | мини-апп: карта, штампы, награды |
| `/t` | — | эндпоинт NFC-касания |

### Путь одного штампа

1. Тап по метке → браузер открывает `/t?picc_data=…&cmac=…`.
2. `app/t/route.ts` расшифровывает PICCData, проверяет CMAC (`lib/nfc/sun.ts`),
   требует, чтобы счётчик касаний вырос — это и есть защита от повтора.
3. Создаётся одноразовый `stamp_token` (TTL 3 минуты) → 302 в мини-апп.
4. Мини-апп отдаёт подписанный Telegram `initData` в `/api/miniapp/state`.
5. SQL-функция `claim_stamp` в одной транзакции проверяет токен, подписку и
   антифрод-паузу, пишет штамп и, если карта заполнилась, выдаёт награду.

Штампы и награды пишутся **только** через SECURITY DEFINER функции
(`claim_stamp`, `add_manual_stamp`, `redeem_reward`) — прямых INSERT-политик нет.

### Тенанты и доступ

`tenant_id` во всех таблицах, RLS по `staff_users`. Гости мини-аппа не
аутентифицируются в Postgres: их личность — подпись Telegram, проверенная на
сервере, а запросы идут через service-role.

## Именование

Все таблицы проекта начинаются с префикса stampy_ (stampy_tenants, stampy_stamps, ...),
бакет хранилища — stampy-logos. Так в дашборде Supabase сразу видно, что относится
к этому проекту, если в базе живёт что-то ещё.

Типы и функции префикса не имеют — они не попадаются на глаза в списке таблиц.
Если схему когда-нибудь придётся делить с другим продуктом, надёжнее вынести
всё в отдельную схему stampy, а не наращивать префиксы.

## Миграции

```
0001_init.sql             схема
0002_rls.sql              политики доступа
0003_functions.sql        штампы, награды, погашение
0004_signup_analytics.sql регистрация, сегменты, аналитика
0005_storage.sql          бакет логотипов
0006_invites.sql          привязка приглашённых сотрудников
0007_broadcast_queue.sql  очередь рассылок
0008_admin.sql            платформенные операции
```

Первый платформенный админ заводится вручную:

```sql
insert into stampy_platform_admins (auth_user_id, email)
select id, email from auth.users where email = 'you@example.com';
```

## Cron

`vercel.json`: `/api/cron/broadcast` раз в минуту (очередь рассылок, ~25 сообщений/с,
обработка 429 и блокировок), `/api/cron/maintenance` ночью по Ташкенту (сгорание
наград, чистка использованных токенов).

## Дальше

- `docs/nfc-provisioning.md` — как прошивать метки.
