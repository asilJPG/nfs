"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitApplication } from "@/app/apply/actions";

export function ApplyForm() {
  const [cafeName, setCafeName] = useState("");
  const [city, setCity] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitApplication({
        cafe_name: cafeName,
        city: city || undefined,
        contact_name: contactName,
        phone,
        telegram: telegram || undefined,
        message: message || undefined,
      });
      if (result.ok) setSent(true);
      else setError(result.message);
    });
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center bg-zinc-950 font-sans">
        <div className="premium-card p-8 shadow-2xl bg-zinc-950 border-zinc-800 max-w-xs">
          <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-400 grid place-items-center text-xl mx-auto mb-3 border border-emerald-500/20">
            ✓
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">Заявка отправлена</h1>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
            Мы свяжемся с вами в течение дня, обсудим детали и подготовим систему лояльности для вашей кофейни.
          </p>
          <Link href="/" className="mt-6 inline-block w-full rounded-xl bg-white py-3 text-xs font-bold text-zinc-950 hover:bg-zinc-200 transition-colors">
            На главную
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-zinc-950 px-4 py-12 font-sans flex items-center justify-center">
      <form onSubmit={submit} className="premium-card w-full max-w-md p-8 shadow-2xl bg-zinc-950/90 border-zinc-800">
        <header className="mb-6 text-center">
          <span className="text-2xl mb-2 block">☕</span>
          <h1 className="text-2xl font-bold tracking-tight text-white">Подключение кофейни</h1>
          <p className="mt-1 text-xs text-zinc-400">
            Оставьте заявку — свяжемся и бесплатно настроим систему
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <Field label="Название кофейни">
            <input
              value={cafeName}
              onChange={(event) => setCafeName(event.target.value)}
              required
              maxLength={80}
              placeholder="Кофе на Амире Темура"
              className={input}
            />
          </Field>

          <Field label="Город" hint="Необязательно">
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={60}
              placeholder="Ташкент"
              className={input}
            />
          </Field>

          <Field label="Имя контакта">
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              required
              maxLength={80}
              placeholder="Ислом"
              className={input}
            />
          </Field>

          <Field label="Телефон">
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
              maxLength={30}
              placeholder="+998 90 123-45-67"
              className={input}
            />
          </Field>

          <Field label="Telegram" hint="@username">
            <input
              value={telegram}
              onChange={(event) => setTelegram(event.target.value)}
              maxLength={60}
              placeholder="@username"
              className={input}
            />
          </Field>

          <Field label="Комментарий" hint="Число точек, пожелания — необязательно">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              rows={3}
              className={input}
            />
          </Field>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 p-3 rounded-xl border border-red-900/30 text-center font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || cafeName.length < 2 || contactName.length < 2 || phone.length < 5}
            className="mt-2 w-full rounded-xl bg-white py-3.5 text-xs font-bold text-zinc-950 hover:bg-zinc-200 transition-all disabled:opacity-50"
          >
            {pending ? "Отправляем…" : "Отправить заявку"}
          </button>

          <p className="text-center text-xs text-zinc-500 pt-2">
            Уже подключены?{" "}
            <Link href="/login" className="font-semibold text-zinc-300 hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}

const input =
  "w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-xs text-white placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">{label}</span>
        {hint && <span className="text-[10px] text-zinc-500 font-mono">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

