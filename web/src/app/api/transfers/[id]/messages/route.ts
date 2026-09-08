import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";

async function room(transferId: string, userId: string) {
  const [t] = await sql`
    SELECT t.id, t.status, t.requester_id, i.created_by
    FROM transfers t JOIN items i ON i.id = t.item_id WHERE t.id = ${transferId}`;
  if (!t) throw new HttpError(404, "대화를 찾을 수 없어요.");
  if (t.requesterId !== userId && t.createdBy !== userId) throw new HttpError(403, "이 대화에 참여하고 있지 않아요.");
  return t;
}

/** GET ?after=<iso> 로 폴링. 읽음 처리도 여기서. */
export const GET = api(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  await room(id, u.id);
  const after = new URL(req.url).searchParams.get("after");
  const rows = await sql`
    SELECT id, sender_id, body, created_at FROM messages
    WHERE transfer_id = ${id} ${after ? sql`AND created_at >= ${after}::timestamptz` : sql``}  -- >= : 같은 타임스탬프 유실 방지. 클라이언트가 id로 중복 제거한다.
    ORDER BY created_at`;
  await sql`UPDATE messages SET read_at = now() WHERE transfer_id = ${id} AND sender_id <> ${u.id} AND read_at IS NULL`;
  return Response.json(rows);
});

export const POST = api(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const t = await room(id, u.id);
  // 이력 조회(GET)는 되지만, 종료된 방에 새 메시지는 못 넣는다. UI만 믿지 않는다.
  if (t.status === "cancelled" || t.status === "completed") throw new HttpError(400, "종료된 대화예요.");
  const body = String((await req.json()).body ?? "").trim();
  if (!body) throw new HttpError(400, "내용을 적어 주세요.");
  if (body.length > 2000) throw new HttpError(400, "2000자 이하로 적어 주세요.");
  const [m] = await sql`
    INSERT INTO messages (transfer_id, sender_id, body) VALUES (${id}, ${u.id}, ${body})
    RETURNING id, sender_id, body, created_at`;
  return Response.json(m, { status: 201 });
});
