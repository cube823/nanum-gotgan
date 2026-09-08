import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";

// DB-SCHEMA §1.5 — 운영자는 전부, manager는 우리 기관만.
function scope(u: { isAdmin: boolean; orgRole: string; orgId: string | null; orgStatus: string }) {
  if (u.isAdmin) return null;                                   // 전체
  if (u.orgRole === "manager" && u.orgStatus === "verified" && u.orgId) return u.orgId;
  throw new HttpError(403, "승인 권한이 없어요.");
}

export const GET = api(async () => {
  const u = await requireUser();
  const orgId = scope(u);
  const rows = await sql`
    SELECT u.id, u.nickname, u.email, u.org_role, u.created_at,
           o.id AS org_id, o.name AS org_name, o.org_type, o.verified AS org_verified
    FROM users u LEFT JOIN organizations o ON o.id = u.org_id
    WHERE u.org_status = 'pending' AND u.org_id IS NOT NULL
      ${orgId ? sql`AND u.org_id = ${orgId}` : sql``}
    ORDER BY u.created_at`;
  return Response.json(rows);
});

export const PATCH = api(async (req) => {
  const u = await requireUser();
  const orgId = scope(u);
  const { userId, action } = await req.json();
  if (!["approve", "reject"].includes(action)) throw new HttpError(400, "action이 올바르지 않아요.");

  await sql.begin(async (tx) => {
    const [target] = await tx`SELECT id, org_id FROM users WHERE id = ${userId} AND org_status = 'pending' FOR UPDATE`;
    if (!target) throw new HttpError(404, "대기 중인 사용자가 아니에요.");
    if (orgId && target.orgId !== orgId) throw new HttpError(403, "우리 기관 사용자만 승인할 수 있어요.");
    await tx`UPDATE users
      SET org_status = ${action === "approve" ? "verified" : "rejected"},
          verified_by = ${u.id}, verified_at = now()
      WHERE id = ${target.id}`;
    // 기관의 첫 승인이 곧 기관 확인이다.
    if (action === "approve") await tx`UPDATE organizations SET verified = true WHERE id = ${target.orgId}`;
  });
  return Response.json({ ok: true });
});
