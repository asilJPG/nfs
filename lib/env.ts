import "server-only";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

// серверные секреты, отсутствующий бросает при чтении, не на импорте
export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get botToken() {
    return required("TELEGRAM_BOT_TOKEN");
  },
  get webhookSecret() {
    return required("TELEGRAM_WEBHOOK_SECRET");
  },
  get nfcMasterKey() {
    const hex = required("NFC_MASTER_KEY");
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error("NFC_MASTER_KEY must be 32 bytes of hex (64 characters)");
    }
    return Buffer.from(hex, "hex");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get cronSecret() {
    return required("CRON_SECRET");
  },
  get appUrl() {
    return required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  },
  get botUsername() {
    // BotFather показывает имя с @, а в ссылке t.me его быть не должно.
    return required("NEXT_PUBLIC_BOT_USERNAME").replace(/^@/, "");
  },
  get miniAppShortName() {
    return optional("NEXT_PUBLIC_MINIAPP_SHORT_NAME") ?? "app";
  },
};

// диплинк в мини-апп с payload'ом
export function miniAppLink(startParam: string): string {
  return `https://t.me/${env.botUsername}/${env.miniAppShortName}?startapp=${encodeURIComponent(startParam)}`;
}
