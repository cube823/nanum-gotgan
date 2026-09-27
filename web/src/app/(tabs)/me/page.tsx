import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { myItems } from "@/lib/items";
import { ItemGrid } from "@/components/ItemGrid";
import { WithdrawButton } from "./WithdrawButton";
import { SignOutButton } from "./SignOutButton";

const TABS = { registered: "등록", requested: "신청", received: "수령", bookmarks: "북마크" } as const;
type Tab = keyof typeof TABS;

// 화면 12 — 05 기획서. 프로필 + 등록/신청/수령/북마크. 등록에 내리기. 북마크는 스와이프 하트로 쌓인다.
export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const { tab: raw } = await searchParams;
  const tab: Tab = (raw && raw in TABS ? raw : "registered") as Tab;

  const [[org], items, [counts]] = await Promise.all([
    u.orgId ? sql`SELECT name, org_type FROM organizations WHERE id = ${u.orgId}` : Promise.resolve([null]),
    myItems(u.id, tab),
    sql`SELECT
      (SELECT count(*)::int FROM transfers t JOIN items i ON i.id = t.item_id WHERE i.created_by = ${u.id} AND t.status = 'completed') AS given,
      (SELECT count(*)::int FROM transfers WHERE requester_id = ${u.id} AND status = 'completed') AS received`,
  ]);

  return (
    <main className="flex-1 px-4 pt-6">
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-full bg-neutral-200 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {u.profileImage && <img src={u.profileImage} alt="" className="size-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{u.nickname}</p>
          <p className="text-sm text-neutral-500 truncate">
            {org?.name ?? "소속 없음"}
            {u.orgStatus !== "verified" && <span className="ml-1 chip bg-amber-100 text-amber-800">확인 중</span>}
            {u.orgRole === "manager" && u.orgStatus === "verified" && <span className="ml-1 chip bg-brand/10 text-brand-dark">기관 담당자</span>}
          </p>
          <p className="text-xs text-neutral-400">나눔 {counts.given}회 · 수령 {counts.received}회</p>
        </div>
      </div>

      <div className="mt-6 flex rounded-xl bg-neutral-100 p-1">
        {(Object.keys(TABS) as Tab[]).map((k) => (
          <a key={k} href={`/me?tab=${k}`}
            className={`flex-1 text-center text-sm py-2 rounded-lg ${tab === k ? "bg-white font-semibold shadow-sm" : "text-neutral-500"}`}>
            {TABS[k]}
          </a>
        ))}
      </div>

      <div className="mt-4">
        {tab === "registered" ? (
          <ul className="space-y-3">
            {items.length === 0 && <p className="py-16 text-center text-neutral-400 text-sm">등록한 물품이 없어요.</p>}
            {items.map((it) => (
              <li key={it.id} className="flex gap-3 items-center">
                <a href={`/items/${it.id}`} className="flex gap-3 flex-1 min-w-0">
                  <div className="size-16 rounded-xl bg-neutral-100 overflow-hidden shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.photos[0] && <img src={it.photos[0]} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{it.name}</p>
                    <p className="text-xs text-neutral-500">{it.categoryLabel} · {it.quantity}{it.quantityUnit}</p>
                    <p className="text-xs">{{ open: "나눔 중", reserved: "예약됨", completed: "나눔 완료" }[it.status as string]}</p>
                  </div>
                </a>
                {it.status !== "completed" && <WithdrawButton itemId={it.id} />}
              </li>
            ))}
          </ul>
        ) : (
          <ItemGrid items={items} empty={{ requested: "신청한 물품이 없어요.", received: "받은 물품이 없어요.", bookmarks: "하트를 누른 물품이 여기에 모여요." }[tab]} />
        )}
      </div>

      <div className="mt-10 pb-6"><SignOutButton /></div>
    </main>
  );
}
