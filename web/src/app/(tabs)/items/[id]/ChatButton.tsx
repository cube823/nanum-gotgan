"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// MVP §4.3 — 채팅하기 = transfers 생성. 이미 있으면 그 방으로.
export function ChatButton({ itemId, verified, reserved }: { itemId: string; verified: boolean; reserved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!verified) {
    return <button onClick={() => router.push("/pending")} className="btn-ghost w-full">소속 확인 후 신청할 수 있어요</button>;
  }

  async function go() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/transfers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId }) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); setBusy(false); return; }
    router.push(`/messages/${j.id}`);
  }

  return (
    <div>
      <button onClick={go} disabled={busy} className="btn-cta">
        {reserved ? "예약된 물품이에요 — 그래도 채팅하기" : "채팅하기"}
      </button>
      {err && <p className="mt-2 text-xs text-accent text-center">{err}</p>}
    </div>
  );
}
