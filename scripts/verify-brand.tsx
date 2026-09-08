/**
 * Оформление кофейни должно доезжать до гостя: карточка, сетка штампов и строка
 * кошелька рисуются цветами из brand, а не зашитой синевой Stampy. Плюс проверка,
 * что текст на карточке кошелька контрастен фону — светлый бренд однажды уже
 * давал белым по белому.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { CardPreview } from "../components/brand/CardPreview";
import { WalletCardRow } from "../components/card/WalletCard";
import { contrastRatio, plateColors, readableFill } from "../lib/color";
import { StampGrid } from "../components/card/StampGrid";
import type { Brand } from "../types/db";

const STAMPY_BLUE = "#5b8def";

const BRANDS: Record<string, Brand> = {
  "тёмный бренд": {
    primary: "#5B8DEF", bg: "#0E1424", surface: "#17223B",
    text: "#F4F4F2", accent: "#7BA5FF", card_style: "circles",
  },
  "светлый бренд": {
    primary: "#C8A27A", bg: "#FFF8F0", surface: "#FFFFFF",
    text: "#2A1E17", accent: "#6F4E37", card_style: "cups",
  },
  "почти белый бренд": {
    primary: "#F2EFE9", bg: "#FFFFFF", surface: "#FBFAF8",
    text: "#141414", accent: "#8A7B67", card_style: "hearts",
  },
  "битый бренд (текст = фон)": {
    primary: "#FFFFFF", bg: "#FFFFFF", surface: "#FFFFFF",
    text: "#FFFFFF", accent: "#FFFFFF", card_style: "circles",
  },
  "кислотный": {
    primary: "#00FF88", bg: "#001B10", surface: "#00301C",
    text: "#EAFFF4", accent: "#7CFFC4", card_style: "stars",
  },
};

const STAGES: [string, number][] = [["пустая", 0], ["частичная", 3], ["полная", 6]];

let failed = 0;
const check = (name: string, condition: boolean) => {
  console.log(`  ${condition ? "ok  " : "FAIL"}  ${name}`);
  if (!condition) failed++;
};

console.log("\nОформление кофейни на карточках гостя");
for (const [label, brand] of Object.entries(BRANDS)) {
  for (const [stage, filled] of STAGES) {
    const html = renderToStaticMarkup(
      <>
        <CardPreview brand={brand} name="Кофейня" logoUrl={null} stamps={6} filled={filled} reward="Капучино в подарок" />
        <StampGrid brand={brand} filled={filled} total={6} />
        <WalletCardRow
          card={{ slug: "s", name: "Кофейня", subtitle: "", logo_url: null, brand, stamps_count: filled, stamps_required: 6 }}
          onClick={() => {}}
        />
      </>,
    );
    const lower = html.toLowerCase();
    check(
      `${label} · ${stage} — цвет бренда в разметке`,
      lower.includes(brand.primary.toLowerCase()) || lower.includes(hexToRgb(brand.primary)),
    );
    if (brand.primary.toLowerCase() !== STAMPY_BLUE) {
      check(`${label} · ${stage} — нет зашитой синевы Stampy`, !lower.includes(STAMPY_BLUE));
    }
  }
}

console.log("\nЧитаемость текста на карточке кошелька");
for (const [label, brand] of Object.entries(BRANDS)) {
  const { background, ink } = readableFill(brand.primary);
  check(`${label} — контраст текста ≥ 4.5`, contrastRatio(ink, background) >= 4.5);
}

console.log("\nЧитаемость текста на плашке карты");
for (const [label, brand] of Object.entries(BRANDS)) {
  const plate = plateColors(brand);
  check(`${label} — текст на карточке ≥ 4.5`, contrastRatio(plate.text, plate.surface) >= 4.5);
  check(`${label} — акцент на карточке ≥ 3`, contrastRatio(plate.accent, plate.surface) >= 3);
}

function hexToRgb(hex: string): string {
  const int = parseInt(hex.replace("#", ""), 16);
  return `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
}

console.log(
  failed === 0
    ? "\nОформление доезжает до гостя во всех комбинациях."
    : `\n${failed} проверок провалено.`,
);
process.exit(failed === 0 ? 0 : 1);
