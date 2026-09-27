"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Category } from "@/lib/types";
import { StepShell } from "./StepShell";

type Org = { id: string; name: string; orgType: string; address: string | null; verified: boolean };
type Step = 1 | 2 | 3 | 4;

/** 기획 정의서 STEP 3 — 4개 이상. */
const MIN_PICKS = 4;

export function OnboardingFlow({
  categories, profile,
}: {
  categories: Category[];
  profile: { realName: string; phone: string; hasOrg: boolean };
}) {
  const router = useRouter();
  // 채운 데까지는 건너뛴다 — 새로고침하거나 중간에 나갔다 와도 처음으로 안 돌아간다.
  // 소속이 이미 있으면 STEP 3부터. 안 그러면 STEP 2에서 "이미 소속이 확정됐어요"로 막힌다.
  const [step, setStep] = useState<Step>(profile.hasOrg ? 3 : profile.realName && profile.phone ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // STEP 1
  const [realName, setRealName] = useState(profile.realName);
  const [phone, setPhone] = useState(profile.phone);

  // STEP 2 — 목록에서 고르든(picked) 새로 적든, 사업자번호 "인증하기"(bizOk)를 통과해야 넘어간다
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Org[]>([]);
  const [picked, setPicked] = useState<Org | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);       // 방향키로 고른 행. results.length 번째 = "새로 등록"
  const [bizNo, setBizNo] = useState("");
  const [bizOk, setBizOk] = useState<null | { matched: boolean }>(null);

  // STEP 3
  const [picks, setPicks] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (picked || q.trim().length < 1) { setResults([]); return; }
      const r = await fetch(`/api/orgs/search?q=${encodeURIComponent(q)}`);
      setResults(await r.json());
      setActive(-1);
    }, 200);
    return () => clearTimeout(t);
  }, [q, picked]);

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

  async function verifyBizNo() {
    setBusy(true); setError(null);
    const { ok, j } = await send("/api/orgs/bizno", { bizNo, orgId: picked?.id }, "POST");
    setBusy(false);
    if (!ok) { setError(j.error ?? "다시 시도해 주세요."); return; }
    setBizOk({ matched: !!j.matched });
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
      <main className="flex-1 flex flex-col items-center px-14 pt-40 text-center">
        <div className="size-24 rounded-full bg-brand/10 grid place-items-center text-brand">
          <svg aria-hidden viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
          </svg>
        </div>
        <h1 className="mt-8 text-2xl font-extrabold leading-snug tracking-tight">
          &quot;{realName.trim() || "회원"}&quot;님이 필요한<br />자원을 찾고 있어요.
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-neutral-400">
          선택하신 {picks.length}개 키워드에 맞는<br />자원을 모아서 보여드릴게요.
        </p>
        <button onClick={finish} className="btn-cta mt-10">시작하기</button>
      </main>
    );
  }

  const heading = "text-3xl font-extrabold leading-tight tracking-tight";
  const sub = "mt-2 text-sm text-neutral-400";
  const label = "mt-6 mb-2 block text-sm font-bold";

  // ── STEP 3 · 관심 자원 ────────────────────────────────────────────────
  if (step === 3) {
    return (
      <StepShell step={3} title="필요한 자원은?">
        <h1 className={heading}>어떤 자원을<br />둘러보러 오셨나요?</h1>
        <p className={`${sub} leading-relaxed`}>
          {MIN_PICKS}개 이상의 자원 키워드를 선택해 주세요.<br />
          많이 선택할수록 다양한 자원을 추천받을 수 있어요.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-0.5 flex-1 bg-neutral-200 overflow-hidden">
            <span className="block h-full bg-brand transition-all"
              style={{ width: `${Math.min(100, (picks.length / categories.length) * 100)}%` }} />
          </span>
          <span className={`text-xs font-semibold ${picks.length >= MIN_PICKS ? "text-brand" : "text-neutral-400"}`}>
            {picks.length}/{categories.length}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {categories.map((c) => {
            const on = picks.includes(c.code);
            return (
              <button
                key={c.code} type="button" onClick={() => toggle(c.code)} aria-pressed={on}
                className={`h-11 rounded-full border px-4 text-sm font-medium transition ${
                  on ? "border-brand bg-brand/10 text-brand" : "border-neutral-200 text-neutral-800"
                }`}>
                {c.label}
              </button>
            );
          })}
        </div>

        {err}

        <button disabled={busy || picks.length < MIN_PICKS} onClick={submitInterests}
          className="btn-cta mt-8">다음으로</button>
      </StepShell>
    );
  }

  // ── STEP 2 · 기관 정보 ────────────────────────────────────────────────
  if (step === 2) {
    const typed = q.trim();
    const showList = listOpen && !picked && typed.length >= 1;
    const rows = results.length + 1;               // 마지막 줄은 "새로 등록"

    const pick = (o: Org) => {
      setPicked(o); setQ(o.name); setListOpen(false); setBizOk(null); setError(null);
    };
    const unpick = () => { setPicked(null); setQ(""); setBizOk(null); setListOpen(true); };
    const choose = (i: number) => (i < results.length ? pick(results[i]) : setListOpen(false));

    const onKey = (e: React.KeyboardEvent) => {
      if (!showList) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % rows); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? rows - 1 : a - 1)); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(active); }
      else if (e.key === "Escape") setListOpen(false);
    };

    return (
      <StepShell step={2} title="기관정보" onBack={() => { setError(null); setStep(1); }}>
        <h1 className={heading}>소속된 기관을<br />등록해 주세요</h1>
        <p className={sub}>소속을 확인하면 더 안전하게 연결될 수 있어요.</p>

        <label htmlFor="org" className={label}>기관명</label>
        <div className="relative">
          <input id="org" className={`field ${picked ? "pr-20 border-brand" : ""}`}
            value={q} autoFocus autoComplete="off" placeholder="예: 용산 청년지음"
            role="combobox" aria-expanded={showList} aria-controls="org-list"
            aria-activedescendant={showList && active >= 0 ? `org-opt-${active}` : undefined}
            readOnly={!!picked}
            onFocus={() => setListOpen(true)}
            onBlur={() => setListOpen(false)}
            onKeyDown={onKey}
            onChange={(e) => { setQ(e.target.value); setListOpen(true); setBizOk(null); setError(null); }} />
          {picked && (
            <button type="button" onClick={unpick}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              변경
            </button>
          )}

          {showList && (
            <ul id="org-list" role="listbox"
              className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-neutral-200 bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
              {results.map((o, i) => (
                <li key={o.id} id={`org-opt-${i}`} role="option" aria-selected={active === i}
                  onMouseDown={(e) => e.preventDefault()}   // blur보다 먼저 — 안 막으면 누르기 전에 닫힌다
                  onClick={() => pick(o)} onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-4 py-3 ${active === i ? "bg-brand/5" : ""}`}>
                  <p className="text-[15px] font-semibold text-neutral-900"><Highlight text={o.name} q={typed} /></p>
                  {o.address && <p className="mt-0.5 truncate text-xs text-neutral-400">{o.address}</p>}
                </li>
              ))}
              <li id={`org-opt-${results.length}`} role="option" aria-selected={active === results.length}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setListOpen(false)} onMouseEnter={() => setActive(results.length)}
                className={`cursor-pointer px-4 py-3 text-sm ${results.length ? "border-t border-neutral-100" : ""} ${active === results.length ? "bg-brand/5" : ""}`}>
                <span className="text-neutral-500">{results.length ? "목록에 없어요 · " : "검색 결과가 없어요 · "}</span>
                <span className="font-semibold text-brand">‘{typed}’ 새로 등록할게요</span>
              </li>
            </ul>
          )}
        </div>

        <label htmlFor="bizno" className={label}>사업자등록번호 (또는 고유번호)</label>
        <input id="bizno" className="field" value={bizNo} inputMode="numeric" placeholder="000-00-00000"
          onChange={(e) => { setBizNo(e.target.value); setBizOk(null); setError(null); }} />

        {err}

        {bizOk ? (
          <p role="status" className="mt-5 flex h-12 items-center gap-2 rounded-2xl bg-brand/10 px-4 text-sm font-semibold text-brand">
            <span aria-hidden>✓</span>
            {/* 상태조회는 상호를 검증하지 않는다 — 기관에 저장된 번호와 맞았을 때만 "기관 정보"라고 쓴다 (lib/bizno.ts) */}
            {bizOk.matched ? "기관 정보가 확인되었어요" : "사업자등록번호가 확인되었어요"}
          </p>
        ) : (
          <button type="button" onClick={verifyBizNo}
            disabled={busy || typed.length < 2 || bizNo.replace(/\D/g, "").length !== 10}
            className="btn mt-5 h-13 w-full rounded-2xl bg-brand/10 text-brand">
            인증하기
          </button>
        )}

        <button disabled={busy || !bizOk}
          onClick={() => submitOrg(picked ? { orgId: picked.id, bizNo } : { name: typed, orgType: "모름", bizNo })}
          className="btn-cta mt-3">다음으로</button>
      </StepShell>
    );
  }

  // ── STEP 1 · 개인정보 ─────────────────────────────────────────────────
  return (
    <StepShell step={1} title="회원가입" onBack={() => signOut({ redirectTo: "/login" })}>
      <h1 className={heading}>반가워요,<br />먼저 이름을 알려주세요.</h1>
      <p className={sub}>실명을 입력해 주세요.</p>

      <label htmlFor="name" className={label}>이름</label>
      <input id="name" className="field" value={realName} autoFocus placeholder="예: 김나래"
        onChange={(e) => setRealName(e.target.value)} />

      <label htmlFor="phone" className={label}>전화번호</label>
      <input id="phone" className="field" value={phone} inputMode="tel" placeholder="010-0000-0000"
        onChange={(e) => setPhone(e.target.value)} />

      {err}

      <button disabled={busy || realName.trim().length < 2 || !phoneOk}
        onClick={submitProfile} className="btn-cta mt-8">다음으로</button>
    </StepShell>
  );
}

/** 검색어와 겹치는 부분만 브랜드색. 공백 무시 매칭(name_norm)으로 걸린 행은 강조 없이 그대로. */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<span className="text-brand">{text.slice(i, i + q.length)}</span>{text.slice(i + q.length)}</>;
}
