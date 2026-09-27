import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { OnboardingFlow } from "./OnboardingFlow";
import type { Category } from "@/lib/types";

// 카테고리를 DB에서 읽는다 — 빌드 시점에 굳으면 seed를 바꿔도 재배포 전까지 안 바뀐다.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // 🔴(전기·소형비품)는 관심 자원으로 고르지 않는다 — 등록은 승인 확인을 거쳐 가능하다.
  const cats = await sql<Category[]>`
    SELECT code, label, risk_level, notice FROM categories
    WHERE risk_level <> 'red' ORDER BY sort_order`;

  // 새로고침하거나 중간에 나갔다 와도 채운 데까지는 건너뛴다.
  const u = await requireUser();

  return (
    <OnboardingFlow
      categories={cats}
      profile={{ realName: u.realName ?? "", phone: u.phone ?? "", hasOrg: !!u.orgId }}
    />
  );
}
