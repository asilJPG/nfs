"use client";

import Link from "next/link";
import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";

function LoginForm() {
  const next = useSearchParams().get("next") ?? undefined;
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signIn({ login, password, next });
      if (result) setError(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="premium-card w-full max-w-sm p-8 shadow-2xl bg-zinc-950/90 border-zinc-800">
      <div className="mb-6 text-center">
        <span className="text-2xl mb-2 block">☕</span>
        <h1 className="text-xl font-bold tracking-tight text-white">Вход в кабинет</h1>
        <p className="mt-1 text-xs text-zinc-400">Введите ваш логин и пароль кофейни</p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-zinc-400">Логин</span>
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
            placeholder="coffee-owner"
            className={input}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-zinc-400">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className={input}
          />
        </label>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded-xl border border-red-900/30 text-center font-medium">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !login || !password}
          className="mt-2 w-full rounded-xl bg-white py-3.5 text-xs font-bold text-zinc-950 hover:bg-zinc-200 transition-all disabled:opacity-50"
        >
          {pending ? "Входим…" : "Войти"}
        </button>
      </div>

      <div className="mt-6 border-t border-zinc-900 pt-5 text-center text-xs text-zinc-500">
        <p>
          Ещё не с нами?{" "}
          <Link href="/apply" className="font-semibold text-zinc-300 hover:underline">
            Подать заявку
          </Link>
        </p>
      </div>
    </form>
  );
}

const input =
  "w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5 py-8 bg-zinc-950 font-sans">
      <Suspense fallback={<p className="text-xs text-zinc-500 font-mono">Загрузка…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

