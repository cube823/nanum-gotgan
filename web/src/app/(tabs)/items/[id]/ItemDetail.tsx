import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getItem, DISTANCE_KM } from "@/lib/items";
import { STATUS_LABEL } from "@/components/ItemGrid";
import { CONDITION_LABEL, ago } from "@/lib/labels";
import { ChatButton } from "./ChatButton";
import { KakaoMap } from "@/components/KakaoMap";
import { SheetCloseButton } from "@/components/Sheet";

const RISK_NOTE: Record<string, string> = {
  yellow: "반복 사용하는 물품이면 비품으로 관리될 수 있어요.",
  red: "전기·소형비품이에요. 등록 기관의 내부 승인을 거친 물품이에요.",
};

/** 기획 정의서 11 — 물품 상세. 스와이프 ↑로 온다.
 *  Figma의 "크기" 행은 뺐다 — 크기 필드가 없다. 위치는 카카오맵(components/KakaoMap) + 두 기관 주소.
 *  좌표 없는 기관(직접 등록한 기관 — 주소를 아직 안 받는다)이면 지도·거리 없이 주소 줄만. */
export async function ItemDetail({ id, sheet = false }: { id: string; sheet?: boolean }) {
  const u = await requireUser();
  const item = await getItem(id);
  if (!item || item.status === "withdrawn") notFound();

  const [meta] = await sql`
    SELECT COALESCE(owner.real_name, owner.nickname) AS owner_name, o.address AS org_address,
      me.name AS my_org_name, me.address AS my_org_address, ${DISTANCE_KM} AS distance_km,
      o.lat::float AS lat, o.lng::float AS lng, me.lat::float AS my_lat, me.lng::float AS my_lng,
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
      {/* 기획 정의서 11 — 맨 위 사진(390:300). 시트면 오른쪽 위 ↓로 내리고, 직접 들어온 전체 화면이면 ← 뒤로. */}
      <div className="relative">
        <div className="flex overflow-x-auto snap-x snap-mandatory">
          {/* 사진이 없으면 자리만 둔다 — 없애면 ↓·← 버튼이 본문 위에 겹친다 */}
          {item.photos.length === 0 && <PhotoPlaceholder />}
          {item.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={p} alt="" className="w-full aspect-[13/10] object-cover snap-center shrink-0" />
          ))}
        </div>
        {sheet
          ? <span className="absolute top-4 right-4 z-20"><SheetCloseButton /></span>
          : <Link href="/swipe" aria-label="뒤로" className="absolute top-3 left-3 size-9 rounded-full bg-black/40 text-white grid place-items-center">←</Link>}
      </div>

      <div className={`px-[22px] pt-6 ${sheet ? "flex-1 flex flex-col" : ""}`}>
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
        {item.history && (
          <p className="mt-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-600">
            <span className="mr-2 font-bold text-neutral-800">물품 히스토리</span>{item.history}
          </p>
        )}

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

        <h2 className="mt-8 font-bold">위치</h2>
        {/* 좌표가 있으면 지도(거리는 지도 위 알약). 없으면 조용히 비우지 말고 왜 없는지 말한다 —
            비워 두면 "지도가 사라졌다"와 구분이 안 된다. 주소 필수(0009) 전에 만든 기관,
            또는 가입 때 카카오가 응답하지 않아 주소만 있고 좌표가 없는 기관 — 그래서 "주소 없음"이라 쓰지 않는다 */}
        {meta.lat != null ? (
          <KakaoMap item={{ lat: meta.lat, lng: meta.lng }} itemName={item.orgName}
            mine={meta.myLat != null && !sameOrg ? { lat: meta.myLat, lng: meta.myLng } : null}
            distanceKm={sameOrg ? null : meta.distanceKm} />
        ) : (
          <p className="mt-3 grid h-[132px] place-items-center rounded-2xl bg-neutral-100/70 px-6 text-center text-sm text-neutral-400">
            이 기관은 위치 정보가 없어<br />지도를 보여줄 수 없어요
          </p>
        )}
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

function PhotoPlaceholder() {
  return (
    <div className="w-full aspect-[13/10] shrink-0 bg-neutral-100 grid place-items-center text-neutral-400">
      <span className="flex flex-col items-center gap-2 text-sm">
        <svg aria-hidden viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.5" /><circle cx="9" cy="9.5" r="1.6" /><path d="m5 17 4.5-4.5 3 3 2.5-2.5L19 17" /></svg>
        사진이 아직 없어요
      </span>
    </div>
  );
}
