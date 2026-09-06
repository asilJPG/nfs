import { SkeletonList, SkeletonRow } from "@/components/ui/Skeleton";

export default function GuestsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonRow height={48} />
      <SkeletonRow height={16} />
      <SkeletonList rows={6} height={64} />
    </div>
  );
}
