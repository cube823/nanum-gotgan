import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";
import { checkBizNoFor } from "@/lib/bizno";

/** 회원가입 STEP 2 "인증하기". 기관을 만들거나 합류하기 전에 번호만 먼저 본다.
 *  { bizNo, orgId? } — orgId가 있으면 그 기관에 저장된 번호와도 대조한다.
 *  같은 검사를 POST /api/orgs가 다시 한다 — 이건 화면용 미리보기다. */
export const POST = api(async (req) => {
  await requireUser();                      // 익명으로 국세청 API를 대신 불러주지 않는다
  const { bizNo, orgId } = await req.json();
  let expected: string | null = null;
  if (orgId) {
    const [org] = await sql`SELECT biz_no FROM organizations WHERE id = ${orgId}`;
    if (!org) throw new HttpError(404, "기관을 찾을 수 없어요.");
    expected = org.bizNo;
  }
  const r = await checkBizNoFor(String(bizNo ?? ""), expected);
  if (!r.ok) throw new HttpError(400, r.reason);
  return Response.json({ matched: r.matched });
});
