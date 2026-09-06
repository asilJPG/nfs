"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { redeemAction, type ActionResult } from "@/app/staff/actions";

type Venue = { id: string; name: string };

type Props = {
  tenantName: string;
  venues: Venue[];
  defaultVenueId: string | null;
};

type ScanState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "unsupported" }
  | { kind: "denied"; message: string };

export function StaffConsole({ tenantName, venues, defaultVenueId }: Props) {
  const [venueId, setVenueId] = useState<string | null>(defaultVenueId ?? venues[0]?.id ?? null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [scan, setScan] = useState<ScanState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
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
    setResult(null);
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setScan({ kind: "unsupported" });
      return;
    }
    setScan({ kind: "starting" });
    try {
      const Detector = (window as any).BarcodeDetector;
      detectorRef.current = new Detector({ formats: ["qr_code"] });
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
    const detector = detectorRef.current;
    if (!video || !detector || !streamRef.current) return;
    detector
      .detect(video)
      .then((codes: any[]) => {
        if (codes && codes[0]?.rawValue && !busyRef.current) {
          handleToken(codes[0].rawValue);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (streamRef.current) rafRef.current = requestAnimationFrame(tick);
      });
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

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8 bg-base text-white font-sans">
      <header className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-ink-faint font-semibold">{tenantName}</span>
          <h1 className="text-xl font-bold tracking-tight text-white">Касса бариста</h1>
        </div>
        <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
      </header>

      {venues.length > 1 && (
        <select
          value={venueId ?? ""}
          onChange={(event) => setVenueId(event.target.value || null)}
          className="input"
        >
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              Точка: {venue.name}
            </option>
          ))}
        </select>
      )}

      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${scan.kind === "scanning" ? "" : "hidden"}`}
        />
        {scan.kind !== "scanning" && (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-xs text-ink-soft">
            <span className="text-3xl mb-3 opacity-60">📷</span>
            {scan.kind === "starting" && "Запускаем камеру…"}
            {scan.kind === "idle" && "Наведите камеру на QR-код на экране гостя"}
            {scan.kind === "unsupported" &&
              "Сканер не поддерживается в этом браузере. Откройте страницу в Chrome на Android или Safari на iOS 17+."}
            {scan.kind === "denied" && `Ошибка камеры: ${scan.message}`}
          </div>
        )}
      </div>

      {scan.kind === "scanning" ? (
        <button
          onClick={() => {
            stopCamera();
            setScan({ kind: "idle" });
          }}
          className="rounded-2xl border border-line bg-surface py-4 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
        >
          Остановить сканер
        </button>
      ) : (
        <button
          onClick={startScanner}
          disabled={pending}
          className="btn btn-primary py-4"
        >
          {pending ? "Проверяем QR…" : "Сканировать QR-код"}
        </button>
      )}

      {result && (
        <div
          className={`animate-rise rounded-2xl p-4 text-center text-xs font-semibold border ${
            result.ok
              ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
              : "bg-red-950/60 text-red-400 border-red-900/40"
          }`}
        >
          {result.message}
        </div>
      )}

      <p className="mt-auto text-center text-[11px] text-ink-faint font-mono leading-relaxed">
        Штампы начисляются автоматически при прикладывании телефона к метке NTAG 424.
      </p>
    </main>
  );
}

