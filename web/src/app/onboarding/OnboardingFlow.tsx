"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/types";
import { StepShell } from "./StepShell";

type Org = { id: string; name: string; orgType: string; verified: boolean };
type Step = 1 | 2 | 3 | 4;

/** 기획 정의서 STEP 3 — 4개 이상. */
const MIN_PICKS = 4;

export function OnboardingFlow({
  categories, profile,
}: {
  categories: Category[];
  profile: { realName: string; phone: string };
}) {
  const router = useRouter();
  // 이미 STEP 1을 채웠으면 기관부터 — 새로고침하거나 중간에 나갔다 와도 처음으로 안 돌아간다.
  const [step, setStep] = useState<Step>(profile.realName && profile.phone ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // STEP 1
  const [realName, setRealName] = useState(profile.realName);
  const [phone, setPhone] = useState(profile.phone);

  // STEP 2
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Org[]>([]);
  const [creating, setCreating] = useState(false);
  const [orgType, setOrgType] = useState("모름");
  const [bizNo, setBizNo] = useState("");

  // STEP 3
  const [picks, setPicks] = useState<string[]>([]);

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
   *  기관을 만든 뒤 다음 화면에 머무는 동안 그게 stale해져 조용히 실패했다 (JWT가 null인 채로 남는다).
   *  jwt 콜백은 trigger==="update"에서 DB를 다시 읽으므로, 세션 엔드포인트를 직접 친다. */
  async function refreshJwt(): Promise<boolean> {
    const { csrfToken } = await fetch("/api/auth/csrf").then((r) => r.json());
    const s = await fetch("/api/auth/session", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ csrfToken, data: {} }),
    }).then((r) => r.json());
    return !!s?.user?.orgId;
  }

  async function send(path: string, body: object, method = "PUT") {
    const r = await fetch(path, {
      method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, j };
  }

  async function submitProfile() {
    setBusy(true); setError(null);
    const { ok, j } = await send("/api/me/profile", { realName: realName.trim(), phone });
    setBusy(false);
    if (!ok) { setError(j.error ?? "다시 시도해 주세요."); return; }
    setStep(2);
  }

  async function submitOrg(body: object) {
    setBusy(true); setError(null);
    const { ok, j } = await send("/api/orgs", body, "POST");
    if (!ok) { setError(j.error ?? "다시 시도해 주세요."); setBusy(false); return; }
    await refreshJwt();
    setBusy(false);
    setStep(3);
  }

  async function submitInterests() {
    setBusy(true); setError(null);
    const { ok, j } = await send("/api/me/interests", { categories: picks });
    if (!ok) { setError(j.error ?? "다시 시도해 주세요."); setBusy(false); return; }
    if (!(await refreshJwt())) {
      setError("소속 정보를 반영하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.");
      setBusy(false); return;     // 조용히 머무는 대신 무엇이 막혔는지 말한다
    }
    setBusy(false);
    setStep(4);
  }

  function finish() {
    router.refresh();             // 라우터 캐시를 버려야 push가 새 JWT로 요청한다
    router.push("/swipe");        // 기획 정의서 STEP 4 — 바로 자원보기로 (승인 대기 없음)
  }

  const phoneOk = /^01\d{8,9}$/.test(phone.replace(/\D/g, ""));
  const toggle = (code: string) =>
    setPicks((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  const err = error && <p className="mt-3 text-sm text-accent">{error}</p>;

  // ── STEP 4 · 가입 완료 ─────────────────────────────────────────────────
  if (step === 4) {
    return (
      <main className="flex-1 flex flex-col px-6 pt-10 pb-8">
        <div className="flex-1 flex flex-col justify-center text-center">
          <div className="mx-auto size-16 rounded-full bg-brand/10 grid place-items-center text-2xl text-brand">⌕</div>
          <h1 className="mt-6 text-xl font-bold leading-snug">
            “{realName.trim() || "회원"}”님이 필요한<br />자원을 찾고 있어요.
          </h1>
          <p className="mt-4 text-sm text-neutral-500">
            선택하신 {picks.length}개 키워드에 맞는<br />자원을 모아서 보여드릴게요.
          </p>
        </div>
        <button onClick={finish} className="btn-brand w-full">시작하기</button>
      </main>
    );
  }

  // ── STEP 3 · 관심 자원 ────────────────────────────────────────────────
  if (step === 3) {
    return (
      <StepShell step={3} title="필요한 자원은?">
        <h1 className="text-2xl font-bold leading-snug">어떤 자원을<br />둘러보러 오셨나요?</h1>
        <p className="mt-3 text-sm text-neutral-500">
          {MIN_PICKS}개 이상의 자원 키워드를 선택해 주세요.<br />
          많이 선택할수록 다양한 자원을 추천받을 수 있어요.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-1 flex-1 rounded-full bg-neutral-200 overflow-hidden">
            <span className="block h-full rounded-full bg-brand transition-all"
              style={{ width: `${Math.min(100, (picks.length / categories.length) * 100)}%` }} />
          </span>
          <span className={`text-xs font-semibold ${picks.length >= MIN_PICKS ? "text-brand" : "text-neutral-400"}`}>
            {picks.length}/{categories.length}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = picks.includes(c.code);
            return (
              <button
                key={c.code} type="button" onClick={() => toggle(c.code)} aria-pressed={on}
                className={`rounded-full border px-3.5 py-2 text-sm transition ${
                  on ? "border-brand bg-brand/10 text-brand font-medium" : "border-neutral-200 text-neutral-600"
                }`}>
                {c.label}
              </button>
            );
          })}
        </div>

        {err}

        <div className="mt-auto pt-8">
          <button disabled={busy || picks.length < MIN_PICKS} onClick={submitInterests}
            className="btn-brand w-full disabled:opacity-40">다음으로</button>
        </div>
      </StepShell>
    );
  }

  // ── STEP 2 · 기관 정보 ────────────────────────────────────────────────
  if (step === 2) {
    return (
      <StepShell step={2} title="기관정보" onBack={() => { setError(null); setStep(1); }}>
        <h1 className="text-2xl font-bold leading-snug">소속된 기관을<br />등록해 주세요</h1>
        <p className="mt-3 text-sm text-neutral-500">소속을 확인하면 더 안전하게 연결될 수 있어요.</p>

        <label className="label mt-7">기관명</label>
        <input className="input" value={q} autoFocus placeholder="예: 용산 청년지음"
          onChange={(e) => { setQ(e.target.value); setCreating(false); }} />

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
          <>
            <label className="label mt-5">사업자등록번호 (또는 고유번호)</label>
            <input className="input" value={bizNo} inputMode="numeric" placeholder="000-00-00000"
              onChange={(e) => setBizNo(e.target.value)} />
            <p className="mt-1 text-xs text-neutral-500">
              실재하는 번호인지만 확인해요. 소속은 운영자가 승인해요.
            </p>

            <label className="label mt-5">운영 형태</label>
            <div className="flex gap-2">
              {["위탁", "직영", "모름"].map((t) => (
                <button key={t} type="button" onClick={() => setOrgType(t)}
                  className={`btn flex-1 text-sm px-2 ${orgType === t ? "bg-brand text-white" : "bg-white border border-neutral-300"}`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-neutral-500">모르면 “모름”을 골라도 돼요. 나중에 확인할 수 있어요.</p>
          </>
        )}

        {err}

        {creating && (
          <div className="mt-auto pt-8">
            <button disabled={busy || !bizNo.trim()}
              onClick={() => submitOrg({ name: q.trim(), orgType, bizNo })}
              className="btn-brand w-full disabled:opacity-40">다음으로</button>
          </div>
        )}
      </StepShell>
    );
  }

  // ── STEP 1 · 개인정보 ─────────────────────────────────────────────────
  return (
    <StepShell step={1} title="회원가입">
      <h1 className="text-2xl font-bold leading-snug">반가워요,<br />먼저 이름을 알려주세요.</h1>
      <p className="mt-3 text-sm text-neutral-500">실명을 입력해 주세요.</p>

      <label className="label mt-7">이름</label>
      <input className="input" value={realName} autoFocus placeholder="예: 김나래"
        onChange={(e) => setRealName(e.target.value)} />

      <label className="label mt-5">전화번호</label>
      <input className="input" value={phone} inputMode="tel" placeholder="010-0000-0000"
        onChange={(e) => setPhone(e.target.value)} />

      {err}

      <div className="mt-auto pt-8">
        <button disabled={busy || realName.trim().length < 2 || !phoneOk}
          onClick={submitProfile} className="btn-brand w-full disabled:opacity-40">다음으로</button>
      </div>
    </StepShell>
  );
}
