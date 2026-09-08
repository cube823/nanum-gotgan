"use client";

import { useRouter } from "next/navigation";

// MVP §4.5 내리기
export function WithdrawButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  async function go() {
    if (!confirm("이 물품을 내릴까요? 진행 중인 대화가 종료돼요.")) return;
    const r = await fetch(`/api/items/${itemId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "withdraw" }) });
    if (!r.ok) { alert((await r.json()).error); return; }
    router.refresh();
  }
  return <button onClick={go} className="text-xs text-neutral-400 underline shrink-0">내리기</button>;
}
