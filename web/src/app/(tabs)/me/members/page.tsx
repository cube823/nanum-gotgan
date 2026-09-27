import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ymd } from "@/lib/labels";
import { SubPage } from "../SubPage";
import { Avatar } from "../Avatar";

// 우리 기관 > 기관 구성원 보기. 이름·역할·가입일만 — 연락처는 보이지 않는다 (상대 프로필과 같은 원칙).
export default async function MembersPage() {
  const u = await requireUser();
  const rows = u.orgId ? await sql`
    SELECT id, COALESCE(real_name, nickname) AS name, profile_image, org_role, org_status, created_at
    FROM users WHERE org_id = ${u.orgId}
    ORDER BY org_role = 'manager' DESC, created_at` : [];

  return (
    <SubPage title="기관 구성원">
      {rows.length === 0 && <p className="py-24 text-center text-sm text-neutral-400">소속 기관이 없어요.</p>}
      <ul className="divide-y divide-neutral-100 px-4">
        {rows.map((m) => (
          <li key={m.id}>
            <Link href={`/users/${m.id}`} className="flex items-center gap-3 py-4">
              <Avatar src={m.profileImage} className="size-11" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-bold">{m.name}</span>
                  {m.id === u.id && <span className="text-xs text-neutral-400">나</span>}
                  {m.orgRole === "manager" && <span className="chip bg-brand/10 text-brand-dark">기관 담당자</span>}
                  {m.orgStatus !== "verified" && <span className="chip bg-amber-100 text-amber-800">확인 중</span>}
                </span>
                <span className="block text-xs text-neutral-400">{ymd(m.createdAt)} 가입</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SubPage>
  );
}
