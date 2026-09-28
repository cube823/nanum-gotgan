import { ItemDetail } from "@/app/(tabs)/items/[id]/ItemDetail";

/** 기획 정의서 11 — 스와이프 ↑ = 98vh 바텀시트(layout.tsx). 뒤의 스와이프 화면(보던 카드)은 그대로 살아 있다. */
export default async function ItemSheet({ params }: { params: Promise<{ id: string }> }) {
  return <ItemDetail id={(await params).id} sheet />;
}
