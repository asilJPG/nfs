"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onClose: () => void;
  onTagRead: (startParam: string) => void | Promise<void>;
};

// NDEFReader — Web NFC API. Есть в Chrome Android 89+, iOS Safari не поддерживает.
type NDEFReaderCtor = new () => {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  addEventListener(
    event: "reading",
    listener: (event: { message: { records: { recordType: string; data: DataView }[] } }) => void,
  ): void;
};

declare global {
  interface Window {
    NDEFReader?: NDEFReaderCtor;
  }
}

type Phase = "starting" | "ready" | "unsupported" | "denied";

export function NfcScanSheet({ onClose, onTagRead }: Props) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const NDEFReader = window.NDEFReader;
    if (!NDEFReader) {
      setPhase("unsupported");
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const reader = new NDEFReader();

    reader.addEventListener("reading", (event) => {
      for (const record of event.message.records) {
        if (record.recordType !== "url" && record.recordType !== "absolute-url") continue;
        const url = new TextDecoder().decode(record.data);
        const startParam = extractStartParam(url);
        if (startParam) {
          controller.abort();
          void onTagRead(startParam);
          return;
        }
      }
    });

    reader
      .scan({ signal: controller.signal })
      .then(() => setPhase("ready"))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "не удалось запустить NFC";
        setError(msg);
        setPhase("denied");
      });

    return () => controller.abort();
  }, [onTagRead]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl"
        style={{ background: "var(--brand-surface)", color: "var(--brand-text)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full text-3xl"
          style={{ background: "var(--brand-primary)", color: "var(--brand-surface)" }}
        >
          📶
        </div>

        {phase === "starting" && <Splash text="Запускаем NFC…" />}
        {phase === "ready" && (
          <Splash text="Приложите телефон к метке кофейни" pulse />
        )}
        {phase === "unsupported" && (
          <>
            <h2 className="mb-2 text-lg font-semibold">На этом устройстве нужен тап</h2>
            <p className="text-sm opacity-70">
              Приложите телефон к NFC-подставке. iOS покажет уведомление сверху — тапните по нему.
              Штамп появится здесь автоматически.
            </p>
          </>
        )}
        {phase === "denied" && (
          <>
            <h2 className="mb-2 text-lg font-semibold">Не удалось запустить NFC</h2>
            <p className="text-sm opacity-70">{error ?? "Проверьте что NFC включён в настройках телефона."}</p>
          </>
        )}

        <button onClick={onClose} className="mt-5 w-full rounded-2xl py-3 text-sm opacity-70">
          Закрыть
        </button>
      </div>
    </div>
  );
}

function Splash({ text, pulse }: { text: string; pulse?: boolean }) {
  return (
    <p className={`text-lg font-medium ${pulse ? "animate-pulse" : ""}`}>{text}</p>
  );
}

function extractStartParam(url: string): string | null {
  try {
    const u = new URL(url);
    // t.me/<bot>/app?startapp=tap_<slug>
    const s = u.searchParams.get("startapp");
    if (s) return s;
    // /t?picc_data=...&cmac=... — для NTAG 424 полезной нагрузки не берём,
    // а идём по обычной ссылке — сервер сам всё сделает и создаст токен.
    // NDEF в этом случае содержит нашу URL, но чтобы штамп прошёл через мини-апп
    // нужно поехать по прямой ссылке. Возвращаем null — модалка закроется, редиректа не будет.
    return null;
  } catch {
    return null;
  }
}
