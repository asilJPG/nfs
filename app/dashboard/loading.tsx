import { SkeletonBlock, SkeletonList, SkeletonTile } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </section>
      <SkeletonBlock className="w-full" style={{ height: 280 }} />
      <SkeletonBlock className="w-full" style={{ height: 320 }} />
      <SkeletonList rows={4} height={56} />
    </div>
  );
}
