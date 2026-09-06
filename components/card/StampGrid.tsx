import type { Brand } from "@/types/db";

const GLYPHS: Record<Brand["card_style"], string> = {
  circles: "●",
  cups: "☕",
  hearts: "♥",
  stars: "★",
};

type Props = {
  filled: number;
  total: number;
  style: Brand["card_style"];
  justStamped?: number | null;
};

/**
 * Ряд штампов на белой панели внутри карты — по референсу это место штрихкода
 * в кошельке: светлая плашка, на которой лежит «главное» карты.
 */
export function StampGrid({ filled, total, style, justStamped }: Props) {
  const columns = total <= 6 ? total : total <= 12 ? Math.ceil(total / 2) : Math.ceil(total / 3);

  return (
    <ul
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={`Собрано ${filled} из ${total} штампов`}
    >
      {Array.from({ length: total }, (_, index) => {
        const isFilled = index < filled;
        const isFresh = justStamped === index;
        return (
          <li
            key={index}
            className={`flex aspect-square items-center justify-center rounded-full text-[13px] transition-all duration-300 ${
              isFresh ? "animate-stamp" : ""
            }`}
            style={{
              background: isFilled ? "var(--brand-primary)" : "#efefef",
              color: isFilled ? "#ffffff" : "#c9c9c9",
            }}
          >
            <span aria-hidden>{GLYPHS[style] ?? GLYPHS.circles}</span>
          </li>
        );
      })}
    </ul>
  );
}
