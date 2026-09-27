"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ItemCard } from "@/lib/types";
import { CONDITION_LABEL } from "@/lib/labels";

/**
 * 02 기획서: 왼쪽으로 밀기·X = 다음, 오른쪽으로 밀기 = 이전, ↑ = 상세(시트), ♡ = 북마크 토글, 돋보기 = 목록.
 * 좌/우는 이동이지 호불호가 아니다. 넘긴 건 swipes에 기록 (백그라운드).
 * 카드는 손가락(마우스)을 따라 움직이고, FLING_AT px 넘게 밀면 화면 밖으로 날아간 뒤 다음 카드가 올라온다.
 * 호감은 하트(bookmarks)가 따로 맡는다 — 프로필 > 북마크에서 모아 본다.
 */
export default function SwipePage() {
  const [cards, setCards] = useState<ItemCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const card = cards?.[idx];
  const [photoIdx, setPhotoIdx] = useState(0);   // 02: 사진 우측 터치 = 다음 사진, 좌측 = 이전 사진
  const start = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [fly, setFly] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    fetch("/api/items").then((r) => r.json()).then(setCards);
  }, []);

  const mark = (id: string) =>
    fetch("/api/swipes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: id }) }).catch(() => {});

  const next = () => { if (!cards) return; if (idx < cards.length) mark(cards[idx].id); setIdx((i) => Math.min(i + 1, cards.length)); setPhotoIdx(0); };
  const prev = () => { setIdx((i) => Math.max(i - 1, 0)); setPhotoIdx(0); };

  /** 먼저 칠하고 요청한다. 실패하면 되돌린다 — 하트는 눌렀을 때 바로 반응해야 한다. */
  const setMark = (id: string, on: boolean) =>
    setCards((cs) => cs && cs.map((c) => (c.id === id
      ? { ...c, bookmarked: on, bookmarkCount: Math.max(0, (c.bookmarkCount ?? 0) + (on ? 1 : -1)) }
      : c)));
  const toggleBookmark = async () => {
    if (!card) return;
    const on = !card.bookmarked;
    setMark(card.id, on);
    const r = await fetch(`/api/items/${card.id}/bookmark`, { method: on ? "PUT" : "DELETE" }).catch(() => null);
    if (!r?.ok) setMark(card.id, !on);
  };
  /** 날려 보낸 뒤 transitionend에서 실제로 넘긴다. 오른쪽(이전)은 첫 카드면 제자리로. */
  const fling = (dir: "left" | "right") => {
    if (fly) return;
    if (dir === "right" && idx === 0) { setDrag(null); return; }
    setFly(dir);
  };
  const landed = () => {
    if (!fly) return;
    if (fly === "left") next(); else prev();
    setFly(null); setDrag(null);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a") || fly) return;   // 버튼 누르기는 드래그가 아니다
    start.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current) setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y });
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x, dy = e.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {           // 탭 = 사진 넘기기 (02: 우측 터치 다음, 좌측 이전)
      setDrag(null);
      const n = card?.photos.length ?? 0;
      if (n < 2) return;
      const r = e.currentTarget.getBoundingClientRect();
      const right = e.clientX - r.left > r.width / 2;
      setPhotoIdx((p) => (right ? Math.min(p + 1, n - 1) : Math.max(p - 1, 0)));
      return;
    }
    if (dx < -FLING_AT) fling("left");
    else if (dx > FLING_AT) fling("right");
    else setDrag(null);                                   // 덜 밀었으면 제자리로
  };

  const dx = drag?.dx ?? 0;
  const frontStyle: React.CSSProperties = fly
    ? { transform: `translateX(${fly === "left" ? -140 : 140}%) rotate(${fly === "left" ? -18 : 18}deg)`, transition: "transform 0.28s ease-in" }
    : drag
      ? { transform: `translate(${dx}px, ${(drag.dy) * 0.15}px) rotate(${dx / 18}deg)`, transition: "none" }
      : { transform: "none", transition: "transform 0.25s ease-out" };
  const behind = cards?.[idx + 1];
  const behindScale = fly === "left" ? 1 : 0.94 + 0.06 * Math.min(1, Math.abs(dx) / FLING_AT);

  return (
    <main className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-5 pt-4 pb-3">
        <span className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={36} height={36} className="size-9" />
          나눔곳간
        </span>
        <span className="flex items-center gap-1">
          <Link href="/items" aria-label="전체 목록" className="size-10 grid place-items-center text-neutral-900">
            <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          </Link>
          {/* ponytail: 알림 기능이 없어 메시지로 보낸다 — 새 메시지 표시가 지금 있는 유일한 알림이다 */}
          <Link href="/messages" aria-label="알림" className="size-10 grid place-items-center text-neutral-900">
            <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>
          </Link>
        </span>
      </header>

      <div className="flex-1 px-3.5 pb-3 flex flex-col">
        {cards === null && <div className="flex-1 grid place-items-center text-neutral-400">불러오는 중…</div>}

        {cards && !card && (
          <div className="flex-1 rounded-2xl bg-neutral-50 grid place-items-center text-center p-8">
            <div>
              <p className="text-lg font-semibold">{cards.length === 0 ? "아직 올라온 물품이 없어요" : "다 보셨어요"}</p>
              <p className="mt-2 text-sm text-neutral-500">전체 목록에서 다시 찾을 수 있어요.</p>
              <Link href="/items" className="btn-brand mt-6">전체 목록 보기</Link>
            </div>
          </div>
        )}

        {card && (
          <div className="relative flex-1 min-h-[440px]">
            {behind && (
              <div aria-hidden className="absolute inset-0 transition-transform duration-200" style={{ transform: `scale(${behindScale})` }}>
                <CardFace card={behind} photoIdx={0} />
              </div>
            )}
            <div key={card.id} className="absolute inset-0 touch-none select-none cursor-grab active:cursor-grabbing"
              style={frontStyle} onTransitionEnd={(e) => { if (e.target === e.currentTarget) landed(); }}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
              onPointerCancel={() => { start.current = null; setDrag(null); }}>
              <CardFace card={card} photoIdx={photoIdx}>
                <div className="mt-6 flex justify-center gap-5">
                  <button onClick={() => fling("left")} aria-label="넘기기" className="size-14 rounded-full bg-white shadow-lg grid place-items-center text-accent">
                    <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                  <Link href={`/items/${card.id}`} scroll={false} aria-label="상세정보" className="size-14 rounded-full bg-white shadow-lg grid place-items-center text-neutral-700">
                    <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
                  </Link>
                  <button onClick={toggleBookmark} aria-label="북마크" aria-pressed={!!card.bookmarked}
                    className="size-14 rounded-full bg-white shadow-lg grid place-items-center text-brand">
                    <svg key={String(!!card.bookmarked)} aria-hidden viewBox="0 0 24 24"
                      className={`size-6 ${card.bookmarked ? "animate-pop" : ""}`}
                      fill={card.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round">
                      <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
                    </svg>
                  </button>
                </div>
              </CardFace>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/** 이만큼 밀면 넘긴다. 폰 폭(390)의 약 1/4. */
const FLING_AT = 100;

/** 카드 한 장 — 사진, 상단 표시, 물품 정보. children = 하단 버튼 (앞 카드에만). */
function CardFace({ card, photoIdx, children }: { card: ItemCard; photoIdx: number; children?: React.ReactNode }) {
  return (
    <div className="relative size-full rounded-3xl overflow-hidden bg-neutral-100 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {card.photos[photoIdx] && <img src={card.photos[photoIdx]} alt={card.name} draggable={false} className="absolute inset-0 size-full object-cover pointer-events-none" />}
      {card.photos.length > 1 && (
        <div className="absolute top-2.5 inset-x-0 flex justify-center gap-1 pointer-events-none">
          {card.photos.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === photoIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
          ))}
        </div>
      )}
      <div className="absolute top-5 inset-x-3.5 flex justify-between items-start pointer-events-none text-white text-sm font-semibold">
        {district(card.orgAddress) ? (
          <span className="flex items-center gap-1 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur">
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            {district(card.orgAddress)}
            {card.distanceKm != null && <> · {card.distanceKm}km</>}
          </span>
        ) : <span />}
        <span className="flex items-center gap-2.5 rounded-full bg-black/45 px-3 py-1.5 backdrop-blur">
          <span className="flex items-center gap-1" aria-label={`북마크 ${card.bookmarkCount ?? 0}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" /></svg>
            {card.bookmarkCount ?? 0}
          </span>
          <span className="flex items-center gap-1" aria-label={`채팅 ${card.chatCount ?? 0}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round"><path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1z" /></svg>
            {card.chatCount ?? 0}
          </span>
        </span>
      </div>

      {/* 물품 정보 + 버튼 — 기획 정의서 main-3·main-4. 사진 위에 얹는다 */}
      <div className="absolute inset-x-0 bottom-0 px-5 pt-24 pb-6 bg-gradient-to-t from-black/80 via-black/45 to-transparent text-white">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold">{card.categoryLabel}</span>
          <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-medium backdrop-blur">{CONDITION_LABEL[card.condition]}</span>
          <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-medium backdrop-blur">{card.isUsed ? "사용함" : "사용 안 함"}</span>
        </div>
        <p className="mt-3 text-2xl font-extrabold leading-tight line-clamp-2">{card.name}</p>
        <p className="mt-1 text-sm text-white/70 truncate">{card.orgName}</p>
        {children}
      </div>
    </div>
  );
}

/** "서울특별시 성북구 …" → "성북구". 거리는 swipeFeed의 distance_km (좌표 없으면 숨김). */
function district(address?: string | null) {
  return address?.match(/(\S+구)(?=\s)/)?.[1] ?? null;
}
