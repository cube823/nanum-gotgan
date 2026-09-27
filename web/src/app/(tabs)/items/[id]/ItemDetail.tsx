import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getItem, DISTANCE_KM } from "@/lib/items";
import { STATUS_LABEL } from "@/components/ItemGrid";
import { CONDITION_LABEL, ago } from "@/lib/labels";
import { ChatButton } from "./ChatButton";

const RISK_NOTE: Record<string, string> = {
  yellow: "반복 사용하는 물품이면 비품으로 관리될 수 있어요.",
  red: "전기·소형비품이에요. 등록 기관의 내부 승인을 거친 물품이에요.",
};

/** 기획 정의서 11 — 물품 상세. 스와이프 ↑로 온다.
 *  Figma의 "크기" 행은 뺐다 — 크기 필드가 없다. 지도 그림은 아직 없다(설계 P3) —
 *  거리("약 n km", 직선)와 두 기관 주소만 보여준다. 좌표 없는 기관이면 거리는 숨긴다. */
export async function ItemDetail({ id, sheet = false }: { id: string; sheet?: boolean }) {
  const u = await requireUser();
  const item = await getItem(id);
  if (!item || item.status === "withdrawn") notFound();

  const [meta] = await sql`
    SELECT COALESCE(owner.real_name, owner.nickname) AS owner_name, o.address AS org_address,
      me.name AS my_org_name, me.address AS my_org_address, ${DISTANCE_KM} AS distance_km,
      (SELECT count(*)::int FROM bookmarks b WHERE b.item_id = ${item.id}) AS bookmark_count,
      (SELECT count(*)::int FROM transfers t WHERE t.item_id = ${item.id} AND t.status <> 'cancelled') AS chat_count
    FROM users owner
    JOIN organizations o ON o.id = ${item.orgId}
    LEFT JOIN organizations me ON me.id = ${u.orgId}
    WHERE owner.id = ${item.createdBy}`;

  const mine = item.createdBy === u.id;
  const sameOrg = item.orgId === u.orgId;

  return (
    <article className={sheet ? "min-h-full flex flex-col" : ""}>
      {/* 시트(기획 정의서 11)엔 사진이 없다 — 시트 위로 살짝 보이는 뒤의 스와이프 카드가 사진이다.
          직접 들어온 전체 화면에서만 사진을 위에 깐다. */}
      {!sheet && (
        <div className="relative">
          <div className="flex overflow-x-auto snap-x snap-mandatory">
            {item.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={p} alt="" className="w-full aspect-square object-cover snap-center shrink-0" />
            ))}
          </div>
          <Link href="/swipe" aria-label="뒤로" className="absolute top-3 left-3 size-9 rounded-full bg-black/40 text-white grid place-items-center">←</Link>
        </div>
      )}

      <div className={`px-[22px] ${sheet ? "pt-7 flex-1 flex flex-col" : "pt-6"}`}>
        <div className="flex items-center justify-between">
          <span className="flex gap-1.5">
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{item.categoryLabel}</span>
            {STATUS_LABEL[item.status] && <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">{STATUS_LABEL[item.status]}</span>}
          </span>
          <span className="flex items-center gap-3 text-sm text-neutral-400">
            <span className="flex items-center gap-1" aria-label={`북마크 ${meta.bookmarkCount}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" /></svg>
              {meta.bookmarkCount}
            </span>
            <span className="flex items-center gap-1" aria-label={`채팅 ${meta.chatCount}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round"><path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1z" /></svg>
              {meta.chatCount}
            </span>
          </span>
        </div>

        <h1 className="mt-4 text-[22px] font-extrabold leading-tight tracking-tight">{item.name}</h1>
        <p className="mt-1.5 text-sm text-neutral-400">{item.orgName} · {ago(item.createdAt)} 등록</p>

        {/* 등록자 카드 → 상대 프로필 */}
        <Link href={`/users/${item.createdBy}`}
          className="mt-5 flex items-center gap-3 rounded-2xl bg-neutral-100/70 px-4 py-3 hover:bg-neutral-100">
          <span className="size-11 shrink-0 rounded-full bg-brand/10 grid place-items-center text-brand">
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{item.orgName}</span>
            <span className="block truncate text-sm text-neutral-400">{meta.ownerName}</span>
          </span>
          <span aria-hidden className="text-xl text-neutral-500">›</span>
        </Link>

        <hr className="my-5 border-neutral-200" />

        {item.description && <p className="whitespace-pre-wrap text-[15px] leading-7 text-neutral-900">{item.description}</p>}

        <dl className="mt-6 space-y-4 rounded-2xl bg-neutral-100/70 px-5 py-5 text-sm">
          {[
            ["수량", `${item.quantity}${item.quantityUnit}`],
            ["사용 여부", item.isUsed ? "예" : "아니오"],
            ["상태", CONDITION_LABEL[item.condition]],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-neutral-400">{k}</dt>
              <dd className="font-bold text-right">{v}</dd>
            </div>
          ))}
        </dl>

        {RISK_NOTE[item.riskLevel] && <p className="mt-4 text-xs text-neutral-500 rounded-xl bg-amber-50 p-3">{RISK_NOTE[item.riskLevel]}</p>}

        <h2 className="mt-8 flex items-baseline justify-between font-bold">
          위치
          {meta.distanceKm != null && !sameOrg && <span className="text-sm font-semibold text-brand">약 {meta.distanceKm}km</span>}
        </h2>
        <ul className="mt-3 mb-4 space-y-2 text-sm">
          <li className="flex gap-2">
            <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
            <span className="shrink-0 text-neutral-400">물품 위치</span>
            <span className="font-semibold">{item.orgName}{meta.orgAddress && ` · ${meta.orgAddress}`}</span>
          </li>
          {meta.myOrgName && !sameOrg && (
            <li className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
              <span className="shrink-0 text-neutral-400">우리 기관</span>
              <span className="font-semibold">{meta.myOrgName}{meta.myOrgAddress && ` · ${meta.myOrgAddress}`}</span>
            </li>
          )}
        </ul>

        {/* 기획 정의서 11: 채팅하기는 하단 고정. 시트면 시트 바닥, 전체 화면이면 탭바(h-16) 바로 위.
            위쪽 흰 그라데이션으로 스크롤되는 본문이 버튼 밑으로 자연스럽게 사라지게 한다. */}
        <div className={`sticky z-10 -mx-[22px] mt-auto px-[22px] pt-5 pb-[calc(16px+env(safe-area-inset-bottom))]
          bg-gradient-to-t from-white from-75% to-transparent ${sheet ? "bottom-0" : "bottom-16"}`}>
          {mine ? (
            <Link href="/me" className="btn-ghost w-full">내가 등록한 물품이에요</Link>
          ) : sameOrg ? (
            <button disabled className="btn-ghost w-full">같은 기관의 물품이에요</button>
          ) : item.status === "completed" ? (
            <button disabled className="btn-ghost w-full">나눔이 끝난 물품이에요</button>
          ) : (
            <ChatButton itemId={item.id} verified={u.orgStatus === "verified"} reserved={item.status === "reserved"} />
          )}
        </div>
      </div>
    </article>
  );
}
