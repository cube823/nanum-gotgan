"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";

type Org = { id: string; name: string; orgType: string; verified: boolean };

/** 기획 정의서 STEP 3 — 4개 이상. */
const MIN_PICKS = 4;

export function OnboardingFlow({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [step, setStep] = useState<"org" | "interests">("org");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Org[]>([]);
  const [creating, setCreating] = useState(false);
  const [orgType, setOrgType] = useState("모름");
  const [picks, setPicks] = useState<string[]>([]);
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

  /** JWT에 org_id를 싣는다. proxy가 이걸 보고 통과시킨다.
   *  next-auth의 useSession().update()는 클라이언트가 들고 있는 세션 객체를 기준으로 도는데,
   *  기관을 만든 뒤 관심 화면에 머무는 동안 그게 stale해져 조용히 실패했다 (JWT가 null인 채로 남는다).
   *  jwt 콜백은 trigger==="update"에서 DB를 다시 읽으므로, 세션 엔드포인트를 직접 친다. */
  async function refreshJwt(): Promise<boolean> {
    const { csrfToken } = await fetch("/api/auth/csrf").then((r) => r.json());
    const s = await fetch("/api/auth/session", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ csrfToken, data: {} }),
    }).then((r) => r.json());
    return !!s?.user?.orgId;
  }

  async function submitOrg(body: object) {
    setBusy(true); setError(null);
    const r = await fetch("/api/orgs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setError(j.error); setBusy(false); return; }
    await refreshJwt();
    setBusy(false);
    setStep("interests");
  }

  async function submitInterests() {
    setBusy(true); setError(null);
    const r = await fetch("/api/me/interests", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ categories: picks }),
    });
    const j = await r.json();
    if (!r.ok) { setError(j.error); setBusy(false); return; }
    if (!(await refreshJwt())) {
      setError("소속 정보를 반영하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.");
      setBusy(false); return;     // 조용히 머무는 대신 무엇이 막혔는지 말한다
    }
    router.refresh();             // 라우터 캐시를 버려야 push가 새 JWT로 요청한다
    router.push("/pending");
  }

  const toggle = (code: string) =>
    setPicks((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  if (step === "interests") {
    return (
      <main className="flex-1 px-6 pt-10 pb-8 flex flex-col">
        <h1 className="text-2xl font-bold">어떤 자원을 둘러보러 오셨나요?</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {MIN_PICKS}개 이상의 자원 키워드를 선택해 주세요.<br />
          많이 선택할수록 다양한 자원을 추천받을 수 있어요.
        </p>

        <p className="mt-6 text-sm font-semibold text-brand">
          {picks.length} / {categories.length}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = picks.includes(c.code);
            return (
              <button
                key={c.code} type="button" onClick={() => toggle(c.code)}
                className={`rounded-full border px-3.5 py-2 text-sm transition ${
                  on ? "border-brand bg-brand/10 text-brand font-medium" : "border-neutral-300 text-neutral-600"
                }`}>
                {c.label}
              </button>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-accent">{error}</p>}

        <div className="mt-auto pt-8">
          <button
            disabled={busy || picks.length < MIN_PICKS}
            onClick={submitInterests}
            className="btn-brand w-full disabled:opacity-40">
            다음으로
          </button>
        </div>
      </main>
    );
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
              <button disabled={busy} onClick={() => submitOrg({ orgId: o.id })}
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
          <button disabled={busy} onClick={() => submitOrg({ name: q.trim(), orgType })} className="btn-brand w-full">
            이 기관으로 시작하기
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
    </main>
  );
}
