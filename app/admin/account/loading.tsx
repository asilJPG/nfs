import { SkeletonBlock, SkeletonText } from "@/components/ui/Skeleton";

export default function AdminAccountLoading() {
  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div className="flex flex-col gap-2">
        <SkeletonText width="10rem" className="h-6" />
        <SkeletonText width="14rem" />
      </div>
      <SkeletonBlock className="w-full" style={{ height: 140 }} />
      <SkeletonBlock className="w-full" style={{ height: 320 }} />
    </div>
  );
}
