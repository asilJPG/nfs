"use client";

import type { Brand } from "@/types/db";
import { StampMark } from "@/components/brand/StampMark";
import { readableFill, shade, withAlpha } from "@/lib/color";

export { inkOn, shade } from "@/lib/color";

export type WalletCardData = {
  slug: string;
  name: string;
  subtitle: string;
  logo_url: string | null;
  brand: Pick<Brand, "primary"> & Partial<Brand>;
  stamps_count: number;
  stamps_required: number | null;
  is_ready?: boolean;
};

export function Monogram({
  name,
  logoUrl,
  ink,
  size = 36,
}: {
  name: string;
  logoUrl: string | null;
  ink: string;
  size?: number;
}) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl font-bold font-mono"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: withAlpha(ink, 0.15),
        color: ink,
        border: `1px solid ${withAlpha(ink, 0.3)}`,
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

/**
 * Карточка в стеке кошелька. Фон — цвет кофейни, поэтому весь текст берёт
 * контрастные чернила из inkOn(): у кофейни со светлым брендом карточка
 * раньше уезжала в белое по белому.
 */
export function WalletCardRow({
  card,
  onClick,
  isActive,
}: {
  card: WalletCardData;
  onClick: () => void;
  isActive?: boolean;
}) {
  const { background: fill, ink } = readableFill(card.brand.primary ?? "#1B1E27");
  const accent = card.brand.accent ?? fill;
  const required = card.stamps_required ?? 6;
  const count = card.stamps_count;
  const isReady = card.is_ready || count >= required;
  const columns = required <= 7 ? required : Math.ceil(required / 2);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`relative w-full text-left cursor-pointer transition-all duration-300 ${
        isActive ? "wallet-card-hero rounded-[28px] p-6 min-h-[230px]" : "rounded-[22px] p-5 hover:scale-[1.01]"
      }`}
      aria-label={`Карта ${card.name}: ${count} из ${required} штампов`}
      style={{
        background: `linear-gradient(160deg, ${shade(fill, 0.06)} 0%, ${shade(fill, -0.08)} 100%)`,
        color: ink,
        border: `1px solid ${isReady ? withAlpha(accent, 0.4) : withAlpha(ink, isActive ? 0.14 : 0.1)}`,
        boxShadow: isReady
          ? `0 18px 44px -22px ${withAlpha(fill, 0.75)}, 0 0 22px -10px ${withAlpha(accent, 0.4)}`
          : `0 18px 44px -22px ${withAlpha(fill, 0.55)}`,
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="min-w-0 pr-2">
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-1 font-medium truncate"
            style={{ color: withAlpha(ink, 0.7) }}
          >
            {card.name}
          </div>
          <div className={`${isActive ? "wallet-card-count text-2xl" : "text-base"} font-bold tracking-tight`}>
            {isReady ? "Награда готова" : `${count} из ${required}`}
          </div>
        </div>
        {isReady ? (
          <span
            className="shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
            style={{ background: ink, color: fill }}
          >
            Готова
          </span>
        ) : (
          <span className="shrink-0 text-xs font-medium" style={{ color: withAlpha(ink, 0.6) }}>
            осталось {Math.max(0, required - count)}
          </span>
        )}
      </div>

      {/* Мини-слоты штампов */}
      <div
        className={`grid ${isActive ? "gap-2.5 pt-5" : "gap-1.5 pt-2"}`}
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          borderTop: `1px solid ${withAlpha(ink, 0.12)}`,
        }}
      >
        {Array.from({ length: required }, (_, i) => {
          const filled = i < count;
          const isLast = i === required - 1;
          return (
            <div
              key={i}
              className="aspect-square rounded-full grid place-items-center"
              style={{
                background: filled ? ink : isLast ? withAlpha(ink, 0.12) : "transparent",
                border: filled
                  ? "none"
                  : isLast
                    ? `1px dashed ${withAlpha(ink, 0.5)}`
                    : `1px solid ${withAlpha(ink, 0.22)}`,
              }}
            >
              {filled && (
                <StampMark
                  style={card.brand.card_style ?? "circles"}
                  size={isActive ? 12 : 8}
                  color={fill}
                  filled
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
