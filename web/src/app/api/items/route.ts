import { sql } from "@/lib/db";
import { api, requireUser, requireVerified } from "@/lib/session";
import { swipeFeed, listFeed } from "@/lib/items";
import { parseItemInput } from "@/lib/itemInput";

export const GET = api(async (req) => {
  const u = await requireUser();
  const p = new URL(req.url).searchParams;
  if (p.get("mode") === "list") {
    const rows = await listFeed(u.orgId, p.get("category") || null, Number(p.get("page") ?? 0));
    return Response.json(rows);
  }
  return Response.json(await swipeFeed(u.id, u.orgId));
});

/** MVP §4.1 등록. 검사는 lib/itemInput.ts (수정과 같이 쓴다). */
export const POST = api(async (req) => {
  const u = await requireVerified();
  const v = await parseItemInput(await req.json());

  const id = await sql.begin(async (tx) => {
    const [item] = await tx`
      INSERT INTO items (org_id, created_by, category, name, description,
                         pickup_place, pickup_address, pickup_lat, pickup_lng, quantity, quantity_unit,
                         is_used, condition, on_ledger, approval_confirmed, funding_source)
      VALUES (${u.orgId}, ${u.id}, ${v.category}, ${v.name}, ${v.description},
              ${v.pickupPlace}, ${v.pickupAddress}, ${v.pickupLat}, ${v.pickupLng},
              ${v.quantity}, ${v.quantityUnit}, ${v.isUsed}, ${v.condition}, false, true, NULL)
      RETURNING id`;
    for (let i = 0; i < v.photos.length; i++) {
      await tx`INSERT INTO item_photos (item_id, url, sort_order) VALUES (${item.id}, ${v.photos[i]}, ${i})`;
    }
    return item.id as string;
  });
  return Response.json({ id }, { status: 201 });
});
