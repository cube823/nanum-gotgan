"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";
import { CONDITION_LABEL, CONDITIONS } from "@/lib/labels";
import { KakaoMap } from "@/components/KakaoMap";
import { PlacePicker } from "@/components/PlacePicker";
import { CameraCapture } from "@/components/CameraCapture";
import { shrinkImage, limit, UPLOAD_LIMIT } from "@/lib/image";

/** 등록하기 — 기획 정의서 58-156·157(사진 선택) + 82-25·26(게시물 내용 등록), decisions/0010.
 *
 *  웹이라 사진보관함 권한 팝업·전체 목록은 없다. 폰 사진 선택기로 가져온 사진을 우리 그리드에 모으고,
 *  누르는 순서대로 번호를 매긴다(1번 = 대표). 카메라도 폰 기본 카메라(capture). 편집은 범위 밖.
 *  업로드는 고르는 즉시 뒤에서(동시 3장), 폰에서 긴 변 1600px로 줄여서 — Vercel 4.5MB 한도·이동통신 속도 (lib/image.ts).
 *  "n장 사진 등록하기"는 선택한 사진이 전부 올라간 뒤에 넘어간다 — 그래서 입력 화면에선 사진이 전부 URL을 갖는다.
 *  촬영은 우리 카메라 화면(70-26, components/CameraCapture) — 못 열면 폰 기본 카메라로. */
const MAX = 10;

type Pick = { id: string; file?: File; preview: string; url?: string; status?: "uploading" | "error"; error?: string };   // 임시저장에서 복원한 사진은 file 없이 url만
type Org = { name: string; address: string | null; lat: number | null; lng: number | null };
type Place = { name: string; address: string | null; lat: number | null; lng: number | null };

const EMPTY = {
  category: "", name: "", description: "", history: "", quantity: 1,
  isUsed: null as boolean | null, condition: "", onLedger: false, approvalConfirmed: false, fundingSource: "",
};
type Form = typeof EMPTY;
type Draft = { photos: { id: string; url: string }[]; f: Form; place: Place; savedAt: string };

/** 임시저장 — 이 기기 브라우저에만 (다른 기기에서 이어 쓰기는 안 된다). 사진은 이미 올린 URL만 담는다. */
const draftKey = (userId: string) => `nanum:new-draft:${userId}`;
function readDraft(userId: string): Draft | null {
  try { const raw = localStorage.getItem(draftKey(userId)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function NewItemForm({ categories, org, userId }: { categories: Category[]; org: Org; userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"photos" | "info">("photos");
  const [pool, setPool] = useState<Pick[]>([]);          // 가져온 사진, 최근 것이 앞
  const [order, setOrder] = useState<string[]>([]);      // 선택 순서 (Pick.id). 1번이 대표
  const [camera, setCamera] = useState(false);          // 우리 카메라 화면 (70-25 안내 → 70-26)
  const nativeCamera = useRef<HTMLInputElement>(null);  // 카메라를 못 열 때 폰 기본 카메라
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<Form>(EMPTY);
  const [place, setPlace] = useState<Place>({ name: org.name, address: org.address, lat: org.lat, lng: org.lng });
  const [picking, setPicking] = useState(false);       // 위치 변경 — 전체 화면 장소 선택기
  const previews = useRef<string[]>([]);
  const dragId = useRef<string | null>(null);

  // 미리보기 URL은 떠날 때 한 번에 푼다
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // 임시저장 복원 — 저장해 둔 게 있으면 바로 입력 화면으로 (기획: "재진입 시 바로 복원")
  useEffect(() => {
    void Promise.resolve().then(() => {
      const d = readDraft(userId);
      if (!d?.photos.length) return;
      setPool(d.photos.map((p) => ({ id: p.id, url: p.url, preview: p.url })));
      setOrder(d.photos.map((p) => p.id));
      setF({ ...EMPTY, ...d.f });
      setPlace(d.place);
      setStep("info");
      setNote("임시저장한 글을 불러왔어요.");
    });
  }, [userId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const cat = categories.find((c) => c.code === f.category);
  const red = cat?.riskLevel === "red";
  const picked = order.map((id) => pool.find((p) => p.id === id)!).filter(Boolean);

  /** 새로 가져온 사진은 자리가 있는 만큼 바로 선택한다 (가져온 순서대로 번호). */
  function add(list: FileList | File[] | null) {
    if (!list?.length) return;
    setErr(null);
    const fresh = Array.from(list).filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }));
    previews.current.push(...fresh.map((x) => x.preview));
    setPool((p) => [...fresh.slice().reverse(), ...p]);
    setOrder((o) => [...o, ...fresh.map((x) => x.id)].slice(0, MAX));
    if (order.length + fresh.length > MAX) setErr(`최대 ${MAX}장까지 고를 수 있어요.`);
    // 선택된 것만 바로 올린다 (자리가 없어 선택 안 된 건 고를 때 올린다)
    void limit(fresh.slice(0, Math.max(0, MAX - order.length)), 3, uploadOne);
  }

  const patch = (id: string, v: Partial<Pick>) => setPool((ps) => ps.map((x) => (x.id === id ? { ...x, ...v } : x)));

  /** 한 장: 폰에서 줄이고 → 올리고 → url. 실패하면 그 사진에 표시하고, 누르면 다시 시도한다. */
  async function uploadOne(p: Pick) {
    if (p.url || !p.file) return;
    patch(p.id, { status: "uploading", error: undefined });
    try {
      const blob = await shrinkImage(p.file);
      if (blob.size > UPLOAD_LIMIT) { patch(p.id, { status: "error", error: "사진이 너무 커요. 다른 사진을 골라 주세요." }); return; }
      const fd = new FormData(); fd.append("file", blob, "photo.jpg");
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { patch(p.id, { status: "error", error: j.error ?? "사진을 올리지 못했어요." }); return; }
      patch(p.id, { url: j.url, status: undefined });
    } catch {
      patch(p.id, { status: "error", error: "연결이 끊겼어요. 눌러서 다시 올려 주세요." });
    }
  }

  function toggle(id: string) {
    setErr(null);
    const p = pool.find((x) => x.id === id);
    if (p?.status === "error") { void uploadOne(p); return; }                 // 실패한 사진은 누르면 다시 올린다
    if (p && !order.includes(id) && order.length < MAX) void uploadOne(p);   // 새로 고른 사진은 바로 올린다
    setOrder((o) => {
      if (o.includes(id)) return o.filter((x) => x !== id);
      if (o.length >= MAX) { setErr(`최대 ${MAX}장까지 고를 수 있어요.`); return o; }
      return [...o, id];
    });
  }

  // "n장 사진 등록하기" — 선택한 사진이 다 올라가면 입력 화면으로
  const pendingN = picked.filter((p) => p.status === "uploading").length;
  const failedN = picked.filter((p) => p.status === "error").length;
  const doneN = picked.filter((p) => p.url).length;
  const photosReady = picked.length > 0 && doneN === picked.length;

  /** 사진 줄 끌어서 순서 바꾸기 — 손가락(포인터)이 지나가는 사진 자리로 옮긴다. HTML5 드래그는 폰에서 안 돼서 포인터로. */
  function onDragMove(e: React.PointerEvent) {
    const from = dragId.current;
    if (!from) return;
    const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-photo]")?.dataset.photo;
    if (!over || over === from) return;
    setOrder((o) => {
      const next = o.filter((x) => x !== from);
      next.splice(o.indexOf(over), 0, from);
      return next;
    });
  }

  function saveDraft() {
    const d: Draft = { photos: picked.map((p) => ({ id: p.id, url: p.url! })), f, place, savedAt: new Date().toISOString() };
    try { localStorage.setItem(draftKey(userId), JSON.stringify(d)); setNote("임시저장했어요. 다음에 등록하기를 누르면 이어서 쓸 수 있어요."); }
    catch { setErr("임시저장하지 못했어요."); }
  }

  async function submit() {
    setBusy(true); setErr(null);
    const custom = place.lat !== org.lat || place.lng !== org.lng || place.name !== org.name;   // 기관 위치 그대로면 비워 둔다
    const r = await fetch("/api/items", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...f, photos: picked.map((p) => p.url), quantityUnit: "개",
        isUsed: f.isUsed === true, fundingSource: f.fundingSource || null,
        ...(custom ? { pickupPlace: place.name, pickupAddress: place.address, pickupLat: place.lat, pickupLng: place.lng } : {}),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error ?? "등록하지 못했어요."); setBusy(false); return; }
    try { localStorage.removeItem(draftKey(userId)); } catch { /* 저장소를 못 써도 등록은 끝났다 */ }
    router.replace(`/new/done?id=${j.id}`);
  }

  const canSubmit = picked.length > 0 && picked.every((p) => p.url) && f.category && f.name.trim()
    && f.quantity >= 1 && f.isUsed !== null && f.condition && (!red || f.approvalConfirmed);

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
            <button type="button" onClick={() => setCamera(true)} className="aspect-square bg-neutral-100 grid place-items-center text-neutral-600">
              <span className="flex flex-col items-center gap-1 text-xs">
                <svg aria-hidden viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                촬영
              </span>
            </button>
            {/* 우리 카메라를 못 열 때(권한 거부·인앱 브라우저) 폰 기본 카메라 */}
            <input ref={nativeCamera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
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
                  aria-label={p.status === "error" ? `${p.error} 다시 올리기` : n > 0 ? `${n}번째로 선택됨` : "선택"}
                  className={`relative aspect-square overflow-hidden ${n > 0 ? "ring-[3px] ring-inset ring-brand" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="size-full object-cover" />
                  {n > 0 && p.status === "uploading" && (
                    <span aria-label="올리는 중" className="absolute inset-0 grid place-items-center bg-black/30">
                      <span className="size-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
                    </span>
                  )}
                  {p.status === "error" && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-[11px] font-bold text-white">
                      <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
                      다시 올리기
                    </span>
                  )}
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
          {(err || (failedN > 0 && picked.find((p) => p.status === "error")?.error)) && (
            <p className="px-4 pt-3 text-center text-sm text-accent">{err ?? picked.find((p) => p.status === "error")?.error}</p>
          )}
        </div>

        <div className="shrink-0 px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <button onClick={() => setStep("info")} disabled={!photosReady} className="btn-cta">
            {pendingN > 0 ? `올리는 중 ${doneN}/${picked.length}`
              : failedN > 0 ? "실패한 사진을 눌러 다시 올려 주세요"
              : order.length ? `${order.length}장 사진 등록하기` : "사진 등록하기"}
          </button>
        </div>

        {camera && (
          <CameraCapture
            onShot={(file) => add([file])}
            onClose={() => setCamera(false)}
            onFallback={() => { setCamera(false); nativeCamera.current?.click(); }} />
        )}
      </main>
    );
  }

  // ── 2. 게시물 내용 등록 (기획 정의서 82-25·26) ──────────────────────────
  const label = "mb-2 block text-sm font-bold";
  const pill = (on: boolean) => `h-11 rounded-full border px-4 text-sm font-medium transition ${
    on ? "border-brand bg-brand/10 text-brand" : "border-neutral-200 text-neutral-700"}`;

  return (
    <main className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white">
      <header className="relative flex h-14 shrink-0 items-center justify-between px-2">
        <button type="button" onClick={() => setStep("photos")} aria-label="사진 선택으로" className="size-10 grid place-items-center text-2xl">✕</button>
        <h1 className="absolute inset-x-20 truncate text-center text-base font-bold pointer-events-none">{org.name}</h1>
        <button type="button" onClick={saveDraft} className="px-3 text-sm text-neutral-400">임시저장</button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {note && <p role="status" className="mb-2 rounded-xl bg-brand/10 px-3 py-2 text-xs text-brand">{note}</p>}

        {/* 사진 — 1번이 대표. 끌어서 순서 바꾸기, ✕로 빼기. 카메라 칸은 사진 선택으로 돌아간다 */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={() => setStep("photos")} aria-label="사진 다시 고르기"
            className="size-[4.75rem] rounded-2xl border border-neutral-200 grid place-items-center text-neutral-500">
            <span className="flex flex-col items-center text-xs">
              <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              <span><span className="font-semibold text-brand">{picked.length}</span>/{MAX}</span>
            </span>
          </button>
          {picked.map((p, i) => (
            <div key={p.id} data-photo={p.id}
              onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; dragId.current = p.id; e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={onDragMove}
              onPointerUp={() => { dragId.current = null; }} onPointerCancel={() => { dragId.current = null; }}
              className={`relative size-[4.75rem] touch-none select-none rounded-2xl cursor-grab ${i === 0 ? "ring-2 ring-brand" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" draggable={false} className="size-full rounded-2xl object-cover pointer-events-none" />
              {i === 0 && <span className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-black/60 py-0.5 text-center text-[10px] font-semibold text-white">대표 사진</span>}
              <button type="button" onClick={() => toggle(p.id)} aria-label="이 사진 빼기"
                className="absolute -right-1.5 -top-1.5 size-5 rounded-full bg-neutral-900 text-[11px] text-white grid place-items-center">✕</button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-400">드래그해서 순서를 바꿀 수 있어요. 첫 번째 사진이 대표 사진이 돼요.</p>

        <label htmlFor="name" className={`${label} mt-6`}>물품명</label>
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

        <p className={`${label} mt-6`}>수량</p>
        <div className="flex h-12 w-36 items-center justify-between rounded-2xl border border-neutral-200 px-2">
          <button type="button" onClick={() => set("quantity", Math.max(1, f.quantity - 1))} disabled={f.quantity <= 1}
            aria-label="하나 줄이기" className="size-9 grid place-items-center text-xl text-neutral-700 disabled:text-neutral-300">−</button>
          <input aria-label="수량" inputMode="numeric" value={f.quantity}
            onChange={(e) => set("quantity", Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
            className="w-10 bg-transparent text-center text-base font-bold outline-none" />
          <button type="button" onClick={() => set("quantity", f.quantity + 1)}
            aria-label="하나 늘리기" className="size-9 grid place-items-center text-xl text-neutral-700">+</button>
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
          placeholder={"물품에 대한 TMI를 알려주세요.\n희망하는 거래 방식(방문 수령·전달 방법 등)이나 같이 드리는 덤 물품도 여기에 적어주세요."} />

        {/* 거래 희망 장소 — 기본은 우리 기관. 바꾸면 상세 지도·거리·카드의 "구"가 이 장소 기준이 된다 */}
        <p className={`${label} mt-6`}>거래 희망 장소</p>
        <div className="overflow-hidden rounded-2xl border border-neutral-200">
          {place.lat != null && place.lng != null ? (
            <KakaoMap key={`${place.lat},${place.lng}`} item={{ lat: place.lat, lng: place.lng }} mine={null}
              itemName={place.name} distanceKm={null} link={false} className="h-36" />
          ) : (
            <p className="grid h-36 place-items-center bg-neutral-100/70 text-sm text-neutral-400">위치를 정해 주세요</p>
          )}
          <div className="flex items-center gap-2 px-4 py-3">
            <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{place.name}</span>
              {place.address && <span className="block truncate text-xs text-neutral-400">{place.address}</span>}
            </span>
            <button type="button" onClick={() => setPicking(true)} className="shrink-0 text-sm font-semibold text-brand">위치 변경</button>
          </div>
        </div>

        <label htmlFor="hist" className={`${label} mt-6`}>물품 히스토리 <span className="font-normal text-neutral-400">(선택)</span></label>
        <input id="hist" className="field" value={f.history} maxLength={200} onChange={(e) => set("history", e.target.value)}
          placeholder="어떤 히스토리가 있는지 간단하게 작성해주세요." />

        {/* 관리 정보 — Figma엔 없지만 법적 검토 §5의 기록 항목(MVP 첫 커밋부터). 사람이 입력한다(AGENTS 불변 4).
            🔴(전기·소형비품)는 처분 승인이 있어야 등록된다 — 화면·API·DB CHECK 3중 */}
        <p className={`${label} mt-8`}>
          관리 정보 {red ? <span className="font-normal text-accent">(필수)</span> : <span className="font-normal text-neutral-400">(선택)</span>}
        </p>
        <p className="-mt-1 mb-3 text-xs leading-relaxed text-neutral-400">
          공공 예산으로 산 물품은 나눔 기록이 필요해요. 모르면 비워 둬도 돼요.
        </p>
        <div className="space-y-2">
          {([
            ["onLedger", "물품 대장에 등재된 물품이에요", "기관 물품 대장에 올라 있는 물품", false],
            ["approvalConfirmed", "내부 처분 승인을 받았어요", "기관에서 나눔(처분)을 승인받음", red],
          ] as const).map(([k, title, sub, must]) => {
            const on = f[k];
            return (
              <button key={k} type="button" role="checkbox" aria-checked={on} onClick={() => set(k, !on)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  on ? "border-brand bg-brand/5" : must ? "border-accent/40" : "border-neutral-200"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-neutral-900">
                    {title}{must && <span className="ml-1 text-xs font-bold text-accent">필수</span>}
                  </span>
                  <span className="block text-xs text-neutral-400">{sub}</span>
                </span>
                <span aria-hidden className={`size-6 shrink-0 rounded-full grid place-items-center ${on ? "bg-brand text-white" : "border-2 border-neutral-300"}`}>
                  {on && <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 mb-2 text-sm font-semibold text-neutral-700">취득 재원</p>
        <div className="flex gap-2">
          {(["자체예산", "보조금", "기타", "모름"] as const).map((v) => {
            const on = (f.fundingSource || "모름") === v;
            return (
              <button key={v} type="button" onClick={() => set("fundingSource", v === "모름" ? "" : v)} aria-pressed={on}
                className={`${pill(on)} flex-1 px-2`}>{v}</button>
            );
          })}
        </div>

        {err && <p className="mt-4 text-center text-sm text-accent">{err}</p>}
      </div>

      <div className="shrink-0 px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <button onClick={submit} disabled={!canSubmit || busy} className="btn-cta">{busy ? "올리는 중…" : "작성완료"}</button>
      </div>

      {picking && (
        <PlacePicker initial={place} home={{ name: org.name, address: org.address, lat: org.lat, lng: org.lng }}
          onCancel={() => setPicking(false)}
          onDone={(p) => { setPlace(p); setPicking(false); }} />
      )}
    </main>
  );
}
