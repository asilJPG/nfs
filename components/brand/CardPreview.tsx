import type { Brand } from "@/types/db";

const GLYPHS: Record<Brand["card_style"], string> = {
  circles: "●",
  cups: "☕",
  hearts: "♥",
  stars: "★",
};

type Props = {
  brand: Brand;
  name: string;
  logoUrl?: string | null;
  stamps: number;
  filled?: number;
  reward: string;
};

/** Exactly what the customer sees, at phone width — used wherever brand is edited. */
export function CardPreview({ brand, name, logoUrl, stamps, filled = 2, reward }: Props) {
  const columns = stamps <= 6 ? 3 : stamps <= 12 ? 4 : 5;

  return (
    <div className="rounded-3xl p-4 shadow-sm" style={{ background: brand.bg, color: brand.text }}>
      <div className="mb-4 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-10 rounded-2xl object-cover" />
        ) : (
          <div
            className="grid size-10 place-items-center rounded-2xl text-base font-semibold"
            style={{ background: brand.primary, color: brand.surface }}
          >
            {(name || "K").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{name || "Ваша кофейня"}</p>
          <p className="text-xs opacity-60">Карта лояльности</p>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: brand.surface }}>
        <p className="text-xs opacity-60">
          Ещё {Math.max(0, stamps - filled)} до награды
        </p>
        <p className="mb-3 font-semibold">{reward || "Бесплатный кофе"}</p>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
          {Array.from({ length: stamps }, (_, index) => {
            const isFilled = index < filled;
            return (
              <div
                key={index}
                className="grid aspect-square place-items-center rounded-full border-2 text-lg"
                style={{
                  borderColor: isFilled ? brand.primary : `${brand.primary}33`,
                  background: isFilled ? brand.primary : "transparent",
                  color: isFilled ? brand.surface : `${brand.primary}55`,
                }}
              >
                <span aria-hidden>{GLYPHS[brand.card_style]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Rough WCAG contrast, so a shop cannot ship white text on white. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const value = hex.replace("#", "");
    const channels = [0, 2, 4].map((offset) => {
      const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
