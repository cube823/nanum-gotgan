import { sql } from "./db";
import { HttpError } from "./session";
import { CONDITIONS } from "./labels";
import { isStoredImage } from "./storage";

const CONDITION_SET = new Set<string>(CONDITIONS);

export type ItemInput = {
  category: string; name: string; description: string | null; quantity: number; quantityUnit: string;
  isUsed: boolean; condition: string; photos: string[];
  pickupPlace: string | null; pickupAddress: string | null; pickupLat: number | null; pickupLng: number | null;
};

/** 등록(POST /api/items)과 수정(PATCH /api/items/[id] action=update)이 같이 쓰는 검사.
 *  관리 정보는 "내부 처분 승인을 받았어요" 하나 — 모든 물품에 필수 (QA 1차, 2026-09-29).
 *  대장 등재·취득 재원·물품 히스토리는 입력에서 뺐다. 컬럼은 남아 있고 새 글은 false/NULL로 둔다. */
export async function parseItemInput(b: Record<string, unknown>): Promise<ItemInput> {
  const name = String(b.name ?? "").trim();
  const quantity = Number(b.quantity);
  const photos: string[] = Array.isArray(b.photos) ? b.photos.filter((x: unknown): x is string => typeof x === "string") : [];

  if (!name) throw new HttpError(400, "물품 이름을 적어 주세요.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, "수량은 1 이상이어야 해요.");
  if (!CONDITION_SET.has(String(b.condition))) throw new HttpError(400, "상태를 골라 주세요.");
  if (photos.length < 1 || photos.length > 10) throw new HttpError(400, "사진은 1~10장이어야 해요.");
  // /api/uploads로 올린 것만. 빈 문자열·외부 주소가 item_photos에 박히면 카드에 깨진 사진이 뜬다.
  if (!photos.every(isStoredImage)) throw new HttpError(400, "사진을 다시 올려 주세요.");
  if (b.approvalConfirmed !== true) throw new HttpError(400, "관리 정보에서 내부 처분 승인을 확인해 주세요.");

  // 거래 희망 장소 (선택). 좌표는 위치 변경(/api/places·지도 핀)이 준 값 — 한국 범위 밖이면 받지 않는다. 비우면 기관 위치를 쓴다.
  const pickupPlace = String(b.pickupPlace ?? "").trim().slice(0, 100) || null;
  const pickupAddress = String(b.pickupAddress ?? "").trim().slice(0, 200) || null;
  const [pLat, pLng] = [Number(b.pickupLat), Number(b.pickupLng)];
  const hasCoord = b.pickupLat != null && b.pickupLng != null;
  if (hasCoord && !(pLat > 33 && pLat < 39 && pLng > 124 && pLng < 132)) throw new HttpError(400, "거래 희망 장소 좌표가 올바르지 않아요.");

  const [cat] = await sql`SELECT code FROM categories WHERE code = ${String(b.category)}`;
  if (!cat) throw new HttpError(400, "카테고리를 골라 주세요.");

  return {
    category: cat.code, name, description: String(b.description ?? "").trim() || null,
    quantity, quantityUnit: String(b.quantityUnit ?? "개").trim() || "개",
    isUsed: !!b.isUsed, condition: String(b.condition), photos,
    pickupPlace, pickupAddress, pickupLat: hasCoord ? pLat : null, pickupLng: hasCoord ? pLng : null,
  };
}
