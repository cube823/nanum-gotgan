import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { TRANSFER_STATUS, chatTime } from "@/lib/labels";

type Row = {
  id: string; status: string; itemName: string; thumb: string | null;
  otherName: string; otherOrg: string; lastMessage: string | null; lastAt: Date; unread: number;
};

const TABS = [
  { key: "all", label: "전체" },
  { key: "requested", label: "신청한 물품" },
  { key: "mine", label: "등록한 물품" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const EMPTY: Record<Tab, { icon: string; title: string; desc: string; cta: string; href: string }> = {
  all: { icon: "💬", title: "아직 대화가 없어요", desc: "스와이프에서 마음에 드는 물품에\n하트를 눌러 대화를 시작해 보세요!", cta: "물품 둘러보기", href: "/swipe" },
  requested: { icon: "📋", title: "신청한 물품이 없어요", desc: "다른 기관의 물품을 신청하면\n여기서 대화 내역을 확인할 수 있어요.", cta: "물품 둘러보기", href: "/swipe" },
  mine: { icon: "📦", title: "등록한 물품이 없어요", desc: "우리 기관의 남는 물품을 등록하면\n양도 대화가 여기서 이어져요.", cta: "물품 등록하기", href: "/new" },
};

// 기획 정의서 메시지 목록 (61-110·111·112, 빈 상태 342-18·19·20). 행 하나 = 버튼 하나 → 채팅방.
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const q = (await searchParams).tab;
  const tab: Tab = q === "requested" || q === "mine" ? q : "all";
  const scope = tab === "requested" ? sql`t.requester_id = ${u.id}`
    : tab === "mine" ? sql`i.created_by = ${u.id}`
    : sql`(t.requester_id = ${u.id} OR i.created_by = ${u.id})`;

  // 이름은 채팅방과 같게 실명 우선.
  const rows = await sql<Row[]>`
    SELECT t.id, t.status, i.name AS item_name,
      (SELECT url FROM item_photos WHERE item_id = i.id ORDER BY sort_order LIMIT 1) AS thumb,
      CASE WHEN t.requester_id = ${u.id} THEN COALESCE(owner.real_name, owner.nickname) ELSE COALESCE(req.real_name, req.nickname) END AS other_name,
      CASE WHEN t.requester_id = ${u.id} THEN oo.name ELSE ro.name END AS other_org,
      lm.body AS last_message, COALESCE(lm.created_at, t.created_at) AS last_at,
      (SELECT count(*)::int FROM messages WHERE transfer_id = t.id AND read_at IS NULL AND sender_id <> ${u.id}) AS unread
    FROM transfers t
    JOIN items i ON i.id = t.item_id
    JOIN users owner ON owner.id = i.created_by JOIN organizations oo ON oo.id = i.org_id
    JOIN users req ON req.id = t.requester_id JOIN organizations ro ON ro.id = t.requester_org
    LEFT JOIN LATERAL (SELECT body, created_at FROM messages WHERE transfer_id = t.id ORDER BY created_at DESC LIMIT 1) lm ON true
    WHERE ${scope}
    ORDER BY last_at DESC`;

  // 등록한 물품 탭: 아직 대화가 없는 내 게시물도 보인다 (QA 1차 — 올린 직후 여기서 찾는다). 누르면 상세 → 게시물 수정
  const solo = tab === "mine" ? await sql<{ id: string; name: string; thumb: string | null; createdAt: Date }[]>`
    SELECT i.id, i.name, i.created_at,
      (SELECT url FROM item_photos WHERE item_id = i.id ORDER BY sort_order LIMIT 1) AS thumb
    FROM items i
    WHERE i.created_by = ${u.id} AND i.status IN ('open', 'reserved')
      AND NOT EXISTS (SELECT 1 FROM transfers t WHERE t.item_id = i.id)
    ORDER BY i.created_at DESC` : [];

  const empty = EMPTY[tab];

  return (
    <main className="flex flex-1 flex-col px-5 pt-6">
      <h1 className="text-2xl font-extrabold">메시지</h1>

      <nav className="mt-5 flex border-b-2 border-neutral-200" aria-label="대화 구분">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === "all" ? "/messages" : `/messages?tab=${t.key}`} replace
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-0.5 flex-1 border-b-2 py-3 text-center text-sm ${
              tab === t.key ? "border-brand font-bold text-brand" : "border-transparent text-neutral-400"}`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 && solo.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          <span aria-hidden className="grid size-24 place-items-center rounded-full bg-brand/10 text-5xl">{empty.icon}</span>
          <p className="mt-7 text-lg font-bold">{empty.title}</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-400">{empty.desc}</p>
          <Link href={empty.href} className="btn mt-8 h-12 rounded-2xl bg-neutral-900 px-8 text-[15px] font-bold text-white">{empty.cta}</Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100">
            {solo.map((it) => (
              <li key={it.id}>
                <Link href={`/items/${it.id}`} className="flex items-center gap-4 py-5">
                  <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.thumb && <img src={it.thumb} alt="" className="size-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate font-bold">{it.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-neutral-400">{chatTime(it.createdAt)}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-400">아직 대화가 없어요 · 눌러서 보기·수정</span>
                      <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">나눔 중</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {rows.map((r) => {
              const st = TRANSFER_STATUS[r.status];
              return (
                <li key={r.id}>
                  <Link href={`/messages/${r.id}`} className="flex items-center gap-4 py-5">
                    <span className="relative size-14 shrink-0">
                      <span className="block size-full overflow-hidden rounded-xl bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.thumb && <img src={r.thumb} alt="" className="size-full object-cover" />}
                      </span>
                      {r.unread > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white ring-2 ring-white">
                          {r.unread > 99 ? "99+" : r.unread}
                          <span className="sr-only">개 안 읽음</span>
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate font-bold">{r.otherName}</span>
                        <span className="ml-auto shrink-0 text-xs text-neutral-400">{chatTime(r.lastAt)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-neutral-500">{r.otherOrg} · 📦 {r.itemName}</span>
                          <span className="mt-0.5 block truncate text-[13px] text-neutral-500">{r.lastMessage ?? "대화를 시작해 보세요"}</span>
                        </span>
                        {st && <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="py-8 text-center text-[13px] text-neutral-400">채팅 항목을 터치하면 대화를 이어갈 수 있어요</p>
        </>
      )}
    </main>
  );
}
