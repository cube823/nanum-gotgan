import { Sk } from "@/components/Skeleton";

// 채팅방 — 탭바 없이 전체 화면. 헤더 + 물품 카드 + 말풍선 3개 + 입력창
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="대화 불러오는 중" className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col bg-white">
      <header className="flex h-16 shrink-0 flex-col items-center justify-center gap-1.5"><Sk className="h-5 w-24" /><Sk className="h-3 w-20" /></header>
      <div className="mx-4 flex items-center gap-3 rounded-2xl bg-brand/5 p-3">
        <Sk className="size-12 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2"><Sk className="h-4 w-1/2" /><Sk className="h-3 w-1/3" /></div>
        <Sk className="h-6 w-14 rounded-full" />
      </div>
      <div className="flex-1 space-y-5 px-4 pt-8">
        <Sk className="h-12 w-3/5 rounded-2xl" /><Sk className="ml-auto h-12 w-1/2 rounded-2xl" /><Sk className="h-16 w-2/3 rounded-2xl" />
      </div>
      <div className="shrink-0 px-4 pb-[calc(12px+env(safe-area-inset-bottom))]"><Sk className="h-12 w-full rounded-full" /></div>
    </main>
  );
}
