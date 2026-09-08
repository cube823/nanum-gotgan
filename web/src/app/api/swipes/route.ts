import { sql } from "@/lib/db";
import { api, requireUser } from "@/lib/session";

// 넘김 기록. 실패해도 클라이언트는 넘긴다 (MVP §4.2).
export const POST = api(async (req) => {
  const u = await requireUser();
  const { itemId } = await req.json();
  if (typeof itemId === "string") {
    await sql`INSERT INTO swipes (user_id, item_id) VALUES (${u.id}, ${itemId}) ON CONFLICT DO NOTHING`;
  }
  return Response.json({ ok: true });
});
