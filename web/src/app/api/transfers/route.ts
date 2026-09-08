import { sql } from "@/lib/db";
import { api, requireVerified, HttpError } from "@/lib/session";

/** MVP §4.3 채팅 시작 = transfers 생성. 같은 (item, requester)면 기존 방. */
export const POST = api(async (req) => {
  const u = await requireVerified();
  const { itemId } = await req.json();

  const [item] = await sql`SELECT id, org_id, created_by, status FROM items WHERE id = ${itemId}`;
  if (!item) throw new HttpError(404, "물품을 찾을 수 없어요.");
  if (item.orgId === u.orgId) throw new HttpError(400, "같은 기관의 물품이에요.");
  if (item.status === "completed" || item.status === "withdrawn") throw new HttpError(400, "나눔이 끝났거나 내려간 물품이에요.");

  const [t] = await sql`
    INSERT INTO transfers (item_id, requester_id, requester_org)
    VALUES (${item.id}, ${u.id}, ${u.orgId})
    ON CONFLICT (item_id, requester_id) DO UPDATE SET item_id = EXCLUDED.item_id  -- no-op, RETURNING을 위해
    RETURNING id`;
  return Response.json({ id: t.id });
});
