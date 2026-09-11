import { SkeletonBlock, SkeletonTile } from "@/components/ui/Skeleton";

// Форма страницы: KPI-ряд из 4 плиток → большая таблица кофеен →
// два блока карточек внизу. Дублировать 4+4 плитки, как было
// раньше, — вводит в заблуждение о том, что грузится.
export default function AdminOverviewLoading() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </section>
      <SkeletonBlock className="w-full" style={{ height: 320 }} />
      <div className="grid gap-3 md:grid-cols-2">
        <SkeletonBlock className="w-full" style={{ height: 180 }} />
        <SkeletonBlock className="w-full" style={{ height: 180 }} />
      </div>
    </div>
  );
}
