// Скелет /staff должен повторять реальную раскладку StaffConsole:
// светлый фон, сайдбар 240px + основная зона с KPI-плитками, графиком
// и списком событий. Общие SkeletonBlock тут не годятся — они
// bg-white/6 под тёмный кабинет, на белом фоне их не видно.

const shimmer = "animate-pulse rounded-2xl bg-black/[0.06]";
const chip = "animate-pulse rounded-xl bg-black/[0.06]";

export default function StaffLoading() {
  return (
    <div className="min-h-dvh bg-[#FAFAF9] text-[#0E0F11]">
      <div className="min-h-dvh grid grid-cols-1 md:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="bg-[#F0EFEC] border-r border-black/[0.06] p-5 flex flex-col justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 mb-2 px-1.5">
              <div className={`${chip} size-6`} />
              <div className={`${chip} h-4 w-24`} />
            </div>
            <div className={`${chip} h-9 w-full`} />
            <div className={`${chip} h-5 w-16 mt-2 mx-3`} />
          </div>
          <div className="flex flex-col gap-2">
            <div className={`${chip} h-12 w-full`} />
            <div className={`${chip} h-8 w-2/3`} />
          </div>
        </aside>

        {/* Main */}
        <main className="p-6 md:p-8 flex flex-col gap-6">
          <div className="flex justify-between items-end gap-3">
            <div className="flex flex-col gap-2">
              <div className={`${chip} h-7 w-32`} />
              <div className={`${chip} h-3 w-40`} />
            </div>
            <div className={`${chip} h-10 w-36`} />
          </div>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${shimmer} h-[88px]`} />
            ))}
          </section>

          <div className={`${shimmer} h-[140px]`} />

          <div className="flex flex-col gap-2">
            <div className={`${chip} h-3 w-32 mb-1`} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${chip} h-11 w-full`} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
