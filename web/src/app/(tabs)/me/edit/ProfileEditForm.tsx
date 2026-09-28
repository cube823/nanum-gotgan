"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubPage } from "../SubPage";
import { Avatar } from "../Avatar";

export function ProfileEditForm({ name: initialName, image: initialImage, orgName }: { name: string; image: string | null; orgName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = uploading || saving;
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true); setErr(null);
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/uploads", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setImage(j.url); else setErr(j.error ?? "사진을 올리지 못했어요.");
    setUploading(false);
  }

  async function save() {
    setSaving(true); setErr(null);
    const r = await fetch("/api/me/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ realName: name, profileImage: image }) });
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "저장하지 못했어요."); setSaving(false); return; }
    router.push("/me");
    router.refresh();
  }

  return (
    <SubPage title="프로필 수정"
      action={<button onClick={save} disabled={busy || name.trim().length < 2} className="px-3 text-base font-bold text-brand disabled:text-neutral-300">{saving ? "저장 중…" : "완료"}</button>}>
      <div className="px-5 pt-8">
        <label className="relative mx-auto block size-24 cursor-pointer">
          <Avatar src={image} className="size-24 border-4 border-neutral-100" />
          {/* 올리는 동안 사진 위 덮개 + 스피너 (docs/design/LOADING-STATES.md D) */}
          {uploading && (
            <span role="status" aria-label="사진 올리는 중" className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
              <span className="size-7 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
            </span>
          )}
          <span aria-hidden className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border border-neutral-200 bg-white text-sm">📷</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="프로필 사진 바꾸기" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
        </label>

        <label className="mt-8 block text-[13px] font-bold text-neutral-500" htmlFor="name">이름</label>
        <input id="name" className="field mt-2" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />

        <p className="mt-6 text-[13px] font-bold text-neutral-500">기관명 <span className="ml-1 text-[11px] font-normal text-neutral-400">· 수정 불가</span></p>
        <input className="field mt-2 bg-neutral-100 text-neutral-400" value={orgName} disabled aria-label="기관명" />

        {err && <p className="mt-4 text-center text-sm text-accent">{err}</p>}
      </div>
    </SubPage>
  );
}
