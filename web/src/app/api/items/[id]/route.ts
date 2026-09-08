import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";
import { getItem } from "@/lib/items";

export const GET = api(async (_req, { params }) => {
  await requireUser();
  const item = await getItem((await params).id);
  if (!item) throw new HttpError(404, "물품을 찾을 수 없어요.");
  return Response.json(item);
});

/** MVP §4.5 내리기. 등록자만. completed는 못 내린다. 잠그고 한다 — complete와 경합할 수 있다. */
export const PATCH = api(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const { action } = await req.json();
  if (action !== "withdraw") throw new HttpError(400, "action이 올바르지 않아요.");

  await sql.begin(async (tx) => {
    const [item] = await tx`SELECT id, created_by, status FROM items WHERE id = ${id} FOR UPDATE`;
    if (!item) throw new HttpError(404, "물품을 찾을 수 없어요.");
    if (item.createdBy !== u.id) throw new HttpError(403, "등록한 사람만 내릴 수 있어요.");
    if (item.status === "completed") throw new HttpError(400, "이미 나눔이 끝난 물품이에요.");
    if (item.status === "withdrawn") return;
    await tx`UPDATE items SET status = 'withdrawn', updated_at = now() WHERE id = ${id}`;
    await tx`UPDATE transfers SET status = 'cancelled' WHERE item_id = ${id} AND status IN ('requested', 'scheduled')`;
  });
  return Response.json({ ok: true });
});
