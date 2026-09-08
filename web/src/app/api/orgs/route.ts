import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";
import { normalizeOrgName } from "@/lib/org";

const ORG_TYPES = new Set(["위탁", "직영", "모름"]);

/**
 * 소속 정하기. DB-SCHEMA §1.5.
 *  { orgId }              → 기존 기관에 member로 합류 (pending)
 *  { name, orgType }      → 새 기관 생성 + 만든 사람이 manager (pending)
 * 이미 verified면 못 바꾼다 — 소속 변경은 MVP 밖.
 */
export const POST = api(async (req) => {
  const u = await requireUser();
  if (u.orgId && u.orgStatus === "verified") throw new HttpError(400, "이미 소속이 확정됐어요.");

  const body = await req.json();

  if (body.orgId) {
    const [org] = await sql`SELECT id FROM organizations WHERE id = ${body.orgId}`;
    if (!org) throw new HttpError(404, "기관을 찾을 수 없어요.");
    await sql`UPDATE users SET org_id = ${org.id}, org_role = 'member', org_status = 'pending' WHERE id = ${u.id}`;
    return Response.json({ orgId: org.id, role: "member" });
  }

  const name = String(body.name ?? "").trim();
  const orgType = String(body.orgType ?? "모름");
  if (name.length < 2) throw new HttpError(400, "기관명을 두 글자 이상 적어 주세요.");
  if (!ORG_TYPES.has(orgType)) throw new HttpError(400, "운영 형태가 올바르지 않아요.");

  const norm = normalizeOrgName(name);
  const [dup] = await sql`SELECT id, name FROM organizations WHERE name_norm = ${norm}`;
  if (dup) throw new HttpError(409, `"${dup.name}"이(가) 이미 있어요. 목록에서 골라 주세요.`);

  const [org] = await sql`
    INSERT INTO organizations (name, name_norm, org_type, created_by)
    VALUES (${name}, ${norm}, ${orgType}, ${u.id}) RETURNING id`;
  await sql`UPDATE users SET org_id = ${org.id}, org_role = 'manager', org_status = 'pending' WHERE id = ${u.id}`;
  return Response.json({ orgId: org.id, role: "manager" });
});
