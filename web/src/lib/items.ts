import { sql } from "./db";
import type { ItemCard } from "./types";

/** 카드/상세에 필요한 조인. 사진은 sort_order 순 배열로. */
const CARD = sql`
  i.*, o.name AS org_name, c.label AS category_label, c.risk_level,
  COALESCE((SELECT array_agg(p.url ORDER BY p.sort_order) FROM item_photos p WHERE p.item_id = i.id), '{}') AS photos`;

/** 물품 기관(o) ↔ 보는 사람 기관(me) 직선거리 km, 소수 1자리. 둘 중 좌표가 없으면 NULL — 화면은 거리를 숨긴다.
 *  도로 거리가 아니다 (경로 API는 유료). 좌표는 db/orgs.sql, web/scripts/geocode-orgs.mjs. */
export const DISTANCE_KM = sql`
  round((6371 * 2 * asin(sqrt(
    power(sin(radians(me.lat - o.lat) / 2), 2)
    + cos(radians(o.lat)) * cos(radians(me.lat)) * power(sin(radians(me.lng - o.lng) / 2), 2)
  )))::numeric, 1)::float`;

/** MVP §4.2 스와이프 피드 — 안 본 것, 우리 기관 것 제외.
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
      o.address AS org_address,
      ${DISTANCE_KM} AS distance_km
    FROM items i JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category
    LEFT JOIN organizations me ON me.id = ${orgId}::uuid
    WHERE i.status = 'open'
      AND (${orgId}::uuid IS NULL OR i.org_id <> ${orgId}::uuid)
      AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.user_id = ${userId} AND s.item_id = i.id)
    ORDER BY
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

/** 내 정보 §05 — 등록 / 신청 / 수령 / 북마크. */
export function myItems(userId: string, kind: "registered" | "requested" | "received" | "bookmarks") {
  if (kind === "bookmarks")   // 내린 물품은 뺀다 — 눌러도 404라서
    return sql<ItemCard[]>`
      SELECT ${CARD} FROM bookmarks b JOIN items i ON i.id = b.item_id
      JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category
      WHERE b.user_id = ${userId} AND i.status <> 'withdrawn' ORDER BY b.created_at DESC`;
  if (kind === "registered")
    return sql<ItemCard[]>`
      SELECT ${CARD} FROM items i JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category
      WHERE i.created_by = ${userId} AND i.status <> 'withdrawn' ORDER BY i.created_at DESC`;
  const status = kind === "received" ? sql`AND t.status = 'completed'` : sql`AND t.status <> 'cancelled'`;
  return sql<ItemCard[]>`
    SELECT ${CARD} FROM transfers t JOIN items i ON i.id = t.item_id
    JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category
    WHERE t.requester_id = ${userId} ${status} ORDER BY t.created_at DESC`;
}
