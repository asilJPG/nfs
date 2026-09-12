"use client";

import { useState, useTransition } from "react";
import { changeMyPassword, type ChangePasswordResult } from "./actions";

export function PasswordForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ChangePasswordResult | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const r = await changeMyPassword({ current, next, confirm });
      setResult(r);
      if (r.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="field-label">Текущий пароль</span>
        <input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="input"
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="field-label">Новый пароль</span>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="input"
          minLength={8}
          required
        />
        <span className="field-hint">Минимум 8 символов.</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="field-label">Повторите новый</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
          minLength={8}
          required
        />
      </label>

      {result && (
        <div
          className={`text-xs px-3 py-2 rounded-lg border ${
            result.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {result.message}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? "Сохраняем…" : "Сменить пароль"}
      </button>
    </form>
  );
}
