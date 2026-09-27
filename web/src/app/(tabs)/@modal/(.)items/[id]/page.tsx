import { Sheet } from "@/components/Sheet";
import { ItemDetail } from "@/app/(tabs)/items/[id]/ItemDetail";

/** 기획 정의서 11 — 스와이프 ↑ = 98vh 바텀시트. 뒤의 스와이프 화면(보던 카드)은 그대로 살아 있다. */
export default async function ItemSheet({ params }: { params: Promise<{ id: string }> }) {
  return <Sheet label="물품 상세"><ItemDetail id={(await params).id} sheet /></Sheet>;
}
