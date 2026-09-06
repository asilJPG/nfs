import { SkeletonBlock, SkeletonList } from "@/components/ui/Skeleton";

export default function DashboardTagsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonBlock className="w-full" style={{ height: 80 }} />
      <SkeletonList rows={5} height={52} />
    </div>
  );
}
