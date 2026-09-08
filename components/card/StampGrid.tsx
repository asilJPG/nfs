"use client";

import type { Brand } from "@/types/db";
import { StampMark } from "@/components/brand/StampMark";
import { withAlpha } from "@/lib/color";

type Props = {
  filled: number;
  total: number;
  brand: Brand;
  justStamped?: number | null;
};

/** Сетка штампов в цветах кофейни — ровно то, что владелец собрал в кабинете. */
export function StampGrid({ filled, total, brand, justStamped }: Props) {
  // до 7 кружков в ряд, дальше — в две строки
  const cols = total <= 7 ? total : Math.ceil(total / 2);
  const primary = brand.primary;
  const accent = brand.accent || primary;

  return (
    <div
      className="grid gap-2 relative w-full"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label={`Собрано ${filled} из ${total} штампов`}
    >
      {Array.from({ length: total }, (_, index) => {
        const isFilled = index < filled;
        const isLast = index === total - 1;
        const isNext = index === filled;
        const isFresh = justStamped === index;

        if (isFilled) {
          return (
            <div
              key={index}
              className={`aspect-square rounded-full grid place-items-center transition-all duration-300 ${
                isFresh ? "animate-stamp" : ""
              }`}
              style={{ background: primary, boxShadow: `0 2px 8px ${withAlpha(primary, 0.3)}` }}
            >
              <StampMark style={brand.card_style} color={brand.surface} filled />
            </div>
          );
        }

        // последняя ячейка — награда, её всегда видно
        if (isLast) {
          return (
            <div
              key={index}
              className="aspect-square rounded-full grid place-items-center transition-all"
              style={{
                border: isNext ? `2px solid ${accent}` : `1px dashed ${withAlpha(accent, 0.6)}`,
                background: withAlpha(accent, isNext ? 0.2 : 0.1),
                boxShadow: isNext ? `0 0 16px ${withAlpha(accent, 0.5)}` : undefined,
              }}
            >
              <StampMark style="stars" size={11} color={accent} filled={isNext} />
            </div>
          );
        }

        return (
          <div
            key={index}
            className="aspect-square rounded-full transition-all"
            style={{
              border: isNext ? `1px solid ${withAlpha(primary, 0.6)}` : `1px solid ${withAlpha(brand.text, 0.15)}`,
              background: isNext ? withAlpha(primary, 0.1) : withAlpha(brand.text, 0.03),
            }}
          />
        );
      })}
    </div>
  );
}
