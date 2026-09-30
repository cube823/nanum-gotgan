import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { pageUser } from "@/lib/session";
import { getItem } from "@/lib/items";
import type { Category, Condition } from "@/lib/types";
import { NewItemForm } from "@/app/(tabs)/new/NewItemForm";

/** 게시물 수정 (QA 1차) — 등록 화면을 저장된 값으로 채워 입력 단계에서 연다. 등록자만, 나눔이 끝나기 전까지.
 *  권한은 PATCH /api/items/[id] action=update가 다시 본다 — 여기서 막는 건 화면일 뿐. */
export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await pageUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = await getItem(id);
  if (!item || item.createdBy !== u.id || item.status === "completed") notFound();

  const [cats, [org]] = await Promise.all([
    sql<Category[]>`SELECT code, label, risk_level, notice FROM categories ORDER BY sort_order`,
    sql`SELECT name, address, lat::float AS lat, lng::float AS lng FROM organizations WHERE id = ${item.orgId}`,
  ]);
  const home = { name: org?.name ?? "", address: org?.address ?? null, lat: org?.lat ?? null, lng: org?.lng ?? null };
  const place = item.pickupLat != null && item.pickupLng != null
    ? { name: item.pickupPlace ?? home.name, address: item.pickupAddress ?? null, lat: Number(item.pickupLat), lng: Number(item.pickupLng) }
    : home;

  return (
    <NewItemForm categories={cats} userId={u.id} org={home}
      edit={{
        id: item.id, photos: item.photos, place,
        f: {
          category: item.category, name: item.name, description: item.description ?? "", quantity: item.quantity,
          isUsed: item.isUsed, condition: item.condition as Condition,
          approvalConfirmed: false,   // 고칠 때마다 다시 확인받는다 — 사람이 체크하는 법적 필드(AGENTS 불변 4)
        },
      }} />
  );
}
