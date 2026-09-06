import { SkeletonCard, SkeletonRow } from "@/components/ui/Skeleton";

export default function TenantsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonRow height={72} />
      <section className="flex flex-col gap-2">
        <SkeletonRow height={20} />
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </section>
    </div>
  );
}
