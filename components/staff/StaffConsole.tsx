"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { redeemAction, type ActionResult } from "@/app/staff/actions";
import { CountUp } from "@/components/ui/CountUp";

type Venue = { id: string; name: string };

export type StaffStats = {
  stampsToday: number;
  stampsDelta: number;
  guestsToday: number;
  rewardsToday: number;
  returnRate: number;
  weeklyCounts: number[];
  recentEvents: {
    id: string;
    type: "stamp" | "reward";
    title: string;
    subtitle: string;
    time: string;
  }[];
  closeToReward: {
    id: string;
    name: string;
    stampsCount: number;
    stampsRequired: number;
  }[];
};

type Props = {
  tenantName: string;
  staffName: string;
  staffRole: string;
  venues: Venue[];
  defaultVenueId: string | null;
  stats?: StaffStats;
  // Владелец и менеджер могут вернуться в свой кабинет — им кассовый экран
  // просто одно из окон. Бариста работает только тут, ему выход не нужен.
  showDashboardLink?: boolean;
  dayISO: string;
  todayISO: string;
  prevDayISO: string;
  nextDayISO: string | null;
};

type ScanState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "unsupported" }
  | { kind: "denied"; message: string };

export function StaffConsole({
  tenantName,
  staffName,
  staffRole,
  venues,
  defaultVenueId,
  stats,
  showDashboardLink,
  dayISO,
  todayISO,
  prevDayISO,
  nextDayISO,
}: Props) {
  const isToday = dayISO === todayISO;
  const dayLabel = isToday
    ? "Сегодня"
    : new Date(`${dayISO}T00:00:00+05:00`).toLocaleDateString("ru-RU", {
        timeZone: "Asia/Tashkent",
        day: "numeric",
        month: "long",
      });
  const dayHint = new Date(`${dayISO}T00:00:00+05:00`).toLocaleDateString("ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  const [venueId, setVenueId] = useState<string | null>(defaultVenueId ?? venues[0]?.id ?? null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [scan, setScan] = useState<ScanState>({ kind: "idle" });
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [pending, startTransition] = useTransition();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const jsQRRef = useRef<((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => () => stopCamera(), []);

  async function startScanner() {
    setShowScannerModal(true);
    setResult(null);
    setScan({ kind: "starting" });

    // BarcodeDetector — Chrome/Android. Для iOS Safari грузим jsQR лениво.
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      const Detector = (window as any).BarcodeDetector;
      detectorRef.current = new Detector({ formats: ["qr_code"] });
    } else {
      try {
        const mod = await import("jsqr");
        jsQRRef.current = mod.default as any;
      } catch {
        setScan({ kind: "unsupported" });
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setScan({ kind: "scanning" });
      tick();
    } catch (error: any) {
      setScan({ kind: "denied", message: error?.message ?? "Не удалось открыть камеру." });
    }
  }

  function tick() {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    const finish = () => {
      if (streamRef.current) rafRef.current = requestAnimationFrame(tick);
    };

    if (detectorRef.current) {
      detectorRef.current
        .detect(video)
        .then((codes: any[]) => {
          if (codes && codes[0]?.rawValue && !busyRef.current) handleToken(codes[0].rawValue);
        })
        .catch(() => {})
        .finally(finish);
      return;
    }

    // jsQR-путь: снимаем кадр с video в canvas, скармливаем ImageData
    const jsQR = jsQRRef.current;
    if (!jsQR || video.videoWidth === 0) {
      finish();
      return;
    }
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    const w = (canvas.width = video.videoWidth);
    const h = (canvas.height = video.videoHeight);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return finish();
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const code = jsQR(img.data, w, h);
    if (code?.data && !busyRef.current) handleToken(code.data);
    finish();
  }

  function handleToken(rawToken: string) {
    busyRef.current = true;
    const token = rawToken.trim();
    startTransition(async () => {
      const outcome = await redeemAction(token, venueId);
      setResult(outcome);
      stopCamera();
      setScan({ kind: "idle" });
      setTimeout(() => (busyRef.current = false), 300);
    });
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    handleToken(manualToken.trim());
    setManualToken("");
  }

  // Calculate polyline points from weekly counts
  const counts = stats?.weeklyCounts ?? [0, 0, 0, 0, 0, 0, 0];
  const maxVal = Math.max(...counts, 1);
  const polyPoints = counts
    .map((val, idx) => {
      const x = Math.round((idx / (counts.length - 1)) * 400);
      const y = Math.round(80 - (val / maxVal) * 60);
      return `${x},${y}`;
    })
    .join(" ");

  const activeVenueName = venues.find((v) => v.id === venueId)?.name ?? null;

  const lastPointY = Math.round(80 - ((counts[counts.length - 1] || 0) / maxVal) * 60);

  // Подписи оси X: пн/вт/… за 7 дней относительно выбранного (последний — сам dayISO).
  const weekdayLabels = Array.from({ length: 7 }).map((_, i) => {
    const [y, m, d] = dayISO.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d - (6 - i)));
    return dt.toLocaleDateString("ru-RU", { timeZone: "UTC", weekday: "short" });
  });

  return (
    <div className="min-h-dvh bg-[#FAFAF9] text-[#0E0F11] font-sans antialiased">
      <div className="min-h-dvh grid grid-cols-1 md:grid-cols-[240px_1fr]">
          
          {/* Left Side Rail */}
          <aside className="bg-[#F0EFEC] border-r border-black/[0.06] p-5 flex flex-col justify-between">
            <div>
              {/* Brand Header */}
              <div className="flex items-center gap-2.5 mb-4 px-1.5">
                <div className="size-6 rounded-[7px] bg-[#0E0F11] grid place-items-center text-[#FAFAF9] shadow-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v2M12 2v2M16 2v2M4 8h16v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold tracking-tight">{tenantName}</span>
              </div>

              {/* Back to owner dashboard — только для владельца/менеджера */}
              {showDashboardLink && (
                <Link
                  href="/dashboard"
                  className="mb-6 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-black/[0.06] text-[12px] font-medium text-[#0E0F11] hover:bg-black/[0.03] transition-all shadow-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                  Вернуться в кабинет
                </Link>
              )}

              {/* Кассе не нужно ветвление — здесь один экран смены.
                  Аналитика и история живут в /dashboard у владельца. */}
              <div className="text-[10px] font-mono text-carbon-label uppercase tracking-widest font-semibold px-3 py-2">
                Смена
              </div>

              {venues.length > 1 && (
                <div className="mt-4 pt-4 border-t border-black/[0.06]">
                  <label className="text-[10px] font-mono text-carbon-label uppercase tracking-wider block mb-1.5 font-semibold">Точка</label>
                  <select
                    value={venueId ?? ""}
                    onChange={(e) => setVenueId(e.target.value || null)}
                    className="w-full text-xs p-2 rounded-lg bg-white border border-black/10 outline-none text-[#0E0F11]"
                  >
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* User Barista Badge + Logout — общий планшет должен уметь
                сменить смену, иначе штампы висят на утреннем бариста. */}
            <div className="mt-6 flex flex-col gap-2">
              <div className="p-3 rounded-xl bg-white border border-black/[0.06] flex items-center gap-2.5 shadow-sm">
                <div className="size-7 rounded-full bg-[#5B8DEF] grid place-items-center text-[#FAFAF9] text-xs font-semibold uppercase">
                  {staffName.trim().charAt(0) || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate leading-tight">{staffName}</div>
                  <div className="text-[10px] text-carbon-label truncate">
                    {staffRole}
                    {activeVenueName ? ` · ${activeVenueName}` : ""}
                  </div>
                </div>
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium text-carbon-label hover:text-[#0E0F11] hover:bg-black/[0.04] transition-all"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                    <path d="M10 8 6 12l4 4" />
                    <path d="M6 12h9" />
                  </svg>
                  Сменить смену
                </button>
              </form>
            </div>
          </aside>

          {/* Main Work Area */}
          <main className="p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Header */}
              <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#0E0F11]">{dayLabel}</h1>
                  <div className="text-xs text-carbon-label mt-1 font-medium">{dayHint}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={startScanner}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0E0F11] text-[#FAFAF9] text-xs font-semibold shadow-sm hover:bg-black transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Сканировать QR
                  </button>
                </div>
              </div>

              {/* Day navigation */}
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <Link
                  href={`/staff?date=${prevDayISO}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0EFEC] text-[11px] font-medium text-[#0E0F11] hover:bg-black/[0.06] transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                  Предыдущий день
                </Link>
                {!isToday && (
                  <Link
                    href="/staff"
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#0E0F11] text-white text-[11px] font-semibold hover:bg-black transition-all"
                  >
                    Сегодня
                  </Link>
                )}
                {nextDayISO && (
                  <Link
                    href={`/staff?date=${nextDayISO}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F0EFEC] text-[11px] font-medium text-[#0E0F11] hover:bg-black/[0.06] transition-all"
                  >
                    Следующий день
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </Link>
                )}
              </div>

              {/* Status Banner / Outcome */}
              {result && (
                <div
                  className={`animate-rise mb-6 p-4 rounded-2xl text-center text-xs font-semibold border ${
                    result.ok
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {result.message}
                </div>
              )}

              {/* 4 Stats Cards with REAL data */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
                <div className="p-3.5 rounded-2xl bg-[#F0EFEC]">
                  <div className="text-[10px] text-carbon-label font-mono uppercase tracking-wider font-semibold mb-1.5">Штампов</div>
                  <div className="text-2xl font-bold tracking-tight">
                    <CountUp value={stats?.stampsToday ?? 0} />
                  </div>
                  <div
                    className={`text-[10px] font-medium mt-1 ${
                      (stats?.stampsDelta ?? 0) > 0
                        ? "text-emerald-700"
                        : (stats?.stampsDelta ?? 0) < 0
                        ? "text-red-700"
                        : "text-carbon-label"
                    }`}
                  >
                    {(stats?.stampsDelta ?? 0) === 0
                      ? "как вчера"
                      : `${(stats?.stampsDelta ?? 0) > 0 ? "+" : ""}${stats?.stampsDelta} vs вчера`}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F0EFEC]">
                  <div className="text-[10px] text-carbon-label font-mono uppercase tracking-wider font-semibold mb-1.5">Гостей</div>
                  <div className="text-2xl font-bold tracking-tight">
                    <CountUp value={stats?.guestsToday ?? 0} />
                  </div>
                  <div className="text-[10px] text-bean-ink font-medium mt-1">уникальных</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F0EFEC]">
                  <div className="text-[10px] text-carbon-label font-mono uppercase tracking-wider font-semibold mb-1.5">Наград</div>
                  <div className="text-2xl font-bold tracking-tight">
                    <CountUp value={stats?.rewardsToday ?? 0} />
                  </div>
                  <div className="text-[10px] text-carbon-label font-medium mt-1">выдано</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F0EFEC]">
                  <div className="text-[10px] text-carbon-label font-mono uppercase tracking-wider font-semibold mb-1.5">Возвраты</div>
                  <div className="text-2xl font-bold tracking-tight">
                    <CountUp value={stats?.returnRate ?? 0} suffix="%" />
                  </div>
                  <div className="text-[10px] text-carbon-label font-medium mt-1">гостей базы</div>
                </div>
              </div>

              {/* Weekly Chart */}
              <div className="p-4 rounded-2xl border border-black/[0.06] bg-white mb-6">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-xs font-semibold">Штампы за неделю</div>
                  <div className="text-[10px] text-carbon-label font-mono uppercase tracking-wider font-semibold">7д · итого {counts.reduce((a, b) => a + b, 0)}</div>
                </div>
                <svg viewBox="0 0 400 90" width="100%" height="90" className="overflow-visible">
                  <defs>
                    <linearGradient id="staffChartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#5B8DEF" stopOpacity="0.25" />
                      <stop offset="1" stopColor="#5B8DEF" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline points={polyPoints} fill="none" stroke="#5B8DEF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points={`0,90 ${polyPoints} 400,90`} fill="url(#staffChartGrad)"/>
                  <circle cx="400" cy={lastPointY} r="4" fill="#5B8DEF"/>
                  <circle cx="400" cy={lastPointY} r="8" fill="#5B8DEF" opacity="0.25"/>
                </svg>
                <div className="mt-2 grid grid-cols-7 text-[10px] text-carbon-label font-mono uppercase text-center">
                  {weekdayLabels.map((w, i) => (
                    <div key={i} className={i === weekdayLabels.length - 1 ? "text-[#0E0F11] font-semibold" : ""}>
                      {w}
                    </div>
                  ))}
                </div>
              </div>

              {/* Близко к награде — реальная помощь бариста */}
              {stats?.closeToReward && stats.closeToReward.length > 0 && (
                <div className="p-4 rounded-2xl border border-black/[0.06] bg-white mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-xs font-semibold">На один штамп до награды</div>
                    <div className="text-[10px] text-carbon-label font-mono uppercase tracking-wider font-semibold">{stats.closeToReward.length}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {stats.closeToReward.map((g) => (
                      <div key={g.id} className="flex justify-between items-center p-2.5 rounded-xl bg-[#F0EFEC] text-xs">
                        <span className="font-semibold text-[#0E0F11]">{g.name}</span>
                        <span className="text-[11px] font-mono text-[#5B8DEF]">{g.stampsCount}/{g.stampsRequired}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity Live Feed with REAL data */}
              <div>
                <div className="text-[10px] text-carbon-label font-mono uppercase tracking-widest font-semibold mb-2.5">Последние события</div>
                <div className="flex flex-col gap-2">
                  {stats?.recentEvents && stats.recentEvents.length > 0 ? (
                    stats.recentEvents.map((ev) => (
                      <div key={ev.id} className="flex justify-between items-center p-2.5 rounded-xl bg-[#F0EFEC] text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`size-2 rounded-full ${ev.type === "reward" ? "bg-[#7BA5FF]" : "bg-[#5B8DEF]"}`} />
                          <span className="font-medium">{ev.title} · {ev.subtitle}</span>
                        </div>
                        <span className="text-[11px] text-carbon-label font-mono">{ev.time}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-[#F0EFEC] text-xs text-carbon-label text-center font-medium">
                      Событий за сегодня пока нет. Приложите телефон к NFC метке или отсканируйте QR награды.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-black/[0.06] text-center text-[11px] text-carbon-label font-mono">
              Stampy Barista · NFC &amp; QR Terminal · {new Date().getFullYear()}
            </div>
          </main>
      </div>

      {/* Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-rise">
          <div className="w-full max-w-sm rounded-[28px] bg-[#14161D] border border-white/10 p-6 shadow-2xl flex flex-col gap-4 text-center">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Сканирование QR-кода</h3>
              <button
                onClick={() => {
                  stopCamera();
                  setShowScannerModal(false);
                  setScan({ kind: "idle" });
                }}
                className="size-7 rounded-full bg-white/10 grid place-items-center text-xs text-ink-body hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full object-cover ${scan.kind === "scanning" ? "" : "hidden"}`}
              />
              {scan.kind !== "scanning" && (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-xs text-ink-label">
                  <span className="text-3xl mb-2">📷</span>
                  {scan.kind === "starting" && "Запуск камеры…"}
                  {scan.kind === "idle" && "Наведите камеру на QR-код гостя"}
                  {scan.kind === "unsupported" && "Сканер не поддерживается в этом браузере. Введите код вручную ниже."}
                  {scan.kind === "denied" && `Доступ к камере отклонен: ${scan.message}`}
                </div>
              )}
            </div>

            <form onSubmit={submitManual} className="flex gap-2">
              <input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="STMP-XXXX-UZ"
                className="input text-xs"
              />
              <button
                type="submit"
                disabled={pending || !manualToken.trim()}
                className="btn btn-primary text-xs px-4"
              >
                {pending ? "..." : "Ввести"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
