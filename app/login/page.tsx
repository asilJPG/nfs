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
    <form onSubmit={submit} className="w-full max-w-sm p-8 rounded-[28px] bg-[#14161D] border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Subtle Blue Glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.18),_transparent_65%)]" />

      <div className="mb-6 text-center relative">
        <div className="size-10 rounded-xl bg-[#F4F4F2] text-[#0E0F11] grid place-items-center mx-auto mb-3 shadow-md">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v2M12 2v2M16 2v2M4 8h16v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">Вход в кабинет</h1>
        <p className="mt-1 text-xs text-[#F4F4F2]/50">Кабинет кофейни и касса бариста</p>
      </div>

      <div className="flex flex-col gap-4 relative">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-[#F4F4F2]/50 font-semibold">Логин</span>
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
            placeholder="sfumato"
            className="input text-xs"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-mono uppercase tracking-wider text-[#F4F4F2]/50 font-semibold">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="input text-xs"
          />
        </label>

        {error && (
          <p className="text-xs text-[#E85D45] bg-[#E85D45]/10 p-3 rounded-xl border border-[#E85D45]/20 text-center font-medium">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !login || !password}
          className="btn btn-primary mt-2 py-3 text-xs font-bold"
        >
          {pending ? "Входим…" : "Войти"}
        </button>
      </div>

      <div className="mt-6 border-t border-white/[0.06] pt-5 text-center text-xs text-[#F4F4F2]/50">
        <p>
          Ещё не подключены?{" "}
          <Link href="/apply" className="font-semibold text-[#7BA5FF] hover:underline">
            Оставить заявку
          </Link>
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5 py-8 bg-[#08090B] font-sans antialiased">
      <Suspense fallback={<p className="text-xs text-[#F4F4F2]/40 font-mono">Загрузка…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
