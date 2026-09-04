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
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="text-2xl font-semibold">Заявка отправлена</h1>
        <p className="text-ink-soft">
          Мы свяжемся с вами по телефону или в Telegram в течение рабочего дня — обсудим детали
          и заведём кофейню.
        </p>
        <Link href="/" className="rounded-2xl border border-line px-5 py-3 text-sm">
          На главную
        </Link>
      </main>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-xl gap-5 px-5 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Заявка на подключение</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Оставьте контакт — свяжемся, обсудим карту и подготовим кофейню под ваш бренд.
        </p>
      </header>

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

      <Field label="Город" hint="Не обязательно">
        <input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          maxLength={60}
          placeholder="Ташкент"
          className={input}
        />
      </Field>

      <Field label="Как к вам обращаться">
        <input
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          required
          maxLength={80}
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

      <Field label="Telegram" hint="@username или ссылка">
        <input
          value={telegram}
          onChange={(event) => setTelegram(event.target.value)}
          maxLength={60}
          placeholder="@barista"
          className={input}
        />
      </Field>

      <Field label="О чём хотите рассказать" hint="Сколько точек, что уже пробовали — необязательно">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={500}
          rows={4}
          className={input}
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending || cafeName.length < 2 || contactName.length < 2 || phone.length < 5}
        className="rounded-2xl bg-bean py-3.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Отправляем…" : "Отправить заявку"}
      </button>

      <p className="text-center text-sm text-ink-soft">
        Уже клиент? <Link href="/login" className="underline">Войти</Link>
      </p>
    </form>
  );
}

const input =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-bean";

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
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}
