"use client";

import type { Brand } from "@/types/db";

export type WalletCardData = {
  slug: string;
  name: string;
  subtitle: string;
  logo_url: string | null;
  brand: Pick<Brand, "primary"> & Partial<Brand>;
  stamps_count: number;
  stamps_required: number | null;
};

/** Читаемый цвет текста на плашке карты — плашки красит владелец кофейни. */
export function inkOn(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#141414";
  const value = parseInt(raw, 16);
  const [r, g, b] = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#141414" : "#ffffff";
}

/** Затемняет/осветляет hex — из одного бренд-цвета делаем обложку с глубиной. */
export function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const value = parseInt(raw, 16);
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((channel) =>
    Math.max(0, Math.min(255, channel + Math.round(255 * amount))),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function Monogram({
  name,
  logoUrl,
  ink,
  size = 40,
}: {
  name: string;
  logoUrl: string | null;
  ink: string;
  size?: number;
}) {
  const isDarkInk = ink === "#141414";
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: isDarkInk ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.2)",
        color: ink,
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/**
 * Карта в списке — по референсу `дизайн/123.png`: обложка во всю плашку и
 * матовая стеклянная панель справа с круглым знаком кофейни. Обложка собирается
 * из бренд-цвета кофейни; если загружен логотип, он же уходит в фон размытым.
 */
export function WalletCardRow({ card, onClick }: { card: WalletCardData; onClick: () => void }) {
  const fill = card.brand.primary ?? "#7c3aed";
  const ink = inkOn(fill);
  const isDarkInk = ink === "#141414";
  const required = card.stamps_required ?? 0;
  const progress = required > 0 ? Math.min(100, (card.stamps_count / required) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="relative h-[168px] w-full overflow-hidden rounded-[22px] text-left transition-transform active:scale-[0.985]"
      style={{ background: `linear-gradient(145deg, ${shade(fill, 0.08)}, ${shade(fill, -0.22)})` }}
    >
      {/* обложка: размытый логотип, если он есть */}
      {card.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.logo_url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl"
        />
      )}

      {/* стеклянная панель справа со знаком кофейни */}
      <span
        className="absolute inset-y-0 right-0 grid w-[40%] place-items-center backdrop-blur-xl"
        style={{
          background: isDarkInk ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.14)",
          borderLeft: `1px solid ${isDarkInk ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.18)"}`,
        }}
      >
        <span
          className="grid size-[86px] place-items-center overflow-hidden rounded-full bg-white text-[30px] font-black"
          style={{ color: fill }}
        >
          {card.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            card.name.slice(0, 1).toUpperCase()
          )}
        </span>
      </span>

      {/* текст поверх обложки */}
      <span
        className="relative flex h-full w-[60%] flex-col justify-between p-4"
        style={{ color: ink }}
      >
        <span className="min-w-0">
          <span className="block truncate text-[17px] font-extrabold leading-tight tracking-tight">
            {card.name}
          </span>
          <span className="mt-0.5 block truncate text-[11px]" style={{ opacity: 0.75 }}>
            {card.subtitle}
          </span>
        </span>

        {required > 0 && (
          <span className="block">
            <span className="mb-1.5 flex items-baseline justify-between text-[11px] font-semibold">
              <span style={{ opacity: 0.75 }}>Штампы</span>
              <span className="tabular-nums">
                {card.stamps_count}/{required}
              </span>
            </span>
            <span
              className="block h-1.5 overflow-hidden rounded-full"
              style={{ background: isDarkInk ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.28)" }}
            >
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${progress}%`, background: ink }}
              />
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
