import { Sk } from "@/components/Skeleton";

// 전체 물품 — 제목 + 카테고리 칩 줄 + 2열 카드 6장
export default function Loading() {
  return (
    <main aria-busy="true" aria-label="물품 불러오는 중" className="flex-1 px-4 pt-4">
      <Sk className="h-7 w-28" />
      <div className="mt-3 flex gap-2">{["w-14", "w-20", "w-16", "w-18"].map((w) => <Sk key={w} className={`h-7 rounded-full ${w}`} />)}</div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}><Sk className="aspect-square w-full rounded-xl" /><Sk className="mt-2 h-3 w-1/3" /><Sk className="mt-1.5 h-4 w-3/4" /></div>
        ))}
      </div>
    </main>
  );
}
