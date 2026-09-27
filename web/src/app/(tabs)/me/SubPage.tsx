import Link from "next/link";

/** 내 정보 하위 화면 — 탭바 없이 전체 화면 (기획 정의서 106-293~296). 채팅방처럼 탭 레이아웃 위에 덮는다. */
export function SubPage({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white">
      {/* 오른쪽 버튼이 있으면(프로필 수정 "완료") 제목을 가운데로 — Figma 106-293. 목록 화면은 왼쪽 정렬 */}
      <header className="relative flex h-16 shrink-0 items-center gap-1 border-b border-neutral-100 px-2">
        <Link href="/me" aria-label="내 정보" className="grid size-10 place-items-center text-2xl text-neutral-900">‹</Link>
        <h1 className={action ? "pointer-events-none absolute inset-x-16 text-center text-lg font-extrabold" : "flex-1 text-xl font-extrabold"}>{title}</h1>
        {action && <span className="ml-auto">{action}</span>}
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </main>
  );
}
