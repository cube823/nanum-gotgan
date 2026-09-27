"use client";

/** 회원가입 공통 껍데기 (기획 정의서 STEP 1~3).
 *  헤더: ‹ 뒤로 · 가운데 타이틀 · 우측 n/3
 *  그 아래 3칸 진행 바 — 지난 칸과 현재 칸이 브랜드색. */
export function StepShell({
  step, title, onBack, children,
}: {
  step: 1 | 2 | 3;
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 flex flex-col">
      <header className="relative flex items-center justify-center h-14 px-4">
        {onBack && (
          <button
            type="button" onClick={onBack} aria-label="이전 단계"
            className="absolute left-2 size-10 grid place-items-center text-2xl text-neutral-900">
            ‹
          </button>
        )}
        <h2 className="text-base font-bold">{title}</h2>
        <span className="absolute right-6 text-sm text-neutral-400">{step}/3</span>
      </header>

      <div className="mt-2 flex gap-1.5 px-6" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 ${i <= step ? "bg-brand" : "bg-neutral-200"}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col px-6 pt-7 pb-8">{children}</div>
    </main>
  );
}
