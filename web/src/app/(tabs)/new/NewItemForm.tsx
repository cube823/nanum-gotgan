"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";
import { CONDITION_LABEL, CONDITIONS } from "@/lib/labels";

/** 등록하기 — 기획 정의서 58-156·157(사진 선택) + Notion 03(게시물 내용 등록).
 *
 *  웹이라 사진보관함 권한 팝업·전체 목록(58-83·113·114)은 없다. 폰 사진 선택기로 가져온 사진을
 *  우리 그리드에 모으고, 누르는 순서대로 번호를 매긴다(1번 = 대표). 카메라도 폰 기본 카메라(capture).
 *  편집(자르기·회전·그리기)은 이번 범위 밖. 업로드는 선택한 사진만, "n장 사진 등록하기"를 누를 때. */
const MAX = 10;

type Pick = { id: string; file: File; preview: string; url?: string };

export function NewItemForm({ categories, orgName }: { categories: Category[]; orgName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"photos" | "info">("photos");
  const [pool, setPool] = useState<Pick[]>([]);          // 가져온 사진, 최근 것이 앞
  const [order, setOrder] = useState<string[]>([]);      // 선택 순서 (Pick.id)
  const [uploading, setUploading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previews = useRef<string[]>([]);

  // 미리보기 URL은 떠날 때 한 번에 푼다
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const [f, setF] = useState({
    category: "", name: "", description: "", history: "", quantity: "", quantityUnit: "개",
    isUsed: null as boolean | null, condition: "", onLedger: false, approvalConfirmed: false, fundingSource: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const cat = categories.find((c) => c.code === f.category);
  const red = cat?.riskLevel === "red";
  const picked = order.map((id) => pool.find((p) => p.id === id)!).filter(Boolean);

  /** 새로 가져온 사진은 자리가 있는 만큼 바로 선택한다 (가져온 순서대로 번호). */
  function add(list: FileList | null) {
    if (!list?.length) return;
    setErr(null);
    const fresh = Array.from(list).filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    previews.current.push(...fresh.map((x) => x.preview));
    setPool((p) => [...fresh.slice().reverse(), ...p]);
    setOrder((o) => [...o, ...fresh.map((x) => x.id)].slice(0, MAX));
    if (order.length + fresh.length > MAX) setErr(`최대 ${MAX}장까지 고를 수 있어요.`);
  }

  function toggle(id: string) {
    setErr(null);
    setOrder((o) => {
      if (o.includes(id)) return o.filter((x) => x !== id);
      if (o.length >= MAX) { setErr(`최대 ${MAX}장까지 고를 수 있어요.`); return o; }
      return [...o, id];
    });
  }

  /** 선택한 사진만 올린다. 이미 올린 건(url 있음) 건너뛴다 — 정보 화면에서 돌아왔다 다시 와도 두 번 안 올린다. */
  async function upload() {
    setErr(null);
    for (const [i, p] of picked.entries()) {
      if (p.url) continue;
      setUploading(`${i + 1}/${picked.length}`);
      const fd = new FormData(); fd.append("file", p.file);
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? "사진을 올리지 못했어요."); setUploading(null); return; }
      setPool((ps) => ps.map((x) => (x.id === p.id ? { ...x, url: j.url } : x)));
    }
    setUploading(null);
    setStep("info");
  }

  async function submit() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/items", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...f, photos: picked.map((p) => p.url), quantity: Number(f.quantity),
        isUsed: f.isUsed === true, fundingSource: f.fundingSource || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "등록하지 못했어요."); setBusy(false); return; }
    router.replace(`/new/done?id=${j.id}`);
  }

  const canSubmit = picked.length > 0 && picked.every((p) => p.url) && f.category && f.name.trim()
    && Number.isInteger(Number(f.quantity)) && Number(f.quantity) >= 1
    && f.isUsed !== null && f.condition && (!red || f.approvalConfirmed);

  // ── 1. 사진 선택 ────────────────────────────────────────────────────────
  if (step === "photos") {
    return (
      <main className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white">
        <header className="relative flex h-14 shrink-0 items-center justify-between px-2">
          <button type="button" onClick={() => router.back()} aria-label="닫기" className="size-10 grid place-items-center text-2xl">✕</button>
          <h1 className="absolute inset-x-16 text-center text-base font-bold pointer-events-none">사진 선택</h1>
          <span className="pr-3 text-sm text-neutral-400">{order.length}/{MAX}</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-0.5">
            <label className="aspect-square cursor-pointer bg-neutral-100 grid place-items-center text-neutral-600">
              <span className="flex flex-col items-center gap-1 text-xs">
                <svg aria-hidden viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                촬영
              </span>
              {/* 폰 기본 카메라 — 플래시·0.5x·전후면은 폰이 준다 */}
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
            </label>
            <label className="aspect-square cursor-pointer bg-neutral-100 grid place-items-center text-neutral-600">
              <span className="flex flex-col items-center gap-1 text-xs">
                <svg aria-hidden viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.5" /><circle cx="9" cy="9.5" r="1.6" /><path d="m5 17 4.5-4.5 3 3 2.5-2.5L19 17" /></svg>
                앨범
              </span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
            </label>
            {pool.map((p) => {
              const n = order.indexOf(p.id) + 1;
              return (
                <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={n > 0}
                  aria-label={n > 0 ? `${n}번째로 선택됨` : "선택"}
                  className={`relative aspect-square overflow-hidden ${n > 0 ? "ring-2 ring-inset ring-brand" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="size-full object-cover" />
                  <span className={`absolute right-1.5 top-1.5 size-6 rounded-full grid place-items-center text-xs font-bold ${
                    n > 0 ? "bg-brand text-white" : "border-2 border-white bg-black/15"}`}>
                    {n > 0 ? n : ""}
                  </span>
                </button>
              );
            })}
          </div>
          {pool.length === 0 && (
            <p className="px-6 pt-10 text-center text-sm leading-relaxed text-neutral-400">
              앨범에서 사진을 고르거나 촬영해 주세요.<br />최대 {MAX}장, 먼저 고른 사진이 대표 사진이 돼요.
            </p>
          )}
          {err && <p className="px-4 pt-3 text-center text-sm text-accent">{err}</p>}
        </div>

        <div className="shrink-0 px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <button onClick={upload} disabled={order.length === 0 || !!uploading} className="btn-cta">
            {uploading ? `올리는 중 ${uploading}` : order.length ? `${order.length}장 사진 등록하기` : "사진 등록하기"}
          </button>
        </div>
      </main>
    );
  }

  // ── 2. 게시물 내용 등록 ──────────────────────────────────────────────────
  const label = "mb-2 block text-sm font-bold";
  const pill = (on: boolean) => `h-11 rounded-full border px-4 text-sm font-medium transition ${
    on ? "border-brand bg-brand/10 text-brand" : "border-neutral-200 text-neutral-700"}`;

  return (
    <main className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white">
      <header className="relative flex h-14 shrink-0 items-center px-2">
        <button type="button" onClick={() => setStep("photos")} aria-label="사진 선택으로" className="size-10 grid place-items-center text-2xl">✕</button>
        <h1 className="absolute inset-x-16 truncate text-center text-base font-bold pointer-events-none">{orgName}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* 사진 — 1번이 대표. 카메라 칸은 사진 선택으로 돌아간다 */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-2">
          <button type="button" onClick={() => setStep("photos")} aria-label="사진 다시 고르기"
            className="size-20 shrink-0 rounded-xl border border-neutral-200 grid place-items-center text-neutral-500">
            <span className="flex flex-col items-center text-[11px]">
              <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              {picked.length}/{MAX}
            </span>
          </button>
          {picked.map((p, i) => (
            <div key={p.id} className="relative size-20 shrink-0 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="size-full object-cover" />
              {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-semibold text-white">대표</span>}
              <button type="button" onClick={() => toggle(p.id)} aria-label="이 사진 빼기"
                className="absolute right-1 top-1 size-5 rounded-full bg-black/60 text-[11px] text-white grid place-items-center">✕</button>
            </div>
          ))}
        </div>

        <label htmlFor="name" className={`${label} mt-5`}>물품명</label>
        <input id="name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 네임펜 세트" />

        <p className={`${label} mt-6`}>물품 종류</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c.code} type="button" onClick={() => set("category", c.code)} aria-pressed={f.category === c.code}
              className={pill(f.category === c.code)}>
              {c.riskLevel === "red" ? "⚠ " : ""}{c.label}
            </button>
          ))}
        </div>
        {cat?.notice && (
          <p className={`mt-2 rounded-xl p-3 text-xs ${red ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{cat.notice}</p>
        )}

        <div className="mt-6 grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label htmlFor="qty" className={label}>수량</label>
            <input id="qty" className="field" inputMode="numeric" value={f.quantity} placeholder="숫자만"
              onChange={(e) => set("quantity", e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label htmlFor="unit" className={label}>단위</label>
            <input id="unit" className="field" value={f.quantityUnit} onChange={(e) => set("quantityUnit", e.target.value)} placeholder="개, 묶음" />
          </div>
        </div>

        <p className={`${label} mt-6`}>사용 여부</p>
        <div className="flex gap-2">
          {([["예", true], ["아니오", false]] as const).map(([l, v]) => (
            <button key={l} type="button" onClick={() => set("isUsed", v)} aria-pressed={f.isUsed === v} className={`${pill(f.isUsed === v)} flex-1`}>{l}</button>
          ))}
        </div>

        <p className={`${label} mt-6`}>상태</p>
        <div className="flex gap-2">
          {CONDITIONS.map((v) => (
            <button key={v} type="button" onClick={() => set("condition", v)} aria-pressed={f.condition === v} className={`${pill(f.condition === v)} flex-1 px-2`}>
              {CONDITION_LABEL[v]}
            </button>
          ))}
        </div>

        <label htmlFor="desc" className={`${label} mt-6`}>자세한 설명</label>
        <textarea id="desc" className="field h-32 py-3 leading-relaxed" value={f.description} onChange={(e) => set("description", e.target.value)}
          placeholder="물품 특징, 희망하는 거래 방식, 같이 드릴 덤 물품 등을 적어 주세요." />

        <label htmlFor="hist" className={`${label} mt-6`}>물품 히스토리 <span className="font-normal text-neutral-400">(선택)</span></label>
        <input id="hist" className="field" value={f.history} maxLength={200} onChange={(e) => set("history", e.target.value)}
          placeholder="어떤 히스토리가 있는지 간단하게 작성해 주세요." />

        {/* 법적 필드 — 법적 검토 §5. 사람이 입력한다(AGENTS 불변 4). 🔴면 펼쳐서 강제 */}
        <details open={red} className="mt-6 rounded-2xl bg-neutral-100/70 p-4">
          <summary className="cursor-pointer text-sm font-bold">관리 정보 {red ? "(필수)" : "(선택)"}</summary>
          <div className="mt-3 space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.onLedger} onChange={(e) => set("onLedger", e.target.checked)} />
              물품 대장에 등재된 물품이에요
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.approvalConfirmed} onChange={(e) => set("approvalConfirmed", e.target.checked)} />
              내부 처분 승인을 받았어요{red && <span className="text-accent">*</span>}
            </label>
            <div>
              <label htmlFor="fund" className="mb-1 block text-neutral-600">취득 재원</label>
              <select id="fund" className="field" value={f.fundingSource} onChange={(e) => set("fundingSource", e.target.value)}>
                <option value="">모름</option><option>자체예산</option><option>보조금</option><option>기타</option>
              </select>
            </div>
          </div>
        </details>

        {err && <p className="mt-4 text-center text-sm text-accent">{err}</p>}
      </div>

      <div className="shrink-0 px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <button onClick={submit} disabled={!canSubmit || busy} className="btn-cta">작성 완료</button>
      </div>
    </main>
  );
}
