import { ItemDetail } from "./ItemDetail";

/** 직접 들어오거나 새로고침하면 전체 화면. 스와이프에서 ↑로 오면 @modal/(.)items/[id]가 가로채 시트로 띄운다. */
export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  return <main className="flex-1"><ItemDetail id={(await params).id} /></main>;
}
