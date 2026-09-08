import { sql } from "@/lib/db";
import { api, requireUser } from "@/lib/session";

export const GET = api(async () => {
  const u = await requireUser();
  const [org] = u.orgId
    ? await sql<{ id: string; name: string; orgType: string }[]>`
        SELECT id, name, org_type FROM organizations WHERE id = ${u.orgId}`
    : [];
  return Response.json({ ...u, org: org ?? null });
});
