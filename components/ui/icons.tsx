// Иконки навигации. Эмодзи в меню выглядели как заглушка и по-разному рисуются
// на Windows/Android — здесь один штриховой набор в одном весе.

type IconProps = { className?: string };

const base = "size-[18px] shrink-0";

function Svg({ className = "", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`${base} ${className}`}
    >
      {children}
    </svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 15l3.5-4 3 2.5L20 7" />
    </Svg>
  );
}

export function IconCard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 10h19" />
      <path d="M6.5 15h3" />
    </Svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function IconTag(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12.7V5.5a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4Z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </Svg>
  );
}

export function IconMegaphone(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 9v6a1 1 0 0 0 1 1h3l7 4V4L8 8H5a1 1 0 0 0-1 1Z" />
      <path d="M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    </Svg>
  );
}

export function IconCrown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 7.5 6.8 12 12 5l5.2 7L21 7.5 19.2 18H4.8L3 7.5Z" />
    </Svg>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 2 4.5 13.5H11L10.5 22 19.5 10.5H13L13 2Z" />
    </Svg>
  );
}

export function IconScan(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M20 8V6a2 2 0 0 0-2-2h-2" />
      <path d="M4 16v2a2 2 0 0 0 2 2h2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M4 12h16" />
    </Svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4" />
      <path d="M6 12h9" />
    </Svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </Svg>
  );
}
