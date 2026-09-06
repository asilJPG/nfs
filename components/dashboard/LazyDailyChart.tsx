"use client";

import dynamic from "next/dynamic";
import type { AnalyticsDay } from "@/types/db";
import { SkeletonBlock } from "@/components/ui/Skeleton";

// Recharts весит ~180KB gzip. Не тащим его в общий бандл — грузим только когда
// пользователь открыл дашборд, с fallback-скелетоном пока чанк едет.
const DailyChart = dynamic(
  () => import("./DailyChart").then((mod) => ({ default: mod.DailyChart })),
  {
    ssr: false,
    loading: () => <SkeletonBlock className="w-full" style={{ height: 256 }} />,
  },
);

export function LazyDailyChart({ data }: { data: AnalyticsDay[] }) {
  return <DailyChart data={data} />;
}
