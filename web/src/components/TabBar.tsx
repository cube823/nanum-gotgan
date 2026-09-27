"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 기획 정의서 09-swipe-main: 자원보기 / 등록하기 / 메시지 / 프로필. 선 아이콘 24px, 활성 탭만 브랜드색.
const ICONS = {
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  plus: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></>,
  chat: <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1z" />,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

const TABS = [
  { href: "/swipe", label: "자원보기", icon: ICONS.grid },
  { href: "/new", label: "등록하기", icon: ICONS.plus },
  { href: "/messages", label: "메시지", icon: ICONS.chat },
  { href: "/me", label: "프로필", icon: ICONS.user },
];

function Tab({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={`flex-1 flex flex-col items-center gap-1 pt-2.5 pb-3 text-[11px] ${active ? "text-brand font-semibold" : "text-neutral-400"}`}>
      <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      {label}
    </Link>
  );
}

export function TabBar({ canApprove }: { canApprove: boolean }) {
  const path = usePathname();
  const on = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <nav className="fixed bottom-0 inset-x-0 mx-auto max-w-md bg-white border-t border-neutral-200 flex pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => <Tab key={t.href} {...t} active={on(t.href)} />)}
      {canApprove && <Tab href="/admin/approvals" label="승인" icon={ICONS.check} active={on("/admin/approvals")} />}
    </nav>
  );
}
