import { sql } from "@/lib/db";
import { api, requireUser } from "@/lib/session";
import { normalizeOrgName } from "@/lib/org";

// 자동완성. 두 글자만 쳐도 기존 기관이 먼저 뜨게 — "새로 만들기"가 마지막 선택지가 되도록.
export const GET = api(async (req) => {
  await requireUser();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return Response.json([]);
  const norm = normalizeOrgName(q);
  const rows = await sql`
    SELECT id, name, org_type, address, verified FROM organizations
    WHERE name_norm LIKE ${"%" + norm + "%"} OR name ILIKE ${"%" + q + "%"}
    ORDER BY verified DESC, name
    LIMIT 10`;
  return Response.json(rows);
});
