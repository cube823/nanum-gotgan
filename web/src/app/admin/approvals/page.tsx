"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  id: string; nickname: string; email: string | null; orgRole: string; createdAt: string;
  orgId: string; orgName: string; orgType: string; orgVerified: boolean;
};

const ORG_DOMAIN = /@(.*\.go\.kr|.*\.or\.kr)$/i;

export default function ApprovalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(
    () => fetch("/api/admin/approvals").then(async (r) => (r.ok ? setRows(await r.json()) : setErr((await r.json()).error))),
    []
  );
  useEffect(() => { void load(); }, [load]);

  async function act(userId: string, action: "approve" | "reject") {
    const r = await fetch("/api/admin/approvals", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, action }) });
    if (!r.ok) { setErr((await r.json()).error); return; }
    load();
  }

  return (
    <main className="flex-1 px-4 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">소속 승인</h1>
        <Link href="/swipe" className="text-sm text-neutral-500">닫기</Link>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        기관명 사칭을 막는 유일한 방어선이에요. 이메일 도메인·이름·시각을 보고 판단해 주세요.
      </p>
      {err && <p className="mt-3 text-sm text-accent">{err}</p>}
      {rows.length === 0 && !err && <p className="mt-10 text-center text-neutral-400">대기 중인 요청이 없어요.</p>}
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.orgName}
                  <span className="ml-2 chip bg-neutral-100 text-neutral-600">{r.orgType}</span>
                  {!r.orgVerified && <span className="ml-1 chip bg-amber-100 text-amber-800">새 기관</span>}
                </p>
                <p className="mt-1 text-sm">{r.nickname}
                  {r.orgRole === "manager" && <span className="ml-1 text-xs text-neutral-400">(기관 첫 담당자)</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {r.email ?? "이메일 없음"}
                  {r.email && ORG_DOMAIN.test(r.email) && <span className="ml-1 chip bg-brand/10 text-brand-dark">기관 도메인</span>}
                </p>
                <p className="text-xs text-neutral-400">{new Date(r.createdAt).toLocaleString("ko-KR")}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => act(r.id, "approve")} className="btn-brand flex-1 text-sm py-2">승인</button>
              <button onClick={() => act(r.id, "reject")} className="btn-ghost flex-1 text-sm py-2">반려</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
