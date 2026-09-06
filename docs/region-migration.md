# Переезд Supabase в eu-central-1 (Франкфурт)

Зачем: проект живёт в `ap-northeast-1` (Токио). Замер из Ташкента —
RTT ≈ 370 мс, причём пустой `select` и тяжёлый RPC отвечают одинаково, то есть
всё это время сеть, а не база. Франкфурт от Ташкента — ~90–120 мс.

Регион существующего проекта Supabase не меняется: нужен новый проект в нужном
регионе и перенос дампа
(<https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z>).

## Что ломается при переезде

- **Все сессии сотрудников инвалидируются** — у нового проекта свой JWT-секрет.
  Владельцу и баристам придётся войти заново. Пароли переносятся (лежат в
  `auth.users` в хешированном виде), заводить их заново не нужно.
- **Меняются URL и ключи** — их надо обновить в Vercel и `.env.local`.
- **Storage не входит в дамп БД** — логотипы кофеен (`stampy-logos`) копируются
  отдельно.
- Гостевые карты, штампы, NFC-метки — переносятся дампом как есть, ничего
  перепрошивать не надо. Ссылка мини-аппа и вебхук Telegram не меняются: они
  смотрят на домен приложения, а не на Supabase.

## Порядок

1. **Новый проект** в дашборде Supabase, регион `Europe (Frankfurt) eu-central-1`.
   Пароль базы сохранить — он понадобится в строке подключения.

2. **Дамп со старого проекта** (строки подключения — в Dashboard → Connect →
   Session pooler):

   ```bash
   npx supabase db dump --db-url "$OLD_DB_URL" -f dump-roles.sql --role-only
   npx supabase db dump --db-url "$OLD_DB_URL" -f dump-schema.sql
   npx supabase db dump --db-url "$OLD_DB_URL" -f dump-data.sql --data-only --use-copy
   ```

3. **Заливка в новый проект** (порядок важен):

   ```bash
   psql "$NEW_DB_URL" -f dump-roles.sql
   psql "$NEW_DB_URL" -f dump-schema.sql
   psql "$NEW_DB_URL" -f dump-data.sql
   ```

4. **Storage.** Создать бакет `stampy-logos` (public) и перелить файлы —
   `scripts/copy-storage.ts` (см. ниже) ходит service-role-ключами обоих
   проектов.

5. **Проверка на новом проекте до переключения:**

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=<new> npm run verify
   ```

   Плюс глазами: `select count(*)` по `stampy_stamps`, `stampy_memberships`,
   `stampy_nfc_tags` совпадают со старым.

6. **Переключение.** В Vercel → Settings → Environment Variables заменить
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`. В `vercel.json` поменять регион на `fra1`.
   Редеплой. Те же три ключа — в локальный `.env.local`.

7. **Старый проект не удалять неделю** — на случай отката. Откат = вернуть
   старые ключи в Vercel; данные, накопленные после переключения, при этом
   останутся в новом проекте, поэтому переключаться лучше ночью (мало штампов).

## Окно простоя

Между шагом 2 и шагом 6 штампы, поставленные гостями, попадут в старую базу и в
новую не переедут. Дамп маленький — окно 10–15 минут. Делать в 3–5 утра по
Ташкенту, когда кофейни закрыты.
