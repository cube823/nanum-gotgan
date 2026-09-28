import { Sk } from "@/components/Skeleton";

// 상대 프로필 — 헤더 + 아바타 + 이름·기관 + 3칸 통계
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="프로필 불러오는 중" className="flex-1">
      <div className="h-14" />
      <div className="flex flex-col items-center px-5 pt-4"><Sk className="size-20 rounded-full" /><Sk className="mt-4 h-6 w-28" /><Sk className="mt-2 h-4 w-36" /></div>
      <Sk className="mx-5 mt-8 h-[72px] rounded-2xl" />
    </main>
  );
}
