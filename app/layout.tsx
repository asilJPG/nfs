import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stampy — карта лояльности для кофеен",
  description: "Бумажные карточки со штампами, только в Telegram.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#08090B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-[#08090B] text-[#F4F4F2] antialiased selection:bg-[#5B8DEF]/30">{children}</body>
    </html>
  );
}
