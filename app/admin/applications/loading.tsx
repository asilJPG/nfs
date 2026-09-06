import { SkeletonCard } from "@/components/ui/Skeleton";

export default function ApplicationsLoading() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
