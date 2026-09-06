// Универсальные скелетоны — базовые примитивы для loading.tsx во всех разделах.
// Дают гарантию что пользователь видит форму страницы моментально, пока данные летят.

type BlockProps = {
  className?: string;
  style?: React.CSSProperties;
};

export function SkeletonBlock({ className = "", style }: BlockProps) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-white/[0.06] ${className}`}
      style={style}
      aria-hidden
    />
  );
}

export function SkeletonText({ width = "8rem", className = "" }: { width?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-white/[0.06] ${className}`}
      style={{ width, height: "0.9em" }}
      aria-hidden
    />
  );
}

export function SkeletonTile() {
  return (
    <div className="card p-5">
      <SkeletonText width="6rem" className="mb-3" />
      <SkeletonText width="4rem" className="mb-2 h-8" />
      <SkeletonText width="7rem" />
    </div>
  );
}

export function SkeletonRow({ height = 56 }: { height?: number }) {
  return <SkeletonBlock className="w-full" style={{ height }} />;
}

export function SkeletonList({ rows = 5, height = 56 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} height={height} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <SkeletonText width="10rem" className="h-5" />
        <SkeletonText width="4rem" />
      </div>
      <SkeletonList rows={3} height={40} />
    </div>
  );
}
