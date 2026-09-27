"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ago } from "@/lib/labels";
import type { ProfileRow } from "@/lib/items";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// 알약: 나눔 건이 있으면 그 상태, 없으면 물품 상태. 기획 정의서 106-294~296.
const BY_TRANSFER: Record<string, [string, string]> = {
  requested: ["신청 중", "bg-brand/10 text-brand"],
  scheduled: ["예약 중", "bg-accent/10 text-accent"],
  completed: ["양도 완료", "bg-neutral-100 text-neutral-500"],
};
const BY_ITEM: Record<string, [string, string]> = {
  reserved: ["예약 중", "bg-accent/10 text-accent"],
  completed: ["양도 완료", "bg-neutral-100 text-neutral-500"],
};

function Heart({ on, className }: { on: boolean; className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

/** 가로 카드 한 줄. withdrawable = 내가 올린 물품이라 내리기를 보인다(우리 기관 등록 물품). 그 밖엔 하트. */
export function ItemRow({ item, showOpen, withdrawable }: { item: ProfileRow; showOpen?: boolean; withdrawable?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(!!item.bookmarked);
  const [count, setCount] = useState(item.bookmarkCount ?? 0);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pill = (item.transferStatus && BY_TRANSFER[item.transferStatus]) || BY_ITEM[item.status]
    || (showOpen && item.status === "open" ? ["나눔 중", "bg-brand/10 text-brand"] : null);

  async function toggle() {
    const next = !on;
    setOn(next); setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    const r = await fetch(`/api/items/${item.id}/bookmark`, { method: next ? "PUT" : "DELETE" }).catch(() => null);
    if (!r?.ok) { setOn(!next); setCount((c) => Math.max(0, c + (next ? -1 : 1))); }
  }

  async function withdraw() {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/items/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "withdraw" }) });
    setBusy(false);
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "내리지 못했어요."); return; }
    setAsk(false);
    router.refresh();
  }

  return (
    <li className="relative overflow-hidden rounded-2xl border border-neutral-200">
      <Link href={`/items/${item.id}`} className="flex h-32">
        <span className="w-28 shrink-0 bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {item.photos[0] && <img src={item.photos[0]} alt="" className="size-full object-cover" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col px-3.5 py-3">
          <span className="truncate pr-8 font-bold">{item.name}</span>
          <span className="mt-1 truncate text-xs text-neutral-400">{item.orgName} · {ago(item.createdAt)}</span>
          {pill && <span className={`mt-2 self-start rounded-full px-2.5 py-1 text-xs font-bold ${pill[1]}`}>{pill[0]}</span>}
          <span className="mt-auto flex items-center justify-end gap-1 text-xs text-neutral-500" aria-label={`북마크 ${count}`}>
            <Heart on className="size-3.5 text-neutral-500" />{count}
          </span>
        </span>
      </Link>
      {withdrawable ? (
        item.status !== "completed" && (
          <>
            <button onClick={() => { setErr(null); setAsk(true); }}
              className="absolute right-3 top-3 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500 outline-none hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-brand/40">
              내리기
            </button>
            <ConfirmDialog open={ask} danger busy={busy} error={err}
              title="이 물품을 내릴까요?"
              desc={`"${item.name}"이(가) 목록에서 사라지고, 진행 중인 대화는 종료돼요. 대화 기록은 남아요.`}
              confirmLabel="내리기" onConfirm={withdraw} onCancel={() => setAsk(false)} />
          </>
        )
      ) : (
        <button onClick={toggle} aria-label="북마크" aria-pressed={on} className="absolute right-2 top-2 grid size-9 place-items-center text-brand">
          <Heart on={on} className={`size-6 ${on ? "" : "text-neutral-300"}`} />
        </button>
      )}
    </li>
  );
}
