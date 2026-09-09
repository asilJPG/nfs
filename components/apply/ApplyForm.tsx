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
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center bg-[#08090B] font-sans antialiased">
        <div className="p-8 rounded-[28px] bg-[#14161D] border border-white/10 shadow-2xl max-w-xs relative overflow-hidden">
          <div className="size-14 rounded-full bg-gradient-to-br from-[#6B9BFF] to-[#4A7DE0] text-white grid place-items-center text-2xl mx-auto mb-4 shadow-lg shadow-[#5B8DEF]/30">
            ✓
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Заявка отправлена</h1>
          <p className="mt-2 text-xs text-ink-label leading-relaxed">
            Мы свяжемся с вами в течение дня, обсудим детали и подготовим систему лояльности для вашей кофейни.
          </p>
          <Link href="/" className="btn btn-primary mt-6 w-full text-xs font-bold py-3.5">
            На главную
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#08090B] px-4 py-12 font-sans antialiased flex items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-md p-8 rounded-[28px] bg-[#14161D] border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="pointer-events-none absolute -top-16 -right-16 size-44 rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.18),_transparent_65%)]" />

        <header className="mb-6 text-center relative">
          <div className="size-10 rounded-xl bg-[#F4F4F2] text-[#0E0F11] grid place-items-center mx-auto mb-3 shadow-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v2M12 2v2M16 2v2M4 8h16v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Подключение кофейни</h1>
          <p className="mt-1 text-xs text-ink-label">
            Оставьте заявку — свяжемся и бесплатно настроим систему
          </p>
        </header>

        <div className="flex flex-col gap-4 relative">
          <Field label="Название кофейни">
            <input
              value={cafeName}
              onChange={(event) => setCafeName(event.target.value)}
              required
              maxLength={80}
              placeholder="Sfumato Coffee"
              className="input text-xs"
            />
          </Field>

          <Field label="Город" hint="Необязательно">
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              maxLength={60}
              placeholder="Ташкент"
              className="input text-xs"
            />
          </Field>

          <Field label="Имя контакта">
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              required
              maxLength={80}
              placeholder="Шухрат"
              className="input text-xs"
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
              className="input text-xs"
            />
          </Field>

          <Field label="Telegram" hint="@username">
            <input
              value={telegram}
              onChange={(event) => setTelegram(event.target.value)}
              maxLength={60}
              placeholder="@username"
              className="input text-xs"
            />
          </Field>

          <Field label="Комментарий" hint="Число точек, пожелания">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              rows={3}
              className="input text-xs resize-none"
            />
          </Field>

          {error && (
            <p className="text-xs text-[#E85D45] bg-[#E85D45]/10 p-3 rounded-xl border border-[#E85D45]/20 text-center font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || cafeName.length < 2 || contactName.length < 2 || phone.length < 5}
            className="btn btn-primary mt-2 py-3.5 text-xs font-bold"
          >
            {pending ? "Отправляем…" : "Отправить заявку"}
          </button>

          <p className="text-center text-xs text-ink-label pt-2">
            Уже подключены?{" "}
            <Link href="/login" className="font-semibold text-[#7BA5FF] hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}

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
        <span className="text-[11px] font-mono uppercase tracking-wider text-ink-label font-semibold">{label}</span>
        {hint && <span className="text-[10px] text-ink-label font-mono">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
