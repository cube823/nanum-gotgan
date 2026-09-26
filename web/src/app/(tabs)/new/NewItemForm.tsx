"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";
import { CONDITION_LABEL, CONDITIONS } from "@/lib/labels";

/** MVP §4.1 — 사진 → 정보, 한 페이지 2스텝. AI 토글 없음. */
export function NewItemForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState({
    category: "", name: "", description: "", quantity: "1", quantityUnit: "개",
    isUsed: false, condition: "중", onLedger: false, approvalConfirmed: false, fundingSource: "",
  });
  const cat = categories.find((c) => c.code === f.category);
  const red = cat?.riskLevel === "red";

  async function onFiles(list: FileList | null) {
    if (!list) return;
    setErr(null); setUploading(true);
    const room = 10 - photos.length;
    for (const file of Array.from(list).slice(0, room)) {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setErr(j.error); break; }
      setPhotos((p) => [...p, j.url]);
    }
    setUploading(false);
  }

  async function submit() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/items", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...f, photos, quantity: Number(f.quantity), fundingSource: f.fundingSource || null }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); setBusy(false); return; }
    router.replace(`/new/done?id=${j.id}`);
  }

  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const canSubmit = f.category && f.name.trim() && Number(f.quantity) >= 1 && (!red || f.approvalConfirmed);

  return (
    <main className="flex-1 px-5 pt-4 pb-8">
      <h1 className="text-xl font-bold">{step === 1 ? "사진을 올려 주세요" : "물품 정보"}</h1>
      <p className="text-xs text-neutral-500 mt-1">{step === 1 ? `최대 10장 · ${photos.length}장 선택됨` : "담당자가 확인할 수 있게 적어 주세요"}</p>

      {step === 1 && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p} className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="size-full object-cover" />
                <span className="absolute top-1 left-1 size-5 rounded-full bg-brand text-white text-[10px] grid place-items-center">{i + 1}</span>
                <button onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} aria-label="삭제"
                  className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white text-xs">✕</button>
              </div>
            ))}
            {photos.length < 10 && (
              <label className="aspect-square rounded-xl border-2 border-dashed border-neutral-300 grid place-items-center text-neutral-400 cursor-pointer">
                <span className="text-2xl">{uploading ? "…" : "＋"}</span>
                {/* capture 없이: 갤러리·카메라 둘 다 OS가 고르게. 자체 카메라 UI는 만들지 않는다 (MVP §1 뺀 것). */}
                <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} disabled={uploading} />
              </label>
            )}
          </div>
          <button onClick={() => setStep(2)} disabled={photos.length === 0 || uploading} className="btn-brand w-full mt-6">
            {photos.length}장 올리기
          </button>
        </>
      )}

      {step === 2 && (
        <div className="mt-4 space-y-4">
          <div>
            <label className="label">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button key={c.code} type="button" onClick={() => set("category", c.code)}
                  className={`chip py-1.5 px-3 ${f.category === c.code ? "bg-brand text-white" : "bg-neutral-100"}`}>
                  {c.riskLevel === "red" ? "⚠ " : ""}{c.label}
                </button>
              ))}
            </div>
            {cat?.notice && (
              <p className={`mt-2 text-xs rounded-xl p-3 ${red ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>{cat.notice}</p>
            )}
          </div>

          <div><label className="label">물품 이름</label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="예: 크라프트 종이봉투" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">수량</label>
              <input type="number" min={1} className="input" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} /></div>
            <div><label className="label">단위</label>
              <input className="input" value={f.quantityUnit} onChange={(e) => set("quantityUnit", e.target.value)} placeholder="개, 묶음, 박스" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">사용 여부</label>
              <div className="flex gap-2">
                {[["미사용", false], ["사용", true]].map(([l, v]) => (
                  <button key={String(v)} type="button" onClick={() => set("isUsed", v as boolean)}
                    className={`btn flex-1 text-sm py-2 ${f.isUsed === v ? "bg-brand text-white" : "bg-neutral-100"}`}>{l as string}</button>
                ))}
              </div></div>
            <div><label className="label">상태</label>
              <div className="flex gap-2">
                {CONDITIONS.map((v) => (
                  <button key={v} type="button" onClick={() => set("condition", v)}
                    className={`btn flex-1 text-sm py-2 px-2 ${f.condition === v ? "bg-brand text-white" : "bg-neutral-100"}`}>{CONDITION_LABEL[v]}</button>
                ))}
              </div></div>
          </div>

          <div><label className="label">설명</label>
            <textarea className="input min-h-24" value={f.description} onChange={(e) => set("description", e.target.value)}
              placeholder="어떤 물건인지, 왜 남았는지, 상태는 어떤지 적어 주세요." /></div>

          {/* 법적 필드 — 법적 검토 §5. red면 강제, 아니면 접어둔다. */}
          <details open={red} className="rounded-xl bg-neutral-50 p-3">
            <summary className="text-sm font-medium cursor-pointer">관리 정보 {red ? "(필수)" : "(선택)"}</summary>
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.onLedger} onChange={(e) => set("onLedger", e.target.checked)} />
                물품 대장에 등재된 물품이에요
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={f.approvalConfirmed} onChange={(e) => set("approvalConfirmed", e.target.checked)} />
                내부 처분 승인을 받았어요{red && <span className="text-accent">*</span>}
              </label>
              <div><label className="label">취득 재원</label>
                <select className="input" value={f.fundingSource} onChange={(e) => set("fundingSource", e.target.value)}>
                  <option value="">모름</option><option>자체예산</option><option>보조금</option><option>기타</option>
                </select></div>
            </div>
          </details>

          {err && <p className="text-sm text-accent">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="btn-ghost">← 사진</button>
            <button onClick={submit} disabled={!canSubmit || busy} className="btn-brand flex-1">등록하기</button>
          </div>
        </div>
      )}
    </main>
  );
}
