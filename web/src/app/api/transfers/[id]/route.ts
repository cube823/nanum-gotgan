import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";

/**
 * MVP §4.4 — 등록자만. 상태 전이는 DB-SCHEMA §3 검산표 그대로.
 *  schedule   requested → scheduled  (items → reserved)
 *  unschedule scheduled → requested  (items → open)
 *  complete   scheduled → completed  (items → completed, 나머지 → cancelled)
 * requested → completed 직행은 없다.
 *
 * 읽기·검사·쓰기를 전부 트랜잭션 안에서, items 행을 FOR UPDATE로 잠근 채 한다.
 * 밖에서 읽고 안에서 쓰면 더블클릭·두 탭이 한 물품을 두 명에게 예약한다.
 */
export const PATCH = api(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { action } = await req.json();
  if (!["schedule", "unschedule", "complete"].includes(action)) throw new HttpError(400, "action이 올바르지 않아요.");

  await sql.begin(async (tx) => {
    // items를 먼저 잠근다 — 같은 물품의 다른 transfer 요청도 여기서 직렬화된다.
    const [t] = await tx`
      SELECT t.id, t.status, t.item_id, i.created_by, i.status AS item_status
      FROM transfers t JOIN items i ON i.id = t.item_id
      WHERE t.id = ${id}
      FOR UPDATE OF i, t`;
    if (!t) throw new HttpError(404, "나눔 건을 찾을 수 없어요.");
    if (t.createdBy !== u.id) throw new HttpError(403, "등록한 사람만 할 수 있어요.");

    if (action === "schedule") {
      if (t.status !== "requested") throw new HttpError(400, "신청 상태에서만 예약할 수 있어요.");
      if (t.itemStatus !== "open") throw new HttpError(400, "이미 다른 분과 예약됐거나 끝난 물품이에요.");
      await tx`UPDATE transfers SET status = 'scheduled', scheduled_at = now() WHERE id = ${id}`;
      await tx`UPDATE items SET status = 'reserved', updated_at = now() WHERE id = ${t.itemId}`;
    } else if (action === "unschedule") {
      if (t.status !== "scheduled") throw new HttpError(400, "예약 상태가 아니에요.");
      await tx`UPDATE transfers SET status = 'requested', scheduled_at = NULL WHERE id = ${id}`;
      await tx`UPDATE items SET status = 'open', updated_at = now() WHERE id = ${t.itemId}`;
    } else {
      if (t.status !== "scheduled") throw new HttpError(400, "먼저 '드리기로 함'을 눌러 주세요.");
      if (t.itemStatus !== "reserved") throw new HttpError(400, "물품 상태가 바뀌었어요. 새로고침해 주세요.");
      await tx`UPDATE transfers SET status = 'completed', completed_at = now() WHERE id = ${id}`;
      await tx`UPDATE items SET status = 'completed', updated_at = now() WHERE id = ${t.itemId}`;
      await tx`UPDATE transfers SET status = 'cancelled' WHERE item_id = ${t.itemId} AND id <> ${id} AND status IN ('requested', 'scheduled')`;
    }
  });
  return Response.json({ ok: true });
});
