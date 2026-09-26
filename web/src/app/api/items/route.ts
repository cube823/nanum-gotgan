import { sql } from "@/lib/db";
import { api, requireUser, requireVerified, HttpError } from "@/lib/session";
import { swipeFeed, listFeed } from "@/lib/items";
import { CONDITIONS } from "@/lib/labels";

export const GET = api(async (req) => {
  const u = await requireUser();
  const p = new URL(req.url).searchParams;
  if (p.get("mode") === "list") {
    const rows = await listFeed(u.orgId, p.get("category") || null, Number(p.get("page") ?? 0));
    return Response.json(rows);
  }
  return Response.json(await swipeFeed(u.id, u.orgId));
});

const CONDITION_SET = new Set<string>(CONDITIONS);
const FUNDING = new Set(["자체예산", "보조금", "기타", "모름"]);

/** MVP §4.1 등록. 🔴는 DB 제약이 한 번 더 막는다. */
export const POST = api(async (req) => {
  const u = await requireVerified();
  const b = await req.json();

  const name = String(b.name ?? "").trim();
  const quantity = Number(b.quantity);
  const photos: string[] = Array.isArray(b.photos) ? b.photos.filter((x: unknown) => typeof x === "string") : [];

  if (!name) throw new HttpError(400, "물품 이름을 적어 주세요.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, "수량은 1 이상이어야 해요.");
  if (!CONDITION_SET.has(b.condition)) throw new HttpError(400, "상태를 골라 주세요.");
  if (photos.length < 1 || photos.length > 10) throw new HttpError(400, "사진은 1~10장이어야 해요.");
  if (b.fundingSource && !FUNDING.has(b.fundingSource)) throw new HttpError(400, "취득 재원이 올바르지 않아요.");

  const [cat] = await sql`SELECT code, risk_level FROM categories WHERE code = ${String(b.category)}`;
  if (!cat) throw new HttpError(400, "카테고리를 골라 주세요.");
  if (cat.riskLevel === "red" && !b.approvalConfirmed) {
    throw new HttpError(400, "전기·소형비품은 내부 처분 승인을 확인한 뒤 등록할 수 있어요.");
  }

  const id = await sql.begin(async (tx) => {
    const [item] = await tx`
      INSERT INTO items (org_id, created_by, category, name, description, quantity, quantity_unit,
                         is_used, condition, on_ledger, approval_confirmed, funding_source)
      VALUES (${u.orgId}, ${u.id}, ${cat.code}, ${name}, ${String(b.description ?? "").trim() || null},
              ${quantity}, ${String(b.quantityUnit ?? "개").trim() || "개"},
              ${!!b.isUsed}, ${b.condition}, ${!!b.onLedger}, ${!!b.approvalConfirmed}, ${b.fundingSource ?? null})
      RETURNING id`;
    for (let i = 0; i < photos.length; i++) {
      await tx`INSERT INTO item_photos (item_id, url, sort_order) VALUES (${item.id}, ${photos[i]}, ${i})`;
    }
    return item.id as string;
  });
  return Response.json({ id }, { status: 201 });
});
