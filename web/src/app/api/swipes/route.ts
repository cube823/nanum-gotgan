import { sql } from "@/lib/db";
import { api, requireUser } from "@/lib/session";

// 넘김 기록. 실패해도 클라이언트는 넘긴다 (MVP §4.2).
// 다시 본 물품을 또 넘기면 시각을 갱신한다 — 피드가 "오래전에 본 것부터" 돌기 때문이다 (lib/items.ts swipeFeed).
export const POST = api(async (req) => {
  const u = await requireUser();
  const { itemId } = await req.json();
  if (typeof itemId === "string") {
    await sql`INSERT INTO swipes (user_id, item_id) VALUES (${u.id}, ${itemId}) ON CONFLICT (user_id, item_id) DO UPDATE SET created_at = now()`;
  }
  return Response.json({ ok: true });
});
