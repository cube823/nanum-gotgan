"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Msg = { id: string; senderId: string; body: string; createdAt: string };
type Person = { id: string; name: string; org: string };
type Props = {
  transferId: string; me: string; owner: Person; requester: Person;
  item: { id: string; name: string; thumb: string | null; status: string };
  transferStatus: string;
};

const STATUS_LABEL: Record<string, string> = { requested: "채팅 중", scheduled: "예약 중", completed: "나눔 완료", cancelled: "종료" };

const timeOf = (d: string) => new Date(d).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
const dateOf = (d: string) => new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

function Avatar() {
  return (
    <span className="size-7 shrink-0 rounded-full bg-neutral-200 grid place-items-center text-white">
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor"><circle cx="12" cy="8.5" r="4" /><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5z" /></svg>
    </span>
  );
}

/** 기획 정의서 14 채팅 화면. MVP §5 — 5초 폴링, WebSocket 없음. */
export function ChatRoom({ transferId, me, owner, requester, item, transferStatus }: Props) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | null>(null);

  const isOwner = me === owner.id;
  const other = isOwner ? requester : owner;
  const people: Record<string, Person> = { [owner.id]: owner, [requester.id]: requester };

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
    else { setText(body); setErr((await r.json().catch(() => ({}))).error ?? "보내지 못했어요."); }
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
  const reservedElsewhere = item.status === "reserved" && transferStatus !== "scheduled";
  const statusLabel = STATUS_LABEL[transferStatus] ?? "";

  return (
    // 채팅방은 탭바 없이 화면 전체 (기획 정의서 14). 탭 레이아웃 위에 덮는다.
    <main className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white">
      {/* 상단 — 상대 이름·기관, 누르면 상대 프로필 */}
      <header className="relative flex h-16 shrink-0 items-center justify-between px-2">
        <Link href="/messages" aria-label="대화 목록" className="size-10 grid place-items-center text-2xl text-neutral-900">‹</Link>
        <Link href={`/users/${other.id}`} className="absolute inset-x-16 text-center">
          <p className="truncate text-lg font-extrabold leading-tight">{other.name}</p>
          <p className="truncate text-xs text-neutral-400">{other.org}</p>
        </Link>
        <button type="button" onClick={() => setMenu((v) => !v)} aria-label="더보기" aria-expanded={menu}
          className="size-10 grid place-items-center text-neutral-900">
          <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
        </button>
        {menu && (
          <ul className="absolute right-3 top-14 z-10 w-40 overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1 text-sm shadow-lg">
            <li><Link href={`/items/${item.id}`} className="block px-4 py-2.5 hover:bg-neutral-50">물품 보기</Link></li>
            <li><Link href={`/users/${other.id}`} className="block px-4 py-2.5 hover:bg-neutral-50">상대 프로필</Link></li>
          </ul>
        )}
      </header>

      {/* 물품 카드 — 물품명 + 신청 상태 */}
      <Link href={`/items/${item.id}`} className="mx-4 flex shrink-0 items-center gap-3 rounded-2xl bg-brand/5 px-3 py-3">
        <span className="size-12 shrink-0 overflow-hidden rounded-xl bg-neutral-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.thumb && <img src={item.thumb} alt="" className="size-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{item.name}</span>
          <span className="block truncate text-xs text-neutral-400">{owner.org} · {owner.name}</span>
        </span>
        <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{statusLabel}</span>
      </Link>

      {/* 대화 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {msgs.length === 0 && <p className="py-10 text-center text-xs text-neutral-400">첫 메시지를 보내 보세요.</p>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const newDay = !prev || dateOf(prev.createdAt) !== dateOf(m.createdAt);
          const showWho = newDay || prev.senderId !== m.senderId;
          const mine = m.senderId === me;
          const who = people[m.senderId];
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
                  <span className="h-px flex-1 bg-neutral-200" />{dateOf(m.createdAt)}<span className="h-px flex-1 bg-neutral-200" />
                </div>
              )}
              <div className={`flex flex-col ${mine ? "items-end" : "items-start"} ${showWho ? "mt-4" : "mt-1.5"}`}>
                {showWho && who && (
                  <div className={`mb-1.5 flex items-center gap-2 ${mine ? "flex-row-reverse text-right" : ""}`}>
                    <Avatar />
                    <span>
                      <span className="block text-sm font-bold leading-tight">{who.name}</span>
                      <span className="block text-[11px] text-neutral-400">{who.org}</span>
                    </span>
                  </div>
                )}
                <p className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                  mine ? "rounded-tr-md bg-brand/10" : "rounded-tl-md bg-neutral-100"}`}>
                  {m.body}
                </p>
                <span className="mt-1 text-[11px] text-neutral-400">{timeOf(m.createdAt)}</span>
              </div>
            </div>
          );
        })}

        {/* 신청 상태 안내 — 등록자면 다음 단계 버튼이 여기 붙는다 */}
        <div className="mt-5 rounded-2xl bg-neutral-100/80 px-4 py-3.5 text-sm">
          <p className="flex items-center gap-2 text-neutral-700">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${closed ? "bg-neutral-400" : "bg-brand"}`} />
            {transferStatus === "completed" ? "나눔이 완료됐어요"
              : transferStatus === "cancelled" ? "종료된 대화예요"
              : transferStatus === "scheduled" ? (isOwner ? "예약을 확정했어요 · 물품을 건넸다면 양도 완료를 눌러 주세요" : "예약이 확정됐어요 · 약속한 날 받으러 가요 🎉")
              : isOwner ? (reservedElsewhere ? "다른 신청 기관과 예약된 물품이에요" : "이 기관에 드리기로 했다면 예약을 확정해 주세요")
              : "나눔기관 담당자의 예약 확정 대기 중"}
          </p>
          {isOwner && transferStatus === "requested" && !reservedElsewhere && (
            <button onClick={() => act("schedule")} className="btn-brand mt-3 w-full py-2.5 text-sm">예약 확정</button>
          )}
          {isOwner && transferStatus === "scheduled" && (
            <div className="mt-3 flex gap-2">
              <button onClick={() => act("unschedule")} className="btn-ghost py-2.5 text-sm">예약 취소</button>
              <button onClick={() => act("complete")} className="btn-brand flex-1 py-2.5 text-sm">양도 완료</button>
            </div>
          )}
        </div>
        {err && <p className="mt-2 text-center text-xs text-accent">{err}</p>}
        <div ref={bottom} />
      </div>

      {/* 하단 — 내 역할·이름·상태, 입력 */}
      <div className="shrink-0 px-4 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <p className="mb-2 text-center text-[11px] text-neutral-400">
          {isOwner ? "나눔기관" : "신청기관"} 담당자 · {(isOwner ? owner : requester).name} · {statusLabel}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex h-12 items-center gap-2 rounded-full border border-neutral-200 pl-4 pr-1.5 focus-within:border-brand">
          <input className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-neutral-400"
            value={text} onChange={(e) => setText(e.target.value)} disabled={closed || busy}
            placeholder={closed ? "종료된 대화예요" : "메시지를 입력하세요"} aria-label="메시지" />
          <button aria-label="보내기" disabled={closed || busy || !text.trim()}
            className="size-9 shrink-0 rounded-full bg-brand text-white grid place-items-center disabled:opacity-40">
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          </button>
        </form>
      </div>
    </main>
  );
}
