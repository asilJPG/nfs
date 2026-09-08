import type { Brand } from "@/types/db";

const PATHS: Record<Brand["card_style"], React.ReactNode> = {
  circles: <path d="M20 6L9 17l-5-5" />,
  cups: (
    <>
      <path d="M8 2v2M12 2v2M16 2v2" />
      <path d="M4 8h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
      <path d="M17 10h2a2 2 0 0 1 0 4h-2" />
    </>
  ),
  hearts: <path d="M12 20s-7-4.6-7-9.4A4 4 0 0 1 12 7a4 4 0 0 1 7 3.6C19 15.4 12 20 12 20Z" />,
  stars: <polygon points="12 2 15 8.5 22 9.5 17 14.5 18.2 21.5 12 18 5.8 21.5 7 14.5 2 9.5 9 8.5 12 2" />,
};

/** Значок штампа в стиле, который кофейня выбрала в кабинете. */
export function StampMark({
  style = "circles",
  size = 12,
  color,
  filled = false,
}: {
  style?: Brand["card_style"];
  size?: number;
  color: string;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled && style !== "circles" && style !== "cups" ? color : "none"}
      stroke={color}
      strokeWidth={style === "circles" ? 3.5 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[style] ?? PATHS.circles}
    </svg>
  );
}
