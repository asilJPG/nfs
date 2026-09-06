import { SkeletonBlock } from "@/components/ui/Skeleton";

export default function StaffLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <SkeletonBlock className="w-full" style={{ height: 48 }} />
      <SkeletonBlock className="w-full" style={{ height: 320 }} />
      <SkeletonBlock className="w-full" style={{ height: 64 }} />
    </main>
  );
}
