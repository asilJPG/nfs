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
    <form onSubmit={submit} className="w-full">
      <h1 className="mb-1 text-xl font-semibold">Вход для кофейни</h1>
      <p className="mb-6 text-sm text-ink-soft">Логин и пароль, которые вы задали при регистрации.</p>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm text-ink-soft">Логин</span>
        <input
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
          placeholder="coffee-amir"
          className={input}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-ink-soft">Пароль</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className={input}
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || !login || !password}
        className="mt-4 w-full rounded-2xl bg-bean py-3 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Входим…" : "Войти"}
      </button>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Ещё не подключились?{" "}
        <Link href="/apply" className="underline">
          Подать заявку
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-soft">
        Забыли пароль — напишите в{" "}
        <a href="https://t.me/stampy_support" className="underline">
          поддержку
        </a>
        , восстановим вручную.
      </p>
    </form>
  );
}

const input =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-bean";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm place-items-center px-5">
      <Suspense fallback={<p className="text-sm text-ink-soft">Загрузка…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
