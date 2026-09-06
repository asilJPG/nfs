import { SkeletonBlock, SkeletonList } from "@/components/ui/Skeleton";

export default function VenuesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonBlock className="w-full" style={{ height: 120 }} />
      <SkeletonList rows={3} height={72} />
      <SkeletonBlock className="w-full" style={{ height: 120 }} />
      <SkeletonList rows={2} height={64} />
    </div>
  );
}
