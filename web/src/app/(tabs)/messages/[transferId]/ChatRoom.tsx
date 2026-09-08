"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Msg = { id: string; senderId: string; body: string; createdAt: string };
type Props = { transferId: string; me: string; isOwner: boolean; transferStatus: string; itemStatus: string };

/** MVP §5 — 5초 폴링. WebSocket 없음. */
export function ChatRoom({ transferId, me, isOwner, transferStatus, itemStatus }: Props) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(null);

  const poll = useCallback(async () => {
    const q = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : "";
    const r = await fetch(`/api/transfers/${transferId}/messages${q}`);
    if (!r.ok) return;
    const rows: Msg[] = await r.json();
    if (rows.length) {
      lastAt.current = rows[rows.length - 1].createdAt;
      setMsgs((m) => [...m, ...rows.filter((x) => !m.some((y) => y.id === x.id))]);
    }
  }, [transferId]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true); setText("");
    const r = await fetch(`/api/transfers/${transferId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    if (r.ok) { const m = await r.json(); lastAt.current = m.createdAt; setMsgs((x) => [...x, m]); }
    setBusy(false);
  }

  async function act(action: "schedule" | "unschedule" | "complete") {
    if (action === "complete" && !confirm("양도를 완료할까요? 다른 신청자와의 대화는 종료돼요.")) return;
    setErr(null);
    const r = await fetch(`/api/transfers/${transferId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (!r.ok) { setErr((await r.json()).error); return; }
    router.refresh();
  }

  const closed = transferStatus === "cancelled" || transferStatus === "completed";
  const reservedElsewhere = itemStatus === "reserved" && transferStatus !== "scheduled";

  return (
    <>
      {isOwner && !closed && (
        <div className="px-4 py-2 border-b border-neutral-100 flex gap-2">
          {transferStatus === "requested" && (
            <button onClick={() => act("schedule")} disabled={reservedElsewhere} className="btn-brand flex-1 text-sm py-2">
              {reservedElsewhere ? "다른 분과 예약됨" : "이 분께 드리기로 했어요"}
            </button>
          )}
          {transferStatus === "scheduled" && (
            <>
              <button onClick={() => act("unschedule")} className="btn-ghost text-sm py-2">예약 취소</button>
              <button onClick={() => act("complete")} className="btn-brand flex-1 text-sm py-2">양도 완료</button>
            </>
          )}
        </div>
      )}
      {!isOwner && transferStatus === "scheduled" && (
        <p className="px-4 py-2 text-xs text-center bg-brand/10 text-brand-dark">이 물품을 받기로 예약됐어요 🎉</p>
      )}
      {closed && (
        <p className="px-4 py-2 text-xs text-center bg-neutral-100 text-neutral-500">
          {transferStatus === "completed" ? "나눔이 완료됐어요" : "종료된 대화예요"}
        </p>
      )}
      {err && <p className="px-4 py-1 text-xs text-accent">{err}</p>}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {msgs.length === 0 && <p className="text-center text-xs text-neutral-400 py-8">첫 메시지를 보내 보세요.</p>}
        {msgs.map((m) => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${mine ? "bg-brand text-white rounded-br-sm" : "bg-neutral-100 rounded-bl-sm"}`}>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="sticky bottom-0 flex gap-2 px-3 py-2 bg-white border-t border-neutral-100">
        <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} disabled={closed || busy}
          placeholder={closed ? "종료된 대화예요" : "메시지 입력"} />
        <button className="btn-brand px-4" disabled={closed || busy || !text.trim()}>전송</button>
      </form>
    </>
  );
}
