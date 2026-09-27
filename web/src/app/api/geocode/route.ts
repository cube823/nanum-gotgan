import { api, requireVerified, HttpError } from "@/lib/session";
import { geocode } from "@/lib/geo";

/** 등록하기 "거래 희망 장소 → 위치 변경". 주소를 좌표로 바꿔 지도에 핀을 찍는다.
 *  로그인한 소속 확정 사용자만 — 익명으로 카카오 API를 대신 불러주지 않는다. */
export const POST = api(async (req) => {
  await requireVerified();
  const address = String((await req.json()).address ?? "").trim();
  if (address.length < 5) throw new HttpError(400, "주소를 적어 주세요.");
  const g = await geocode(address);
  if (g === "not_found") throw new HttpError(400, "주소를 찾지 못했어요. 도로명 주소로 적어 주세요.");
  if (g === "unavailable") throw new HttpError(503, "지금은 주소를 찾을 수 없어요. 잠시 뒤 다시 시도해 주세요.");
  return Response.json(g);
});
