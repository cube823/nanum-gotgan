import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";
import { normalizeOrgName } from "@/lib/org";
import { checkBizNo, checkBizNoFor, normalizeBizNo } from "@/lib/bizno";

const ORG_TYPES = new Set(["위탁", "직영", "모름"]);

/**
 * 소속 정하기. DB-SCHEMA §1.5.
 *  { orgId, bizNo }               → 기존 기관에 member로 합류 (번호가 저장된 기관이면 대조)
 *  { name, orgType, bizNo }       → 새 기관 생성 + 만든 사람이 manager
 *
 * 둘 다 바로 verified다 — 기획 정의서(Figma)에 승인 단계가 없다. 가입 4단계가 끝나면
 * 곧장 자원보기로 간다 (`decisions/0008`). 기관 목록은 서울시 청년센터 명단으로
 * 시딩돼 있어(`db/orgs.sql`) 대부분 자동완성에서 고르게 된다.
 *
 * bizNo는 국세청 상태조회로 실재·휴폐업만 본다. 상호는 그 API가 검증하지 않으므로
 * "그 기관 소속"은 아무도 확인하지 않는다 (lib/bizno.ts). 승인을 없앤 대가다.
 * 이미 verified면 못 바꾼다 — 소속 변경은 MVP 밖.
 */
export const POST = api(async (req) => {
  const u = await requireUser();
  if (u.orgId && u.orgStatus === "verified") throw new HttpError(400, "이미 소속이 확정됐어요.");

  const body = await req.json();

  if (body.orgId) {
    const [org] = await sql`SELECT id, biz_no FROM organizations WHERE id = ${body.orgId}`;
    if (!org) throw new HttpError(404, "기관을 찾을 수 없어요.");
    // 합류도 번호를 받는다 — 목록에서 고르기만 하면 아무 기관에나 들어갈 수 있었다.
    const joinBiz = String(body.bizNo ?? "").trim();
    if (!joinBiz) throw new HttpError(400, "사업자등록번호를 적어 주세요.");
    const check = await checkBizNoFor(joinBiz, org.bizNo);
    if (!check.ok) throw new HttpError(400, check.reason);
    await sql`UPDATE users SET org_id = ${org.id}, org_role = 'member', org_status = 'verified' WHERE id = ${u.id}`;
    return Response.json({ orgId: org.id, role: "member" });
  }

  const name = String(body.name ?? "").trim();
  const orgType = String(body.orgType ?? "모름");
  if (name.length < 2) throw new HttpError(400, "기관명을 두 글자 이상 적어 주세요.");
  if (!ORG_TYPES.has(orgType)) throw new HttpError(400, "운영 형태가 올바르지 않아요.");

  const bizRaw = String(body.bizNo ?? "").trim();
  if (!bizRaw) throw new HttpError(400, "사업자등록번호를 적어 주세요.");
  const biz = await checkBizNo(bizRaw);
  if (!biz.ok) throw new HttpError(400, biz.reason);

  const norm = normalizeOrgName(name);
  const [dup] = await sql`SELECT id, name FROM organizations WHERE name_norm = ${norm}`;
  if (dup) throw new HttpError(409, `"${dup.name}"이(가) 이미 있어요. 목록에서 골라 주세요.`);

  const [org] = await sql`
    INSERT INTO organizations (name, name_norm, org_type, biz_no, created_by)
    VALUES (${name}, ${norm}, ${orgType}, ${normalizeBizNo(bizRaw)}, ${u.id}) RETURNING id`;
  await sql`UPDATE users SET org_id = ${org.id}, org_role = 'manager', org_status = 'verified' WHERE id = ${u.id}`;
  return Response.json({ orgId: org.id, role: "manager", bizChecked: biz.checked });
});
