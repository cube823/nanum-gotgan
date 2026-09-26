"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ItemCard } from "@/lib/types";
import { CONDITION_LABEL } from "@/lib/labels";

/**
 * 02 기획서: 좌 = 이전, 우 = 다음, X = 다음, ↑ = 상세, 돋보기 = 목록.
 * 좌/우는 이동이지 호불호가 아니다. 넘긴 건 swipes에 기록 (백그라운드).
 */
export default function SwipePage() {
  const [cards, setCards] = useState<ItemCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);   // 02: 사진 우측 터치 = 다음 사진, 좌측 = 이전 사진
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetch("/api/items").then((r) => r.json()).then(setCards);
  }, []);

  const mark = (id: string) =>
    fetch("/api/swipes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: id }) }).catch(() => {});

  const next = () => { if (!cards) return; if (idx < cards.length) mark(cards[idx].id); setIdx((i) => Math.min(i + 1, cards.length)); setPhotoIdx(0); };
  const prev = () => { setIdx((i) => Math.max(i - 1, 0)); setPhotoIdx(0); };
  // 탭(스와이프 아님)이 카드 좌/우 절반 중 어디에 떨어졌는지로 사진을 넘긴다.
  const onPhotoTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const n = cards?.[idx]?.photos.length ?? 0;
    if (n < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const right = e.clientX - r.left > r.width / 2;
    setPhotoIdx((p) => (right ? Math.min(p + 1, n - 1) : Math.max(p - 1, 0)));
  };

  const onStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
  };

  const card = cards?.[idx];

  return (
    <main className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="font-bold">나눔곳간</span>
        <Link href="/items" aria-label="목록" className="text-xl">🔍</Link>
      </header>

      <div className="flex-1 px-4 pb-4 flex flex-col" onTouchStart={onStart} onTouchEnd={onEnd}>
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
          <>
            <div className="relative flex-1 rounded-2xl overflow-hidden bg-neutral-100 min-h-[420px]" onClick={onPhotoTap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {card.photos[photoIdx] && <img src={card.photos[photoIdx]} alt={card.name} className="absolute inset-0 size-full object-cover" />}
              {card.photos.length > 1 && (
                <div className="absolute top-3 inset-x-3 flex gap-1">
                  {card.photos.map((_, i) => (
                    <span key={i} className={`h-0.5 flex-1 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/70 to-transparent text-white">
                <span className="chip bg-white/20 backdrop-blur">{card.categoryLabel}</span>
                <p className="mt-2 text-2xl font-bold">{card.name}</p>
                <p className="text-sm opacity-80">{card.orgName} · {card.quantity}{card.quantityUnit} · {CONDITION_LABEL[card.condition]}</p>
                {card.description && <p className="mt-2 text-sm opacity-80 line-clamp-2">{card.description}</p>}
              </div>
              <span className="absolute top-3 right-3 text-xs bg-black/40 text-white rounded-full px-2 py-0.5">{idx + 1} / {cards.length}</span>
            </div>
            <div className="mt-4 flex justify-center gap-4">
              <button onClick={next} aria-label="넘기기" className="size-14 rounded-full bg-white shadow-md text-2xl text-accent">✕</button>
              <Link href={`/items/${card.id}`} aria-label="상세" className="size-14 rounded-full bg-white shadow-md text-2xl grid place-items-center">↑</Link>
              <button onClick={prev} disabled={idx === 0} aria-label="이전" className="size-14 rounded-full bg-white shadow-md text-2xl disabled:opacity-30">↶</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
