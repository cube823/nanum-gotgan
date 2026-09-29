import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";
import { getItem } from "@/lib/items";
import { parseItemInput } from "@/lib/itemInput";

export const GET = api(async (_req, { params }) => {
  await requireUser();
  const item = await getItem((await params).id);
  if (!item) throw new HttpError(404, "물품을 찾을 수 없어요.");
  return Response.json(item);
});

/** MVP §4.5 내리기(action=withdraw) · 게시물 수정(action=update, QA 1차). 등록자만. 잠그고 한다 — complete와 경합할 수 있다. */
export const PATCH = api(async (req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  const b = await req.json();
  if (b.action !== "withdraw" && b.action !== "update") throw new HttpError(400, "action이 올바르지 않아요.");
  const v = b.action === "update" ? await parseItemInput(b) : null;   // 검사는 잠그기 전에 (DB를 덜 붙잡는다)

  await sql.begin(async (tx) => {
    const [item] = await tx`SELECT id, created_by, status FROM items WHERE id = ${id} FOR UPDATE`;
    if (!item) throw new HttpError(404, "물품을 찾을 수 없어요.");
    if (item.createdBy !== u.id) throw new HttpError(403, v ? "등록한 사람만 고칠 수 있어요." : "등록한 사람만 내릴 수 있어요.");
    if (item.status === "completed") throw new HttpError(400, "이미 나눔이 끝난 물품이에요.");
    if (!v) {
      if (item.status === "withdrawn") return;
      await tx`UPDATE items SET status = 'withdrawn', updated_at = now() WHERE id = ${id}`;
      await tx`UPDATE transfers SET status = 'cancelled' WHERE item_id = ${id} AND status IN ('requested', 'scheduled')`;
      return;
    }
    if (item.status === "withdrawn") throw new HttpError(400, "내린 물품은 고칠 수 없어요.");
    // 상태(open/reserved)·대화는 그대로 두고 내용만 바꾼다. 사진은 순서까지 통째로 바꾼다
    await tx`
      UPDATE items SET category = ${v.category}, name = ${v.name}, description = ${v.description},
        quantity = ${v.quantity}, quantity_unit = ${v.quantityUnit}, is_used = ${v.isUsed}, condition = ${v.condition},
        pickup_place = ${v.pickupPlace}, pickup_address = ${v.pickupAddress}, pickup_lat = ${v.pickupLat}, pickup_lng = ${v.pickupLng},
        approval_confirmed = true, updated_at = now()
      WHERE id = ${id}`;
    await tx`DELETE FROM item_photos WHERE item_id = ${id}`;
    for (let i = 0; i < v.photos.length; i++) {
      await tx`INSERT INTO item_photos (item_id, url, sort_order) VALUES (${id}, ${v.photos[i]}, ${i})`;
    }
  });
  return Response.json({ ok: true });
});
