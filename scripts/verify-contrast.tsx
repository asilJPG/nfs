/**
 * Ищет текст, который не виден: тёмный на тёмном или светлый на светлом.
 *
 * Рендерит статические страницы в разметку и идёт по дереву, наследуя цвет и фон
 * ровно так, как это делает браузер: элемент без своего `text-*` берёт цвет
 * родителя. Именно на этом ломались экраны — тёмная плашка внутри светлой секции
 * (или наоборот) забывает переопределить цвет текста, и он пропадает.
 *
 * Считаются только классы вида `bg-[#RRGGBB]` / `text-[#RRGGBB]` с модификатором
 * прозрачности (`/60`) плюс `bg-white`, `text-white`, `bg-black`, `text-black`:
 * на лендинге и в мини-аппе палитра задана именно так.
 */
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import LandingPage from "../app/page";
import { contrastRatio, relativeLuminance } from "../lib/color";

/** Фон и цвет из <body> — от них наследуется всё остальное (app/globals.css). */
const ROOT_BG = "#08090B";
const ROOT_COLOR = "#F4F4F2";

/** Ниже этого отношения текст считаем нечитаемым: 4.5 — порог WCAG AA для основного текста. */
const MIN_CONTRAST = 4.5;

/**
 * Только настоящие void-элементы HTML. svg-примитивы (path, circle, line…) сюда
 * не входят: React отдаёт их с явным закрывающим тегом, и если считать их
 * самозакрывающимися, стек лишний раз выталкивается и фон уезжает к корню.
 */
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
]);

const NAMED: Record<string, string> = {
  white: "#FFFFFF",
  black: "#000000",
  transparent: "",
  current: "",
  inherit: "",
  ...readThemeColors(),
};

/**
 * Токены палитры читаем прямо из globals.css, чтобы проверка и браузер брали
 * цвета из одного места. Поддержаны формы #RGBA-hex и rgba(...).
 */
function readThemeColors(): Record<string, string> {
  const css = fs.readFileSync("app/globals.css", "utf8");
  const colors: Record<string, string> = {};
  const rule = /--color-([a-z0-9-]+):s*([^;]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = rule.exec(css)) !== null) {
    const [, name, raw] = match;
    const value = raw.trim();

    const hex8 = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(value);
    if (hex8) {
      colors[name] = `#${hex8[1]}`;
      colors[`${name}__alpha`] = String(parseInt(hex8[2], 16) / 255);
      continue;
    }
    const hex6 = /^#([0-9a-f]{6})$/i.exec(value);
    if (hex6) {
      colors[name] = value;
      continue;
    }
    const rgba = /^rgba?(s*(d+)[,s]+(d+)[,s]+(d+)(?:[,s/]+([d.]+))?s*)$/i.exec(value);
    if (rgba) {
      const [, r, g, b, a] = rgba;
      colors[name] = `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, "0")).join("")}`;
      if (a !== undefined) colors[`${name}__alpha`] = a;
    }
  }
  return colors;
}

/**
 * `bgs` — все подложки элемента. У сплошного фона она одна, у градиента их
 * несколько, и проверять надо каждую: для белого текста опасен светлый конец
 * градиента, для тёмного — тёмный.
 */
type Style = { bgs: string[]; color: string };

/** `bg-[#14161D]`, `text-white/60`, `bg-black/[0.04]` → hex + прозрачность. */
function readColorClass(token: string, prefix: "bg" | "text"): { hex: string; alpha: number } | null {
  if (!token.startsWith(`${prefix}-`)) return null;
  let rest = token.slice(prefix.length + 1);

  let alpha = 1;
  // модификатор прозрачности: /60 или /[0.04]
  const slash = rest.lastIndexOf("/");
  if (slash > 0 && rest.indexOf("]", slash) === -1) {
    const raw = rest.slice(slash + 1).replace(/^\[|\]$/g, "");
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) alpha = parsed > 1 ? parsed / 100 : parsed;
    rest = rest.slice(0, slash);
  }

  const arbitrary = /^\[#([0-9a-fA-F]{6})\]$/.exec(rest);
  if (arbitrary) return { hex: `#${arbitrary[1]}`, alpha };

  const named = NAMED[rest];
  if (named === undefined) return null;
  if (named === "") return null;
  // у токена прозрачность зашита в сам цвет (#RRGGBBAA или rgba)
  const tokenAlpha = NAMED[`${rest}__alpha`];
  if (tokenAlpha !== undefined) alpha *= Number(tokenAlpha);
  return { hex: named, alpha };
}

/** Плоское наложение полупрозрачного цвета на подложку. */
function flatten(hex: string, alpha: number, under: string): string {
  if (alpha >= 1) return hex;
  const parse = (value: string) => {
    const int = parseInt(value.replace("#", ""), 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  };
  const top = parse(hex);
  const bottom = parse(under);
  const mixed = top.map((c, i) => Math.round(c * alpha + bottom[i] * (1 - alpha)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

type Finding = { text: string; color: string; bg: string; ratio: number };

function scan(html: string): Finding[] {
  const stack: Style[] = [{ bgs: [ROOT_BG], color: ROOT_COLOR }];
  const findings: Finding[] = [];
  const seen = new Set<string>();
  let svgDepth = 0;

  const token = /<([a-zA-Z][^\s>/]*)((?:"[^"]*"|'[^']*'|[^>"'])*)\/?>|<\/([a-zA-Z][^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = token.exec(html)) !== null) {
    const [full, openTag, attrs, closeTag, text] = match;

    if (openTag) {
      const tag = openTag.toLowerCase();
      if (tag === "svg") svgDepth += 1;

      const parent = stack[stack.length - 1];
      let bgs = parent.bgs;
      let color = parent.color;

      const classAttr = /class="([^"]*)"/.exec(attrs ?? "");
      const classes = (classAttr?.[1] ?? "").split(/\s+/);

      // Градиент закрашивает элемент целиком: держим все остановки и ниже
      // проверяем текст против каждой.
      const stops = classes
        .filter((raw) => /^(from|via|to)-\[#[0-9a-fA-F]{6}\]$/.test(raw))
        .map((raw) => `#${raw.slice(raw.indexOf("#") + 1, raw.indexOf("]"))}`);
      if (stops.length > 0) bgs = stops;

      for (const raw of classes) {
        // варианты вроде hover:/sm:/dark: на статический вид страницы не влияют
        if (!raw || raw.includes(":")) continue;
        const asBg = readColorClass(raw, "bg");
        if (asBg) bgs = bgs.map((under) => flatten(asBg.hex, asBg.alpha, under));
        const asText = readColorClass(raw, "text");
        if (asText) color = flatten(asText.hex, asText.alpha, bgs[0]);
      }

      const selfClosing = full.endsWith("/>") || VOID_TAGS.has(tag);
      if (!selfClosing) stack.push({ bgs, color });
      continue;
    }

    if (closeTag) {
      if (closeTag.trim().toLowerCase() === "svg") svgDepth = Math.max(0, svgDepth - 1);
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (text && svgDepth === 0) {
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (!trimmed || trimmed === "·" || trimmed === "©") continue;
      const { bgs, color } = stack[stack.length - 1];
      // худшая из подложек и решает, видно текст или нет
      let bg = bgs[0];
      let ratio = contrastRatio(color, bg);
      for (const candidate of bgs) {
        const current = contrastRatio(color, candidate);
        if (current < ratio) {
          ratio = current;
          bg = candidate;
        }
      }
      if (ratio < MIN_CONTRAST) {
        const key = `${color}|${bg}|${trimmed.slice(0, 40)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ text: trimmed.slice(0, 60), color, bg, ratio });
      }
    }
  }

  return findings;
}

// Только страницы без серверных зависимостей: ApplyForm тянет server action и
// через него supabase-клиент, которому нужны переменные окружения.
const PAGES: [string, () => React.ReactElement][] = [["/ (лендинг)", LandingPage as () => React.ReactElement]];

let failed = 0;
for (const [label, Page] of PAGES) {
  console.log(`\nЧитаемость текста — ${label}`);
  const findings = scan(renderToStaticMarkup(<Page />));
  if (findings.length === 0) {
    console.log("  ok    невидимого текста нет");
    continue;
  }
  for (const item of findings) {
    const kind =
      relativeLuminance(item.color) < relativeLuminance(item.bg) ? "тёмный на светлом" : "светлый на тёмном";
    console.log(`  FAIL  ${kind}, контраст ${item.ratio.toFixed(2)}`);
    console.log(`        текст: «${item.text}»`);
    console.log(`        цвет ${item.color} на фоне ${item.bg}`);
    failed++;
  }
}

console.log(
  failed === 0
    ? "\nВесь текст на статических страницах читается."
    : `\n${failed} мест с нечитаемым текстом.`,
);
process.exit(failed === 0 ? 0 : 1);
