import { Sk } from "@/components/Skeleton";

/** 물품 상세 자리 — 사진(13:10) + 칩 + 제목 + 기관 카드 + 정보 카드. 시트·전체 화면 공용 (docs/design/LOADING-STATES.md A). */
export function ItemDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="물품 불러오는 중">
      <Sk className="aspect-[13/10] w-full rounded-none" />
      <div className="space-y-4 px-[22px] pt-6">
        <div className="flex gap-1.5"><Sk className="h-6 w-20 rounded-full" /><Sk className="h-6 w-14 rounded-full" /></div>
        <Sk className="h-7 w-2/3" />
        <Sk className="h-4 w-1/2" />
        <Sk className="h-16 w-full rounded-2xl" />
        <Sk className="h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}
