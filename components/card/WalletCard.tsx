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

/** Свёрнутая карта в списке кошелька: цветная плашка, монограмма, прогресс. */
export function WalletCardRow({
  card,
  onClick,
}: {
  card: WalletCardData;
  onClick: () => void;
}) {
  const fill = card.brand.primary ?? "#7c3aed";
  const ink = inkOn(fill);
  const required = card.stamps_required ?? 0;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left transition-transform active:scale-[0.98]"
      style={{ background: fill, color: ink }}
    >
      <Monogram name={card.name} logoUrl={card.logo_url} ink={ink} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold tracking-tight">{card.name}</span>
        <span className="block truncate text-[11px]" style={{ opacity: 0.7 }}>
          {card.subtitle}
        </span>
      </span>
      {required > 0 && (
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums"
          style={{
            background: ink === "#141414" ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.2)",
          }}
        >
          {card.stamps_count}/{required}
        </span>
      )}
    </button>
  );
}
