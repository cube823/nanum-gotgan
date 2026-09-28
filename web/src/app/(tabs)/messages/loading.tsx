import { Sk } from "@/components/Skeleton";

// 메시지 목록 — 제목 + 탭 줄 + 대화 행 5줄 (썸네일 · 두 줄 · 알약)
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="대화 목록 불러오는 중" className="flex flex-1 flex-col px-5 pt-6">
      <Sk className="h-8 w-24" />
      <div className="mt-5 flex gap-2 border-b-2 border-neutral-100 pb-3">{[0, 1, 2].map((i) => <Sk key={i} className="h-5 flex-1" />)}</div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-neutral-100 py-5">
          <Sk className="size-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2"><Sk className="h-4 w-1/3" /><Sk className="h-3 w-4/5" /><Sk className="h-3 w-2/3" /></div>
          <Sk className="h-6 w-14 shrink-0 rounded-full" />
        </div>
      ))}
    </main>
  );
}
