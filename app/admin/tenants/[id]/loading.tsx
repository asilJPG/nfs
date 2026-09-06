import { SkeletonBlock, SkeletonList, SkeletonRow, SkeletonText } from "@/components/ui/Skeleton";

export default function TenantDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SkeletonText width="10rem" />
      <SkeletonBlock className="w-full" style={{ height: 96 }} />
      <div>
        <SkeletonText width="8rem" className="mb-2" />
        <SkeletonList rows={2} height={40} />
      </div>
      <div>
        <SkeletonText width="10rem" className="mb-2" />
        <SkeletonList rows={3} height={40} />
      </div>
      <div>
        <SkeletonText width="12rem" className="mb-2" />
        <SkeletonList rows={4} height={40} />
      </div>
      <SkeletonRow height={20} />
    </div>
  );
}
