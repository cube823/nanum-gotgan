"use client";

import { useRef, useState } from "react";

/** 상세 맨 위 사진. 손가락으로 넘기고(scroll-snap), 아래 점은 스와이프 카드(09)와 같은 모양.
 *  마우스(PC)면 좌우 화살표도 보인다 — 가로 스크롤바를 끌게 하지 않는다. */
export function PhotoCarousel({ photos }: { photos: string[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const go = (n: number) => box.current?.scrollTo({ left: n * box.current.clientWidth, behavior: "smooth" });
  const arrow = "absolute top-1/2 -translate-y-1/2 hidden pointer-fine:grid size-9 place-items-center rounded-full bg-black/40 text-white disabled:opacity-0";

  return (
    <div className="relative" role="region" aria-roledescription="사진 넘기기" aria-label={`사진 ${photos.length}장 중 ${i + 1}번째`}>
      <div ref={box} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={p} alt="" className="w-full aspect-[13/10] object-cover snap-center shrink-0" />
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <div aria-hidden className="absolute bottom-3 inset-x-0 flex justify-center gap-1 pointer-events-none">
            {photos.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full shadow transition-all ${n === i ? "w-5 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
          <button type="button" aria-label="이전 사진" disabled={i === 0} onClick={() => go(i - 1)} className={`${arrow} left-3`}>‹</button>
          <button type="button" aria-label="다음 사진" disabled={i === photos.length - 1} onClick={() => go(i + 1)} className={`${arrow} right-3`}>›</button>
        </>
      )}
    </div>
  );
}
