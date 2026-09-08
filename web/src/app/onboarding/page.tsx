"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Org = { id: string; name: string; orgType: string; verified: boolean };

export default function OnboardingPage() {
  const router = useRouter();
  const { update } = useSession();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Org[]>([]);
  const [creating, setCreating] = useState(false);
  const [orgType, setOrgType] = useState("모름");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 1) { setResults([]); return; }
      const r = await fetch(`/api/orgs/search?q=${encodeURIComponent(q)}`);
      setResults(await r.json());
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function submit(body: object) {
    setBusy(true); setError(null);
    const r = await fetch("/api/orgs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setError(j.error); setBusy(false); return; }
    await update();               // JWT에 org_id 싣기 — 그래야 proxy가 통과시킨다
    router.push("/pending");      // update()가 새 쿠키를 받은 뒤라 다음 요청부터 proxy가 org를 본다
  }

  return (
    <main className="flex-1 px-6 pt-10 pb-8">
      <h1 className="text-2xl font-bold">어느 기관 소속인가요?</h1>
      <p className="mt-2 text-sm text-neutral-500">
        나눔은 기관 단위로 이뤄져요. 소속이 확인된 뒤 등록·신청을 할 수 있어요.
      </p>

      <label className="label mt-8">기관명</label>
      <input
        className="input" value={q} autoFocus
        placeholder="예: 강남구 청년센터"
        onChange={(e) => { setQ(e.target.value); setCreating(false); }}
      />

      {!creating && results.length > 0 && (
        <ul className="mt-2 rounded-xl border border-neutral-200 divide-y">
          {results.map((o) => (
            <li key={o.id}>
              <button disabled={busy} onClick={() => submit({ orgId: o.id })}
                className="w-full text-left px-3 py-3 hover:bg-neutral-50 flex justify-between items-center">
                <span>{o.name}</span>
                <span className="text-xs text-neutral-400">{o.orgType}{o.verified ? " · 확인됨" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.trim().length >= 2 && !creating && (
        <button onClick={() => setCreating(true)} className="mt-3 text-sm text-brand font-medium">
          목록에 없어요 — “{q.trim()}” 새로 등록하기
        </button>
      )}

      {creating && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-4 space-y-3">
          <p className="text-sm font-medium">“{q.trim()}” 새로 등록</p>
          <div>
            <label className="label">운영 형태</label>
            <div className="flex gap-2">
              {["위탁", "직영", "모름"].map((t) => (
                <button key={t} type="button" onClick={() => setOrgType(t)}
                  className={`btn flex-1 text-sm ${orgType === t ? "bg-brand text-white" : "bg-white border border-neutral-300"}`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-neutral-500">모르면 “모름”을 골라도 돼요. 나중에 확인할 수 있어요.</p>
          </div>
          <button disabled={busy} onClick={() => submit({ name: q.trim(), orgType })} className="btn-brand w-full">
            이 기관으로 시작하기
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
    </main>
  );
}
