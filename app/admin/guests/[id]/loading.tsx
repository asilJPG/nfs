import { SkeletonBlock, SkeletonList, SkeletonText } from "@/components/ui/Skeleton";

export default function GuestDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonText width="10rem" />
      <SkeletonBlock className="w-full" style={{ height: 120 }} />
      <div>
        <SkeletonText width="6rem" className="mb-2" />
        <SkeletonList rows={2} height={48} />
      </div>
      <div>
        <SkeletonText width="10rem" className="mb-2" />
        <SkeletonList rows={5} height={40} />
      </div>
    </div>
  );
}
