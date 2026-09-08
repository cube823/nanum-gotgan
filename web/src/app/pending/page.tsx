"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

// 승인 대기. pending이어도 스와이프·목록은 볼 수 있다 (MVP §3) — 여기 가둬두지 않는다.
export default function PendingPage() {
  const router = useRouter();
  const { update } = useSession();
  const [org, setOrg] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await fetch("/api/me");
      if (!r.ok || !alive) return;
      const me = await r.json();
      setOrg(me.org?.name ?? null);
      setStatus(me.orgStatus);
      if (me.orgStatus === "verified") { await update(); router.push("/swipe"); }
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [router, update]);

  return (
    <main className="flex-1 flex flex-col px-6 pt-10 pb-8">
      <div className="flex-1 flex flex-col justify-center text-center">
        <div className="mx-auto size-16 rounded-full bg-brand/10 grid place-items-center text-3xl">⏳</div>
        <h1 className="mt-6 text-2xl font-bold">
          {status === "rejected" ? "소속 확인이 반려됐어요" : "소속 확인 중이에요"}
        </h1>
        {org && <p className="mt-2 text-neutral-600">{org}</p>}
        <p className="mt-4 text-sm text-neutral-500">
          {status === "rejected"
            ? "기관 정보를 다시 확인해 주세요."
            : "운영자 또는 기관 담당자가 확인하면 등록·신청을 할 수 있어요.\n그동안 나눔 물품을 둘러볼 수 있어요."}
        </p>
      </div>
      <div className="space-y-2">
        <a href="/swipe" className="btn-brand w-full">물품 둘러보기</a>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-ghost w-full">로그아웃</button>
      </div>
    </main>
  );
}
