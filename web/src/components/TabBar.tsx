"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 02 기획서: 스와이프 / 등록하기 / 메시지 / 내 정보
const TABS = [
  { href: "/swipe", label: "스와이프", icon: "⇆" },
  { href: "/new", label: "등록하기", icon: "＋" },
  { href: "/messages", label: "메시지", icon: "💬" },
  { href: "/me", label: "내 정보", icon: "👤" },
];

export function TabBar({ canApprove }: { canApprove: boolean }) {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 mx-auto max-w-md bg-white border-t border-neutral-200 flex">
      {TABS.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href}
            className={`flex-1 flex flex-col items-center py-2 text-[11px] ${active ? "text-brand font-semibold" : "text-neutral-400"}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            <span className="mt-1">{t.label}</span>
          </Link>
        );
      })}
      {canApprove && (
        <Link href="/admin/approvals" className="flex-1 flex flex-col items-center py-2 text-[11px] text-neutral-400">
          <span className="text-lg leading-none">✓</span><span className="mt-1">승인</span>
        </Link>
      )}
    </nav>
  );
}
