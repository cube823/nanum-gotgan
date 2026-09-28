import { Sk } from "@/components/Skeleton";

/** 내 정보 하위 화면 자리 — SubPage와 같은 전체 화면 틀. rows = 가로 카드 / people = 구성원 행 / form = 프로필 수정 */
export function SubPageSkeleton({ kind }: { kind: "rows" | "people" | "form" }) {
  return (
    <main aria-busy="true" aria-label="불러오는 중" className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-neutral-100 px-4"><Sk className="size-6" /><Sk className="h-6 w-32" /></header>
      {kind === "rows" && (
        <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Sk key={i} className="h-32 w-full rounded-2xl" />)}</div>
      )}
      {kind === "people" && (
        <div className="px-4">{[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-4"><Sk className="size-11 rounded-full" /><div className="flex-1 space-y-2"><Sk className="h-4 w-24" /><Sk className="h-3 w-20" /></div></div>
        ))}</div>
      )}
      {kind === "form" && (
        <div className="px-5 pt-8"><Sk className="mx-auto size-24 rounded-full" /><Sk className="mt-8 h-4 w-10" /><Sk className="mt-2 h-13 w-full rounded-2xl" /><Sk className="mt-6 h-4 w-14" /><Sk className="mt-2 h-13 w-full rounded-2xl" /></div>
      )}
    </main>
  );
}
