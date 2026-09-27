"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** 98dvh 바텀시트 (기획 정의서 11). 인터셉팅 라우트용 — 닫기 = router.back().
 *  배경 탭 · Esc · 위쪽 가장자리를 아래로 끌기(100px 이상)로 닫는다. 열려 있는 동안 뒤 화면 스크롤을 막는다. */
export function Sheet({ label, children }: { label: string; children: React.ReactNode }) {
  const router = useRouter();
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const close = () => router.back();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.back(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [router]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={close} />
      <div
        className="absolute bottom-0 inset-x-0 mx-auto max-w-md h-[98dvh] flex flex-col rounded-t-[20px] bg-white shadow-2xl animate-sheet-up"
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: dragging ? "none" : "transform 0.2s" }}>
        <div
          className="absolute top-0 inset-x-0 z-10 h-7 grid place-items-center cursor-grab touch-none"
          onPointerDown={(e) => { start.current = e.clientY; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (start.current !== null) setDy(Math.max(0, e.clientY - start.current)); }}
          onPointerUp={() => { start.current = null; setDragging(false); if (dy > 100) close(); else setDy(0); }}
          onPointerCancel={() => { start.current = null; setDragging(false); setDy(0); }}>
          {/* Figma엔 손잡이가 없다 — 끌어내리기 영역만 남기고 보이지 않게 */}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain rounded-t-[20px]">{children}</div>
      </div>
    </div>
  );
}

/** 기획 정의서 11 — 사진 오른쪽 위 ↓. 시트를 내린다 (배경 탭·Esc·끌어내리기와 같다). */
export function SheetCloseButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} aria-label="내리기"
      className="size-9 rounded-full bg-white shadow-md grid place-items-center text-neutral-800">
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
    </button>
  );
}
