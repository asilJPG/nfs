// Vercel-функции живут в hnd1 (UTC+9), а Ташкент это UTC+5 — если считать
// «сегодня» серверными часами, вечерние касания уезжают в «завтра». Всё,
// что показывает кофейне «за день», должно ходить через явный таймзон.

const TZ = process.env.NEXT_PUBLIC_TENANT_TZ?.trim() || "Asia/Tashkent";
// В +5 нет DST, поэтому фиксированный offset подходит. Для других зон
// потом можно перейти на полноценный Intl-расчёт.
const OFFSET = process.env.NEXT_PUBLIC_TENANT_TZ_OFFSET?.trim() || "+05:00";

export const tenantTimeZone = TZ;

/** ISO-дата дня (YYYY-MM-DD) в таймзоне арендатора. */
export function tenantDateISO(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Начало указанного дня арендатора в UTC. */
export function tenantDayStart(dayISO?: string): Date {
  const key = dayISO ?? tenantDateISO();
  return new Date(`${key}T00:00:00${OFFSET}`);
}

export function tenantDayEnd(dayISO?: string): Date {
  const start = tenantDayStart(dayISO);
  return new Date(start.getTime() + 24 * 3_600_000);
}

/** Сдвинуть YYYY-MM-DD на N дней. */
export function shiftDayISO(dayISO: string, delta: number): string {
  const [y, m, d] = dayISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

/** Показ времени в таймзоне арендатора. */
export function formatTenantTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatTenantDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}
