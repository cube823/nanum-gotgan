import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { ymd } from "@/lib/labels";
import { BackButton } from "./BackButton";

/** 상대 프로필 — 기획 정의서 11 "등록자 정보 카드 터치".
 *  이름·기관·가입일·거래 횟수만. 전화번호·이메일은 보이지 않는다 (연락은 채팅으로). */
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  await pageUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();   // uuid 아니면 SQL 에러 대신 404

  const [p] = await sql`
    SELECT COALESCE(u.real_name, u.nickname) AS name, u.profile_image, u.org_role, u.created_at,
      o.name AS org_name,
      (SELECT count(*)::int FROM transfers t JOIN items i ON i.id = t.item_id
        WHERE i.created_by = u.id AND t.status = 'completed') AS given,
      (SELECT count(*)::int FROM transfers t WHERE t.requester_id = u.id AND t.status = 'completed') AS received
    FROM users u LEFT JOIN organizations o ON o.id = u.org_id
    WHERE u.id = ${id}`;
  if (!p) notFound();

  return (
    <main className="flex-1">
      <header className="relative flex items-center h-14 px-2">
        <BackButton />
        <h1 className="absolute inset-x-0 text-center text-base font-bold pointer-events-none">프로필</h1>
      </header>

      <div className="px-5 pt-4 flex flex-col items-center text-center">
        <div className="size-20 rounded-full bg-brand/10 overflow-hidden grid place-items-center text-brand">
          {p.profileImage
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={p.profileImage} alt="" className="size-full object-cover" />
            : <svg aria-hidden viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" /></svg>}
        </div>
        <p className="mt-4 text-xl font-extrabold">{p.name}</p>
        <p className="mt-1 text-sm text-neutral-500">
          {p.orgName ?? "소속 없음"}
          {p.orgRole === "manager" && <span className="ml-1.5 chip bg-brand/10 text-brand-dark">기관 담당자</span>}
        </p>
      </div>

      <dl className="mx-5 mt-8 grid grid-cols-3 rounded-2xl bg-neutral-50 py-4 text-center">
        <div><dt className="text-xs text-neutral-400">가입일</dt><dd className="mt-1 text-sm font-bold">{ymd(p.createdAt)}</dd></div>
        <div className="border-x border-neutral-200"><dt className="text-xs text-neutral-400">나눔</dt><dd className="mt-1 text-sm font-bold">{p.given}회</dd></div>
        <div><dt className="text-xs text-neutral-400">수령</dt><dd className="mt-1 text-sm font-bold">{p.received}회</dd></div>
      </dl>
    </main>
  );
}
