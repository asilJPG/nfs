import { SkeletonBlock, SkeletonList } from "@/components/ui/Skeleton";

export default function TagsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonBlock className="w-full" style={{ height: 160 }} />
      <SkeletonBlock className="w-full" style={{ height: 48 }} />
      <SkeletonList rows={6} height={44} />
    </div>
  );
}
