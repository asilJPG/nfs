// Единственный источник правды по контактам поддержки — иначе плодятся
// битые t.me/stampy_support и hello@stampy.co, которых нет.

// NEXT_PUBLIC_* доступны и в браузере, и на сервере.
const SUPPORT_TELEGRAM =
  process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM?.trim().replace(/^@/, "") ||
  process.env.NEXT_PUBLIC_BOT_USERNAME?.trim().replace(/^@/, "") ||
  "";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";

export const supportTelegramHandle = SUPPORT_TELEGRAM ? `@${SUPPORT_TELEGRAM}` : "";
export const supportTelegramUrl = SUPPORT_TELEGRAM ? `https://t.me/${SUPPORT_TELEGRAM}` : "";
export const supportEmail = SUPPORT_EMAIL;
export const supportEmailUrl = SUPPORT_EMAIL ? `mailto:${SUPPORT_EMAIL}` : "";
