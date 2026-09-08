/**
 * Цветовая арифметика для брендов кофеен. Кофейня выбирает пять цветов в кабинете,
 * и любой из них может оказаться почти белым — поэтому текст на её фоне подбираем
 * по контрасту, а не «на глаз».
 */

const HEX = /^#?([0-9a-f]{6})$/i;

function channels(hex: string): [number, number, number] | null {
  const match = HEX.exec(hex?.trim() ?? "");
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** #RRGGBB → rgba(...). Некорректный цвет возвращаем как есть, чтобы не ронять вёрстку. */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = channels(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Осветлить (amount > 0) или затемнить (amount < 0) на долю от полного диапазона. */
export function shade(hex: string, amount: number): string {
  const rgb = channels(hex);
  if (!rgb) return hex;
  const shifted = rgb.map((channel) =>
    Math.max(0, Math.min(255, channel + Math.round(255 * amount))),
  );
  return `#${shifted.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function relativeLuminance(hex: string): number {
  const rgb = channels(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Грубый контраст по WCAG, чтобы кофейня не выкатила белое по белому. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export const INK_DARK = "#141414";
export const INK_LIGHT = "#ffffff";

/** Чёрные или белые буквы на этом фоне — что контрастнее, то и берём. */
export function inkOn(background: string): string {
  return contrastRatio(INK_DARK, background) >= contrastRatio(INK_LIGHT, background)
    ? INK_DARK
    : INK_LIGHT;
}

/**
 * Фон плашки и текст на ней с гарантией читаемости: у средних по светлоте цветов
 * (условный #5B8DEF) ни чёрный, ни белый не дают 4.5:1, поэтому сдвигаем сам фон
 * от чернил, сохраняя тон бренда.
 */
export function readableFill(
  brandColor: string,
  target = 4.5,
): { background: string; ink: string } {
  let background = brandColor;
  let ink = inkOn(background);
  // шаг 4% за итерацию: за 25 шагов фон гарантированно доходит до края диапазона
  for (let step = 0; step < 25 && contrastRatio(ink, background) < target; step += 1) {
    background = shade(background, ink === INK_LIGHT ? -0.04 : 0.04);
    ink = inkOn(background);
  }
  return { background, ink };
}

/**
 * Цвета плашки карты. Форма в кабинете проверяет контраст при сохранении, но в базе
 * могли осесть старые записи, а brand приходит из jsonb и может быть неполным —
 * поэтому текст ещё раз проверяем здесь и при провале берём контрастные чернила.
 */
export function plateColors(brand: {
  primary: string;
  bg: string;
  surface: string;
  text: string;
  accent: string;
}): { surface: string; bg: string; text: string; primary: string; accent: string } {
  const surface = brand.surface || "#17223B";
  const bg = brand.bg || surface;
  const text = contrastRatio(brand.text, surface) >= 4.5 ? brand.text : inkOn(surface);
  const primary = brand.primary || "#5B8DEF";
  const accentRaw = brand.accent || primary;
  const accent = contrastRatio(accentRaw, surface) >= 3 ? accentRaw : text;
  return { surface, bg, text, primary, accent };
}
