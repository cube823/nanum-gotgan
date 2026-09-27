import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";

/** 스와이프 하트 (기획 정의서 main-4). PUT = 켜기, DELETE = 끄기 — 둘 다 여러 번 불러도 같다.
 *  토글을 서버에서 뒤집지 않는 건 빠르게 두 번 누를 때 요청 순서가 꼬여도 마지막 의도대로 끝나게 하려고. */
async function item(params: Promise<Record<string, string>>) {
  const { id } = await params;
  const [row] = await sql`SELECT id FROM items WHERE id = ${id} AND status <> 'withdrawn'`;
  if (!row) throw new HttpError(404, "물품을 찾을 수 없어요.");
  return row.id as string;
}

export const PUT = api(async (_req, { params }) => {
  const u = await requireUser();
  const id = await item(params);
  await sql`INSERT INTO bookmarks (user_id, item_id) VALUES (${u.id}, ${id}) ON CONFLICT DO NOTHING`;
  return Response.json({ bookmarked: true });
});

export const DELETE = api(async (_req, { params }) => {
  const u = await requireUser();
  const id = await item(params);
  await sql`DELETE FROM bookmarks WHERE user_id = ${u.id} AND item_id = ${id}`;
  return Response.json({ bookmarked: false });
});
