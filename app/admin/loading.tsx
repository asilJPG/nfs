import { SkeletonTile } from "@/components/ui/Skeleton";

export default function AdminOverviewLoading() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonTile key={i} />
        ))}
      </section>
    </div>
  );
}
