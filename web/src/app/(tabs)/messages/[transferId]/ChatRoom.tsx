"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TRANSFER_STATUS, ampm } from "@/lib/labels";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sk } from "@/components/Skeleton";

type Msg = { id: string; senderId: string; body: string; createdAt: string };
type Person = { id: string; name: string; org: string };
type Props = {
  transferId: string; me: string; owner: Person; requester: Person;
  item: { id: string; name: string; thumb: string | null; status: string };
  transferStatus: string;
  scheduledAt: string | null;   // 예약 확정 시각 — 대화 중 그 자리에 "예약이 확정되었습니다"를 끼운다
};

const dateOf = (d: string) => new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

function Avatar() {
  return (
    <span className="size-7 shrink-0 rounded-full bg-neutral-200 grid place-items-center text-white">
      <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor"><circle cx="12" cy="8.5" r="4" /><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5z" /></svg>
    </span>
  );
}

/** 기획 정의서 14 채팅 화면. MVP §5 — 5초 폴링, WebSocket 없음. */
export function ChatRoom({ transferId, me, owner, requester, item, transferStatus, scheduledAt }: Props) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);   // 첫 조회 전엔 "첫 메시지를 보내 보세요"를 띄우지 않는다
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [askUnschedule, setAskUnschedule] = useState(false);
  // 확정·완료·취소 진행 중 — 요청부터 새 상태가 화면에 올 때(refresh)까지. 그동안 버튼 문구가 바뀌고 두 번 못 누른다
  const [acting, setActing] = useState<"schedule" | "unschedule" | "complete" | null>(null);
  // setActing(null)을 refresh와 같은 transition에 넣어, 새 상태가 그려질 때 같이 풀린다
  const [, startRefresh] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // 모바일 키보드: iOS Safari는 키보드가 떠도 fixed 레이어 크기를 안 줄이고 페이지를 밀어 올린다.
  // 그래서 화면 높이·위치를 visualViewport(키보드를 뺀 실제 보이는 영역)에 맞춘다 — 헤더는 제자리, 대화 목록만 줄어든다.
  const [vv, setVv] = useState<{ h: number; top: number; kb: boolean } | null>(null);
  const lastAt = useRef<string | null>(null);

  const isOwner = me === owner.id;
  const other = isOwner ? requester : owner;
  const people: Record<string, Person> = { [owner.id]: owner, [requester.id]: requester };

  const poll = useCallback(async () => {
    const q = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : "";
    const r = await fetch(`/api/transfers/${transferId}/messages${q}`).catch(() => null);
    setLoaded(true);
    if (!r?.ok) return;
    const rows: Msg[] = await r.json();
    if (rows.length) {
      lastAt.current = rows[rows.length - 1].createdAt;
      setMsgs((m) => [...m, ...rows.filter((x) => !m.some((y) => y.id === x.id))]);
    }
  }, [transferId]);

  useEffect(() => {
    void Promise.resolve().then(poll);
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    // kb: 키보드가 떠 있다 — 보이는 높이가 창보다 한참 작다. 그땐 홈 인디케이터가 가려져 그 여백을 뺀다
    const on = () => setVv({ h: v.height, top: v.offsetTop, kb: window.innerHeight - v.height > 120 });
    void Promise.resolve().then(on);
    v.addEventListener("resize", on);
    v.addEventListener("scroll", on);
    return () => { v.removeEventListener("resize", on); v.removeEventListener("scroll", on); };
  }, []);

  // 맨 아래로 — 대화 목록 안에서만 스크롤한다 (scrollIntoView는 페이지까지 밀어 올린다). 키보드가 뜰 때(vv.h 변화)도.
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, vv?.h]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setText("");
    const r = await fetch(`/api/transfers/${transferId}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    if (r.ok) { const m = await r.json(); lastAt.current = m.createdAt; setMsgs((x) => [...x, m]); }
    else { setText(body); setErr((await r.json().catch(() => ({}))).error ?? "보내지 못했어요."); }
    setBusy(false);
    input.current?.focus();   // 보낸 뒤에도 키보드를 유지한다
  }

  async function act(action: "schedule" | "unschedule" | "complete") {
    // 확정·완료는 카드 자체가 "~하시겠습니까? [확인]"이라 한 번 더 묻지 않는다. 되돌리기(예약 취소)만 ConfirmDialog로 묻는다.
    if (acting) return;
    setMenu(false); setActing(action); setErr(null);
    const r = await fetch(`/api/transfers/${transferId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "처리하지 못했어요."); setActing(null); setAskUnschedule(false); return; }
    startRefresh(() => { router.refresh(); setActing(null); setAskUnschedule(false); });
  }

  const closed = transferStatus === "cancelled" || transferStatus === "completed";
  const reservedElsewhere = item.status === "reserved" && transferStatus !== "scheduled";
  const st = TRANSFER_STATUS[transferStatus] ?? { label: "", cls: "" };
  const ownerReplied = msgs.some((m) => m.senderId === owner.id);

  // 예약 확정 알림 (기획 정의서 338-13 등록자 카드 / 338-14 신청자 한 줄). 확정 뒤 첫 메시지 앞, 없으면 대화 끝.
  const showEvent = !!scheduledAt && (transferStatus === "scheduled" || transferStatus === "completed");
  const eventAt = showEvent ? msgs.findIndex((m) => m.createdAt > scheduledAt!) : -2;
  const scheduledEvent = !showEvent ? null : isOwner ? (
    <div className="mt-5 rounded-2xl bg-neutral-100/80 px-4 py-3.5">
      <p className="text-sm font-bold">예약이 확정되었습니다</p>
      <p className="mt-0.5 text-xs text-neutral-500">예약 상태가 공유되었습니다</p>
    </div>
  ) : (
    <p className="mt-5 flex items-center gap-2 rounded-2xl bg-neutral-100/80 px-4 py-3.5 text-sm text-neutral-700">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand" />예약이 확정되었습니다!
    </p>
  );

  return (
    // 채팅방은 탭바 없이 화면 전체 (기획 정의서 14). 탭 레이아웃 위에 덮는다.
    <main className="fixed inset-x-0 top-0 z-30 mx-auto flex h-dvh max-w-md flex-col bg-white"
      style={vv ? { height: vv.h, transform: `translateY(${vv.top}px)` } : undefined}>
      {/* 상단 — 상대 이름·기관, 누르면 상대 프로필 */}
      <header className="relative flex h-16 shrink-0 items-center justify-between px-2">
        <Link href="/messages" aria-label="대화 목록" className="size-10 grid place-items-center text-2xl text-neutral-900">‹</Link>
        <Link href={`/users/${other.id}`} className="absolute inset-x-16 text-center">
          <p className="truncate text-lg font-extrabold leading-tight">{other.name}</p>
          <p className="truncate text-xs text-neutral-400">{other.org}</p>
        </Link>
        <button type="button" onClick={() => setMenu((v) => !v)} aria-label="더보기" aria-expanded={menu} aria-haspopup="menu"
          className={`grid size-10 place-items-center rounded-full text-neutral-900 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 ${menu ? "bg-neutral-100" : "active:bg-neutral-100"}`}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
        </button>
        {menu && (
          <>
            {/* 바깥을 누르거나 Esc면 닫힌다. 항목을 누르면(물품 보기 → 바텀시트) 먼저 닫고 이동한다 */}
            <button type="button" aria-label="메뉴 닫기" tabIndex={-1} onClick={() => setMenu(false)} className="fixed inset-0 z-10 cursor-default" />
            <ul role="menu" onKeyDown={(e) => { if (e.key === "Escape") setMenu(false); }}
              className="absolute right-3 top-14 z-20 w-44 overflow-hidden rounded-2xl bg-white p-1.5 text-[15px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5">
              <li role="none">
                <Link role="menuitem" href={`/items/${item.id}`} onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-neutral-50 active:bg-neutral-100">
                  <svg aria-hidden viewBox="0 0 24 24" className="size-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="M4 8l8-4 8 4v8l-8 4-8-4z" /><path d="M4 8l8 4 8-4M12 12v8" /></svg>
                  물품 보기
                </Link>
              </li>
              <li role="none">
                <Link role="menuitem" href={`/users/${other.id}`} onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-neutral-50 active:bg-neutral-100">
                  <svg aria-hidden viewBox="0 0 24 24" className="size-5 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" /></svg>
                  상대 프로필
                </Link>
              </li>
              {isOwner && transferStatus === "scheduled" && (
                <li role="none" className="mt-1 border-t border-neutral-100 pt-1">
                  <button role="menuitem" onClick={() => { setMenu(false); setAskUnschedule(true); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-accent hover:bg-accent/5">
                    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M9 9l6 6M15 9l-6 6" /></svg>
                    예약 취소
                  </button>
                </li>
              )}
            </ul>
          </>
        )}
      </header>

      <ConfirmDialog open={askUnschedule} danger title="예약을 취소할까요?"
        desc="다시 채팅 중으로 돌아가고, 물품도 다른 기관이 신청할 수 있게 열려요."
        busy={acting === "unschedule"} confirmLabel="예약 취소" onConfirm={() => act("unschedule")} onCancel={() => setAskUnschedule(false)} />

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
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${st.cls}`}>{st.label}</span>
      </Link>

      {/* 대화 */}
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {!loaded && (
          <div aria-busy="true" aria-label="대화 불러오는 중" className="space-y-5 pt-6">
            <Sk className="h-12 w-3/5 rounded-2xl" />
            <Sk className="ml-auto h-12 w-1/2 rounded-2xl" />
            <Sk className="h-16 w-2/3 rounded-2xl" />
          </div>
        )}
        {loaded && msgs.length === 0 && <p className="py-10 text-center text-xs text-neutral-400">첫 메시지를 보내 보세요.</p>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const eventHere = i === eventAt;
          const newDay = !prev || dateOf(prev.createdAt) !== dateOf(m.createdAt);
          const showWho = newDay || prev.senderId !== m.senderId;
          const mine = m.senderId === me;
          const who = people[m.senderId];
          return (
            <div key={m.id}>
              {eventHere && scheduledEvent}
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
                <span className="mt-1 text-[11px] text-neutral-400">{ampm(m.createdAt)}</span>
              </div>
            </div>
          );
        })}
        {eventAt === -1 && scheduledEvent}

        {/* 신청 상태 안내 — 등록자가 다음 단계를 누를 차례면 카드에 버튼이 붙는다 (기획 정의서 61-143) */}
        {isOwner && transferStatus === "requested" && !reservedElsewhere ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-neutral-100/80 px-4 py-3.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">예약을 확정하시겠습니까?</span>
              <span className="mt-0.5 block truncate text-xs text-neutral-500">{requester.org} · {requester.name}님께 나눠요</span>
            </span>
            <button onClick={() => act("schedule")} disabled={!!acting} className="btn-brand shrink-0 px-4 py-2 text-sm disabled:opacity-70">{acting === "schedule" ? "확정 중…" : "확인"}</button>
          </div>
        ) : isOwner && transferStatus === "scheduled" ? (
          // 기획 정의서 338-52 — 예약 확정 이후 등록자에게 나눔 완료 확인
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-neutral-100/80 px-4 py-3.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">나눔 완료하셨습니까?</span>
              <span className="mt-0.5 block truncate text-xs text-neutral-500">수령 완료 여부를 확인해 주세요</span>
            </span>
            <button onClick={() => act("complete")} disabled={!!acting} className="btn-brand shrink-0 px-4 py-2 text-sm disabled:opacity-70">{acting === "complete" ? "처리 중…" : "확인"}</button>
          </div>
        ) : !isOwner && transferStatus === "requested" && !ownerReplied ? null : (
          // 신청자에게 "예약 확정 대기 중"은 등록자가 한 번이라도 답한 뒤에 (QA 1차 — 들어가자마자 뜨면 어색하다)
          <p className="mt-5 flex items-center gap-2 rounded-2xl bg-neutral-100/80 px-4 py-3.5 text-sm text-neutral-700">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${transferStatus === "cancelled" ? "bg-neutral-400" : "bg-brand"}`} />
            {transferStatus === "completed" ? "나눔이 완료되었습니다. 감사합니다!"
              : transferStatus === "cancelled" ? "종료된 대화예요"
              : transferStatus === "scheduled" ? "나눔기관 담당자의 나눔 완료 처리를 기다리고 있어요"
              : isOwner ? "다른 신청 기관과 예약된 물품이에요"
              : "나눔기관 담당자의 예약 확정 대기 중"}
          </p>
        )}
        {err && <p className="mt-2 text-center text-xs text-accent">{err}</p>}
      </div>

      {/* 하단 — 내 역할·이름·상태, 입력 */}
      <div className={`shrink-0 px-4 ${vv?.kb ? "pb-2" : "pb-[calc(12px+env(safe-area-inset-bottom))]"}`}>
        <p className="mb-2 text-center text-[11px] text-neutral-400">
          {isOwner ? "나눔기관" : "신청기관"} 담당자 · {(isOwner ? owner : requester).name} · {st.label}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex h-12 items-center gap-2 rounded-full border border-neutral-200 pl-4 pr-1.5 focus-within:border-brand">
          <input className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-neutral-400"
            ref={input} value={text} onChange={(e) => setText(e.target.value)} disabled={closed}
            enterKeyHint="send"
            placeholder={closed ? "종료된 대화예요" : "메시지를 입력하세요"} aria-label="메시지" />
          {/* 누를 때 포커스를 뺏지 않는다 — 입력창에서 포커스가 빠지면 모바일 키보드가 내려간다 */}
          <button aria-label="보내기" disabled={closed || busy || !text.trim()} onPointerDown={(e) => e.preventDefault()}
            className="size-9 shrink-0 rounded-full bg-brand text-white grid place-items-center disabled:opacity-40">
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          </button>
        </form>
      </div>
    </main>
  );
}
