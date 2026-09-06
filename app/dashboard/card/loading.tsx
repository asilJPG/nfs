import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function CardSettingsLoading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock key={i} className="w-full" style={{ height: 88 }} />
        ))}
      </div>
      <SkeletonBlock className="w-full" style={{ height: 480 }} />
    </div>
  );
}
