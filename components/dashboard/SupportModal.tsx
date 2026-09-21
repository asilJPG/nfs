"use client";

import { useState, useTransition } from "react";
import { sendCafeSupportTicket } from "@/app/dashboard/support/actions";
import { IconCheck, IconX } from "@/components/ui/icons";

export function SupportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState("Вопрос по NFC-меткам / стенду");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Пожалуйста, опишите ваш вопрос.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await sendCafeSupportTicket({
          topic,
          message: message.trim(),
          contact: contact.trim(),
        });
        if (res.ok) {
          setSent(true);
        } else {
          setError(res.message);
        }
      } catch {
        setError("Ошибка отправки. Пожалуйста, попробуйте позже.");
      }
    });
  };

  const handleReset = () => {
    setSent(false);
    setMessage("");
    setContact("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#12141A] p-6 shadow-2xl">
        <button
          onClick={handleReset}
          className="absolute top-4 right-4 text-ink-label hover:text-white transition-colors"
        >
          <IconX className="size-5" />
        </button>

        {sent ? (
          <div className="text-center py-6">
            <div className="mx-auto size-12 rounded-full bg-[#5B8DEF]/15 flex items-center justify-center text-[#7BA5FF] mb-4">
              <IconCheck className="size-6" />
            </div>
            <h3 className="text-lg font-semibold text-white">Обращение отправлено</h3>
            <p className="mt-2 text-sm text-ink-body">
              Мы получили ваш вопрос и свяжемся с вами в Telegram в самое ближайшее время.
            </p>
            <button
              onClick={handleReset}
              className="mt-6 rounded-xl bg-[#5B8DEF] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#4A7CE0] transition-colors"
            >
              Понятно
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Служба поддержки Stampy</h3>
              <p className="text-xs text-ink-label mt-1">
                Напишите ваш вопрос, и дежурный специалист ответит вам.
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-body mb-1.5">Тема обращения</label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5B8DEF]"
              >
                <option value="Вопрос по NFC-меткам / стенду">Вопрос по NFC-меткам / стенду</option>
                <option value="Вопрос по тарифу и оплате">Вопрос по тарифу и оплате</option>
                <option value="Настройка программы лояльности">Настройка программы лояльности</option>
                <option value="Технический сбой или ошибка">Технический сбой или ошибка</option>
                <option value="Другой вопрос">Другой вопрос</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-body mb-1.5">
                Ваш Telegram или номер для связи
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="@username или +998 90 123 45 67"
                className="w-full rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2 text-xs text-white placeholder:text-ink-label focus:outline-none focus:border-[#5B8DEF]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-body mb-1.5">
                Текст вопроса / обращения <span className="text-[#5B8DEF]">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
                placeholder="Опишите, что случилось или какой вопрос у вас возник..."
                className="w-full rounded-xl bg-white/[0.05] border border-white/10 p-3 text-xs text-white placeholder:text-ink-label focus:outline-none focus:border-[#5B8DEF] resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-xl px-4 py-2 text-xs text-ink-body hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-[#5B8DEF] px-5 py-2 text-xs font-semibold text-white hover:bg-[#4A7CE0] disabled:opacity-50 transition-all"
              >
                {isPending ? "Отправка..." : "Отправить в поддержку"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
