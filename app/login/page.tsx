"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  missing_code: "Ссылка неполная. Запросите вход заново.",
  expired: "Ссылка устарела — такие письма живут час. Запросите новую.",
};

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const linkError = params.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");

    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="text-center">
        <p className="mb-2 text-3xl">📬</p>
        <h1 className="mb-2 text-xl font-semibold">Письмо отправлено</h1>
        <p className="text-sm text-ink-soft">
          Откройте ссылку из письма на <b>{email}</b> — она действует час.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full">
      <h1 className="mb-1 text-xl font-semibold">Вход для кофейни</h1>
      <p className="mb-6 text-sm text-ink-soft">Пришлём ссылку на почту — пароль не нужен.</p>

      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@coffee.uz"
        className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-bean"
      />

      {linkError && <p className="mt-3 text-sm text-red-600">{ERRORS[linkError] ?? ERRORS.expired}</p>}
      {status === "error" && <p className="mt-3 text-sm text-red-600">{message}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-4 w-full rounded-2xl bg-bean py-3 font-medium text-white disabled:opacity-60"
      >
        {status === "sending" ? "Отправляем…" : "Получить ссылку"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-5">
      <Suspense fallback={<p className="text-sm text-ink-soft">Загрузка…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
