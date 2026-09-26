import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";

/** 기획 정의서 STEP 3 — 관심 자원 키워드. 4개 이상. */
const MIN_PICKS = 4;

export const GET = api(async () => {
  const u = await requireUser();
  const rows = await sql<{ category: string }[]>`
    SELECT category FROM user_interests WHERE user_id = ${u.id}`;
  return Response.json(rows.map((r) => r.category));
});

/** 통째로 교체한다 — 나중에 "내 정보"에서 고쳐도 같은 경로를 쓴다.
 *  verified가 아니어도 된다: 온보딩(pending) 중에 고르는 화면이다. */
export const PUT = api(async (req) => {
  const u = await requireUser();
  const b = await req.json();
  const picks = Array.isArray(b.categories)
    ? [...new Set(b.categories.filter((x: unknown) => typeof x === "string"))] as string[]
    : [];

  if (picks.length < MIN_PICKS) {
    throw new HttpError(400, `${MIN_PICKS}개 이상 골라 주세요.`);
  }

  // 🔴는 추천 대상이 아니다. 존재하지 않는 code도 여기서 걸러진다.
  const allowed = await sql<{ code: string }[]>`
    SELECT code FROM categories WHERE risk_level <> 'red' AND code = ANY(${picks})`;
  if (allowed.length !== picks.length) {
    throw new HttpError(400, "고를 수 없는 자원이 섞여 있어요.");
  }

  await sql.begin(async (tx) => {
    await tx`DELETE FROM user_interests WHERE user_id = ${u.id}`;
    await tx`INSERT INTO user_interests ${tx(picks.map((c) => ({ userId: u.id, category: c })))}`;
  });

  return Response.json({ categories: picks });
});
