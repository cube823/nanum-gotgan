import { sql } from "./db";
import type { ItemCard } from "./types";

/** 카드/상세에 필요한 조인. 사진은 sort_order 순 배열로. */
const CARD = sql`
  i.*, o.name AS org_name, c.label AS category_label, c.risk_level,
  COALESCE((SELECT array_agg(p.url ORDER BY p.sort_order) FROM item_photos p WHERE p.item_id = i.id), '{}') AS photos`;

/** 물품 위치 ↔ 보는 사람 기관(me) 직선거리 km, 소수 1자리. 물품 위치 = 거래 희망 장소(i.pickup_*)가 있으면 그것, 없으면 등록 기관(o).
 *  둘 중 좌표가 없으면 NULL — 화면은 거리를 숨긴다. 쓰는 쿼리는 items i, organizations o, organizations me 별칭이 있어야 한다.
 *  도로 거리가 아니다 (경로 API는 유료). 좌표는 db/orgs.sql, web/scripts/geocode-orgs.mjs. */
export const DISTANCE_KM = sql`
  round((6371 * 2 * asin(sqrt(
    power(sin(radians(me.lat - COALESCE(i.pickup_lat, o.lat)) / 2), 2)
    + cos(radians(COALESCE(i.pickup_lat, o.lat))) * cos(radians(me.lat))
      * power(sin(radians(me.lng - COALESCE(i.pickup_lng, o.lng)) / 2), 2)
  )))::numeric, 1)::float`;

/** MVP §4.2 스와이프 피드 — 우리 기관 것 제외. **안 본 것 먼저, 그다음 본 것(오래전에 본 것부터)** — seen으로 구분.
 *  본 것을 아예 빼면 물품 수십 개 서비스에선 며칠 만에 피드가 빈다 (2026-09-27 결정, decisions/0004 보강).
 *  관심 자원(기획 정의서 STEP 3)은 **가산점**이지 별도 그룹이 아니다.
 *  그룹으로 나누면 관심 카테고리 물품이 LIMIT을 다 채워 나머지가 영영 안 보인다 —
 *  물품이 안 보이는 건 자원순환 서비스에서 치명적이다. 그래서 등록 시각을 이틀
 *  앞당긴 것처럼 취급해 섞는다. 관심을 안 골랐으면 예전처럼 최신순 그대로다. */
export function swipeFeed(userId: string, orgId: string | null, limit = 20) {
  return sql<ItemCard[]>`
    SELECT ${CARD},
      EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = ${userId} AND b.item_id = i.id) AS bookmarked,
      (SELECT count(*)::int FROM bookmarks b WHERE b.item_id = i.id) AS bookmark_count,
      (SELECT count(*)::int FROM transfers t WHERE t.item_id = i.id AND t.status <> 'cancelled') AS chat_count,
      COALESCE(i.pickup_address, o.address) AS org_address,   -- 카드의 "구"는 물품 위치 기준
      ${DISTANCE_KM} AS distance_km,
      s.item_id IS NOT NULL AS seen
    FROM items i JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category
    LEFT JOIN organizations me ON me.id = ${orgId}::uuid
    LEFT JOIN swipes s ON s.user_id = ${userId} AND s.item_id = i.id
    WHERE i.status = 'open'
      AND (${orgId}::uuid IS NULL OR i.org_id <> ${orgId}::uuid)
    ORDER BY
      s.item_id IS NOT NULL,          -- 안 본 것(false) 먼저
      s.created_at ASC NULLS FIRST,   -- 본 것끼리는 오래전에 본 것부터 (넘길 때 시각이 갱신돼 돌아간다)
      i.created_at + (CASE WHEN EXISTS (SELECT 1 FROM user_interests ui
                                        WHERE ui.user_id = ${userId} AND ui.category = i.category)
                           THEN interval '2 days' ELSE interval '0' END) DESC
    LIMIT ${limit}`;
}

/** MVP §4.2b 목록 — 재방문용. swipes 안 봄. reserved도 보임. */
export function listFeed(orgId: string | null, category: string | null, page = 0, size = 30) {
  return sql<ItemCard[]>`
    SELECT ${CARD}
    FROM items i JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category
    WHERE i.status IN ('open', 'reserved')
      AND (${orgId}::uuid IS NULL OR i.org_id <> ${orgId}::uuid)
      AND (${category}::text IS NULL OR i.category = ${category})
    ORDER BY i.created_at DESC
    LIMIT ${size} OFFSET ${page * size}`;
}

export async function getItem(id: string): Promise<ItemCard | null> {
  const [row] = await sql<ItemCard[]>`
    SELECT ${CARD}
    FROM items i JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category
    WHERE i.id = ${id} AND i.status <> 'withdrawn'`;   // 내린 물품은 API로도 안 보인다
  return row ?? null;
}

/** 내 정보 목록 화면 (기획 정의서 106-294·295·296 + 우리 기관 메뉴). 경로 /me/<kind>. */
export const PROFILE_LISTS = {
  bookmarks: "북마크한 물품",
  requested: "신청한 물품",
  received: "수령한 물품",
  "org-received": "기관 수령 물품",
  "org-registered": "기관 등록 물품",
  "org-given": "나눔 완료 물품",
} as const;
export type ProfileList = keyof typeof PROFILE_LISTS;
/** transferStatus: 내(또는 우리 기관)가 이 물품에 건 나눔 건 상태. 없으면 null — 알약은 물품 상태로. */
export type ProfileRow = ItemCard & { transferStatus: string | null };

/** 내 신청·수령은 사람 기준, 우리 기관 메뉴는 org_id 기준. 내린 물품·취소된 신청은 뺀다. */
export function profileList(kind: ProfileList, userId: string, orgId: string | null) {
  const cols = sql`${CARD},
    EXISTS (SELECT 1 FROM bookmarks b WHERE b.user_id = ${userId} AND b.item_id = i.id) AS bookmarked,
    (SELECT count(*)::int FROM bookmarks b WHERE b.item_id = i.id) AS bookmark_count`;
  const joins = sql`JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category`;
  switch (kind) {
    case "bookmarks":
      return sql<ProfileRow[]>`
        SELECT ${cols}, (SELECT t.status FROM transfers t WHERE t.item_id = i.id AND t.requester_id = ${userId} AND t.status <> 'cancelled') AS transfer_status
        FROM bookmarks bm JOIN items i ON i.id = bm.item_id ${joins}
        WHERE bm.user_id = ${userId} AND i.status <> 'withdrawn' ORDER BY bm.created_at DESC`;
    case "requested":
    case "received":
      return sql<ProfileRow[]>`
        SELECT ${cols}, t.status AS transfer_status
        FROM transfers t JOIN items i ON i.id = t.item_id ${joins}
        WHERE t.requester_id = ${userId} ${kind === "received" ? sql`AND t.status = 'completed'` : sql`AND t.status <> 'cancelled'`}
        ORDER BY t.created_at DESC`;
    case "org-received":
      return sql<ProfileRow[]>`
        SELECT ${cols}, t.status AS transfer_status
        FROM transfers t JOIN items i ON i.id = t.item_id ${joins}
        WHERE t.requester_org = ${orgId} AND t.status = 'completed' ORDER BY t.completed_at DESC`;
    case "org-registered":
    case "org-given":
      return sql<ProfileRow[]>`
        SELECT ${cols}, NULL AS transfer_status
        FROM items i ${joins}
        WHERE i.org_id = ${orgId} ${kind === "org-given" ? sql`AND i.status = 'completed'` : sql`AND i.status <> 'withdrawn'`}
        ORDER BY i.created_at DESC`;
  }
}
