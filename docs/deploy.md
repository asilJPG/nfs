# Деплой на Vercel

## 1. Проект

Vercel → Add New → Project → импортировать `asilJPG/nfs`. Framework определится как
Next.js, ничего менять не нужно. Если проект уже создан, но пишет
«No Production Deployment» — значит, деплоя на ветке `main` ещё не было: подключите
репозиторий в Settings → Git либо запустите `npx vercel --prod` из корня.

## 2. Переменные окружения

Settings → Environment Variables, все со scope **Production** (и Preview, если нужны
превью-деплои).

| Переменная | Значение |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://qrfdpzigcarbethrsioe.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable-ключ (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret-ключ (`sb_secret_…`) |
| `NEXT_PUBLIC_APP_URL` | адрес прод-домена, без слэша на конце |
| `NEXT_PUBLIC_BOT_USERNAME` | имя бота без `@` |
| `NEXT_PUBLIC_MINIAPP_SHORT_NAME` | короткое имя мини-аппа из BotFather |
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `TELEGRAM_WEBHOOK_SECRET` | случайные 24+ байта |
| `NFC_MASTER_KEY` | 32 байта hex — **см. предупреждение ниже** |
| `SESSION_SECRET` | случайные 32 байта |
| `CRON_SECRET` | случайные 24 байта |

Секреты генерируются так:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"       # NFC_MASTER_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" # остальные
```

`DEV_TELEGRAM_ID` и `NEXT_PUBLIC_DEV_MINIAPP` в production **не заводить**. Они и так
не работают при `NODE_ENV=production`, но пусть их там не будет вовсе.

### NFC_MASTER_KEY выбирается один раз

Из него выводятся ключи всех меток. Метка, прошитая одним мастер-ключом, не
заработает в окружении с другим. Поэтому: сгенерировать прод-ключ **до** прошивки
первой партии, положить в Vercel, забэкапить отдельно от базы — и больше не менять.
Локальный ключ из `.env.local` живёт своей жизнью: метки, прошитые под него,
годятся только для разработки.

## 3. После первого деплоя

1. `NEXT_PUBLIC_APP_URL` привести к выданному домену и передеплоить (переменная
   попадает в клиентский бандл на сборке).
2. Supabase → Authentication → Providers → Email: провайдер включён, «Confirm email»
   можно выключить. Писем система всё равно не шлёт: аккаунты создаются админским
   API с уже подтверждённым адресом, вход идёт по логину и паролю.
3. BotFather → мини-апп указывает на `https://<домен>/card`.
4. Привязать вебхук:
   ```bash
   NEXT_PUBLIC_APP_URL=https://<домен> TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… \
     npx tsx scripts/setup-webhook.ts
   ```
5. Себя в платформенные админы:
   ```sql
   insert into stampy_platform_admins (auth_user_id, email)
   select id, email from auth.users where email = '<ваш-логин>@stampy.local';
   ```

## 4. Cron и тарифы Vercel

`vercel.json` просит запускать очередь рассылок каждую минуту:

```json
{ "path": "/api/cron/broadcast", "schedule": "* * * * *" }
```

На плане **Hobby** cron выполняется не чаще раза в сутки, и их не больше двух —
рассылка тогда поедет пачкой раз в день, а не за минуты. Варианты:

- перейти на Pro, где минутный интервал разрешён;
- либо оставить Hobby и дёргать `/api/cron/broadcast` извне (Supabase `pg_cron` +
  `net.http_get`, GitHub Actions по расписанию, любой сервис-пингер) — эндпоинт
  идемпотентен и защищён `CRON_SECRET`.

Vercel сам подставляет `Authorization: Bearer $CRON_SECRET` в свои cron-запросы,
поэтому дополнительной настройки заголовков не требуется.

## 5. Проверка живого деплоя

```bash
curl -sI https://<домен>/card | head -1                 # 200
curl -s https://<домен>/api/miniapp/state -X POST \
  -H 'content-type: application/json' -d '{"initData":""}'   # 401 missing — значит, подпись проверяется
```

Полный цикл касания проверяется только с прошитой меткой: `mock-tag` подписывает
ссылку локальным ключом, а прод ждёт прод-ключ.
