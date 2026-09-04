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
  // индекс, который должен проиграть анимацию штампа
  justStamped?: number | null;
};

// та самая бумажная карточка: клетка на штамп, слева направо
export function StampGrid({ filled, total, style, justStamped }: Props) {
  const columns = total <= 6 ? 3 : total <= 12 ? 4 : 5;

  return (
    <ul
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-label={`Собрано ${filled} из ${total} штампов`}
    >
      {Array.from({ length: total }, (_, index) => {
        const isFilled = index < filled;
        const isFresh = justStamped === index;
        return (
          <li
            key={index}
            className={`relative aspect-square rounded-full border-2 grid place-items-center text-2xl transition-colors duration-300 ${
              isFresh ? "animate-stamp" : ""
            }`}
            style={{
              borderColor: isFilled ? "var(--brand-primary)" : "color-mix(in srgb, var(--brand-primary) 22%, transparent)",
              background: isFilled ? "var(--brand-primary)" : "transparent",
              color: isFilled ? "var(--brand-surface)" : "color-mix(in srgb, var(--brand-primary) 25%, transparent)",
            }}
          >
            <span aria-hidden>{GLYPHS[style] ?? GLYPHS.circles}</span>
          </li>
        );
      })}
    </ul>
  );
}
