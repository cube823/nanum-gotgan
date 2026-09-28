import { Sheet } from "@/components/Sheet";

/** 시트는 레이아웃에 둔다 — 상세 보기(↑)를 누르면 미리 받아 둔 레이아웃+loading.tsx로 시트와 스켈레톤이 바로 뜨고,
 *  데이터가 오면 안쪽만 바뀐다. 시트가 레이아웃이라 한 번만 올라온다 (docs/design/LOADING-STATES.md A). */
export default function ItemSheetLayout({ children }: { children: React.ReactNode }) {
  return <Sheet label="물품 상세">{children}</Sheet>;
}
