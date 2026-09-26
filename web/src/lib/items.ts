import { sql } from "./db";
import type { ItemCard } from "./types";

/** 카드/상세에 필요한 조인. 사진은 sort_order 순 배열로. */
const CARD = sql`
  i.*, o.name AS org_name, c.label AS category_label, c.risk_level,
  COALESCE((SELECT array_agg(p.url ORDER BY p.sort_order) FROM item_photos p WHERE p.item_id = i.id), '{}') AS photos`;

/** MVP §4.2 스와이프 피드 — 안 본 것, 우리 기관 것 제외.
 *  관심 자원(기획 정의서 STEP 3)으로 고른 카테고리를 앞에 놓고, 그 안에서 최신순.
 *  관심을 안 골랐으면 전부 같은 그룹이라 예전처럼 최신순 그대로다. */
export function swipeFeed(userId: string, orgId: string | null, limit = 20) {
  return sql<ItemCard[]>`
    SELECT ${CARD}
    FROM items i JOIN organizations o ON o.id = i.org_id JOIN categories c ON c.code = i.category
    WHERE i.status = 'open'
      AND (${orgId}::uuid IS NULL OR i.org_id <> ${orgId}::uuid)
      AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.user_id = ${userId} AND s.item_id = i.id)
    ORDER BY
      EXISTS (SELECT 1 FROM user_interests ui
              WHERE ui.user_id = ${userId} AND ui.category = i.category) DESC,
      i.created_at DESC
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

/** 내 정보 §05 — 등록 / 신청 / 수령. */
export function myItems(userId: string, kind: "registered" | "requested" | "received") {
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
