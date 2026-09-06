import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function BillingLoading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonBlock className="w-full" style={{ height: 160 }} />
      <SkeletonBlock className="w-full" style={{ height: 220 }} />
    </div>
  );
}
