import { Sk } from "@/components/Skeleton";

// 내 정보 — 제목 + 프로필 카드 + 3칸 메뉴 + 우리 기관 목록 4줄
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="내 정보 불러오는 중" className="flex-1 space-y-3 px-4 pb-6 pt-6">
      <Sk className="mb-3 ml-1 h-8 w-24" />
      <div className="rounded-3xl border border-neutral-200 p-4">
        <div className="flex items-center gap-4"><Sk className="size-14 rounded-full" /><div className="flex-1 space-y-2"><Sk className="h-5 w-24" /><Sk className="h-3 w-40" /></div></div>
        <Sk className="mt-4 h-11 w-full rounded-2xl" />
      </div>
      <Sk className="h-[88px] w-full rounded-3xl" />
      <div className="space-y-5 rounded-3xl border border-neutral-200 p-5">{[0, 1, 2, 3].map((i) => <Sk key={i} className="h-5 w-2/5" />)}</div>
    </main>
  );
}
