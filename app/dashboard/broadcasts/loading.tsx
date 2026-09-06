import { SkeletonBlock, SkeletonList } from "@/components/ui/Skeleton";

export default function BroadcastsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonBlock className="w-full" style={{ height: 220 }} />
      <SkeletonList rows={4} height={72} />
    </div>
  );
}
