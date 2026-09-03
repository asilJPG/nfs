/**
 * Points the bot at this deployment. Run once per environment:
 *   npx tsx scripts/setup-webhook.ts
 */
import { loadEnv } from "./env";

loadEnv();

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!appUrl || !token || !secret) {
  throw new Error("NEXT_PUBLIC_APP_URL, TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set");
}

async function main() {
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: `${appUrl}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "my_chat_member"],
    drop_pending_updates: true,
  }),
});

  console.log(await response.json());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
