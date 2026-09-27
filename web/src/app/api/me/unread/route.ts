import { sql } from "@/lib/db";
import { api, requireUser } from "@/lib/session";

/** 탭바 메시지 배지 — 내가 낀 방(신청자 또는 등록자)에서 상대가 보낸 안 읽은 메시지 수. 메시지 목록의 방별 숫자와 같은 기준. */
export const GET = api(async () => {
  const u = await requireUser();
  const [r] = await sql`
    SELECT count(*)::int AS count
    FROM messages m JOIN transfers t ON t.id = m.transfer_id JOIN items i ON i.id = t.item_id
    WHERE (t.requester_id = ${u.id} OR i.created_by = ${u.id}) AND m.sender_id <> ${u.id} AND m.read_at IS NULL`;
  return Response.json({ count: r.count });
});
