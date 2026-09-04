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

/** Cashier surface: one camera, one QR to scan, one answer. */
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header>
        <p className="text-sm text-ink-soft">{tenantName}</p>
        <h1 className="text-xl font-semibold">Касса</h1>
      </header>

      {venues.length > 1 && (
        <select
          value={venueId ?? ""}
          onChange={(event) => setVenueId(event.target.value || null)}
          className="w-full rounded-2xl border border-line bg-white px-4 py-3"
        >
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
      )}

      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${scan.kind === "scanning" ? "" : "hidden"}`}
        />
        {scan.kind !== "scanning" && (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/80">
            {scan.kind === "starting" && "Запускаем камеру…"}
            {scan.kind === "idle" && "Наведите камеру на QR гостя"}
            {scan.kind === "unsupported" &&
              "Этот браузер не умеет сканировать QR. Откройте кассу в Chrome (Android) или Safari (iOS 17+)."}
            {scan.kind === "denied" && `Не удалось открыть камеру: ${scan.message}`}
          </div>
        )}
      </div>

      {scan.kind === "scanning" ? (
        <button
          onClick={() => {
            stopCamera();
            setScan({ kind: "idle" });
          }}
          className="rounded-2xl border border-line py-4 text-lg font-medium"
        >
          Остановить
        </button>
      ) : (
        <button
          onClick={startScanner}
          disabled={pending}
          className="rounded-2xl bg-bean py-4 text-lg font-medium text-white disabled:opacity-50"
        >
          {pending ? "Проверяем…" : "Сканировать QR"}
        </button>
      )}

      {result && (
        <p
          className={`animate-rise rounded-2xl px-4 py-4 text-center font-medium ${
            result.ok ? "bg-bean/10 text-bean-dark" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}

      <p className="mt-auto text-center text-xs text-ink-soft">
        Штампы гость ставит сам, приложив телефон к подставке. На кассе — только выдача наград по QR.
      </p>
    </main>
  );
}
