"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  desc?: string;
  confirmLabel: string;
  danger?: boolean;        // 되돌리기 어려운 동작(내리기·예약 취소)은 빨간 버튼
  busy?: boolean;
  error?: string | null;   // API가 거절한 이유 — alert 대신 여기
  onConfirm: () => void;
  onCancel: () => void;
};

/** 브라우저 confirm() 대신 쓰는 확인 창. 네이티브 <dialog>라 Esc·포커스 가두기·배경은 브라우저가 한다.
 *  배경을 눌러도 닫힌다. 진행 중(busy)엔 닫히지 않는다. */
export function ConfirmDialog({ open, title, desc, confirmLabel, danger, busy, error, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();   // 물품 줄마다 창이 하나씩 있어 id가 겹치면 안 된다

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      className="m-auto w-[calc(100%-48px)] max-w-sm rounded-3xl bg-white p-0 text-neutral-900 shadow-xl backdrop:bg-black/40">
      <div className="px-6 pb-5 pt-6">
        {/* 처음 포커스는 제목에 — 버튼에 주면 열리자마자 파란 테두리가 뜬다. 스크린 리더는 제목부터 읽는다 */}
        <p id={titleId} tabIndex={-1} autoFocus className="text-lg font-bold outline-none">{title}</p>
        {desc && <p className="mt-2 text-sm leading-relaxed text-neutral-500">{desc}</p>}
        {error && <p className="mt-3 rounded-xl bg-accent/5 px-3 py-2 text-sm text-accent">{error}</p>}
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost h-12 flex-1 rounded-2xl text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-brand/40">취소</button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className={`${danger ? "btn-danger" : "btn-brand"} h-12 flex-1 rounded-2xl text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60`}>
            {busy ? "처리 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
