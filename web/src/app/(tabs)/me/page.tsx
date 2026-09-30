import Link from "next/link";
import { sql } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { district } from "@/lib/labels";
import { Avatar } from "./Avatar";
import { SignOutButton } from "./SignOutButton";

// 선 아이콘 — 탭바와 같은 24px · 1.8 선 굵기. 이모지는 기기마다 모양이 달라 쓰지 않는다.
const QUICK = [
  { href: "/me/bookmarks", label: "북마크",
    icon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /> },
  { href: "/me/requested", label: "신청물품",
    icon: <><rect x="5.5" y="4.5" width="13" height="16" rx="2" /><path d="M9.5 4.5V3.5h5v1M9 10h6M9 13.5h6M9 17h3.5" /></> },
  { href: "/me/received", label: "수령물품",
    icon: <><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></> },
];
// 우리 기관 후기는 뺐다 — 후기 기능이 후순위라 갈 곳이 없다. 설정(비밀번호 변경)도 없다 — OAuth 로그인뿐이라 맨 아래 로그아웃만.
const ORG_MENU = [
  { href: "/me/org-received", label: "기관 수령 물품" },
  { href: "/me/org-registered", label: "기관 등록 물품" },
  { href: "/me/org-given", label: "나눔 완료 물품" },
  { href: "/me/members", label: "기관 구성원 보기" },
];

function Chevron() {
  return <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>;
}

// 기획 정의서 106-291 내 정보. 프로필 카드 → 수정, 북마크·신청·수령, 우리 기관 메뉴, 로그아웃.
export default async function MePage() {
  const u = await pageUser();
  const [org] = u.orgId ? await sql`SELECT name, address FROM organizations WHERE id = ${u.orgId}` : [];
  const where = [org?.name ?? "소속 없음", district(org?.address)].filter(Boolean).join(" · ");

  return (
    <main className="flex-1 space-y-3 bg-white px-4 pb-6 pt-6">
      <h1 className="px-1 pb-3 text-2xl font-extrabold">내 정보</h1>

      <section className="rounded-3xl border border-neutral-200 p-4">
        <div className="flex items-center gap-4">
          <Avatar src={u.profileImage} className="size-14" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{u.realName ?? u.nickname}</p>
            <p className="truncate text-sm text-neutral-500">{where}</p>
          </div>
        </div>
        <Link href="/me/edit" className="mt-4 block rounded-2xl border border-brand/20 bg-brand/10 py-3 text-center text-sm font-bold text-brand">프로필 수정</Link>
      </section>

      <nav aria-label="내 물품" className="grid grid-cols-3 divide-x divide-neutral-200 rounded-3xl border border-neutral-200">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="flex flex-col items-center gap-2 py-5 text-[13px] text-neutral-500">
            <svg aria-hidden viewBox="0 0 24 24" className="size-7 text-brand" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{q.icon}</svg>
            {q.label}
          </Link>
        ))}
      </nav>

      {u.orgId && (
        <section className="rounded-3xl border border-neutral-200 px-5 pt-4">
          <h2 className="text-[13px] font-bold text-neutral-500">우리 기관</h2>
          <ul className="divide-y divide-neutral-200">
            {ORG_MENU.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="flex items-center gap-4 py-4">
                  <span className="flex-1 text-[15px]">{m.label}</span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SignOutButton />
    </main>
  );
}
