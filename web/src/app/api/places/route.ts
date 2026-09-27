import { api, requireVerified, HttpError } from "@/lib/session";
import { searchPlaces } from "@/lib/geo";

/** 등록하기 "거래 희망 장소 → 위치 변경" 검색. GET ?q=합정역&lat=&lng= (lat/lng는 근처 우선용, 선택).
 *  소속 확정 사용자만 — 익명으로 카카오 API를 대신 불러주지 않는다. */
export const GET = api(async (req) => {
  await requireVerified();
  const p = new URL(req.url).searchParams;
  const q = (p.get("q") ?? "").trim();
  if (q.length < 2) return Response.json([]);
  const lat = Number(p.get("lat")), lng = Number(p.get("lng"));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && p.get("lat") ? { lat, lng } : undefined;
  const r = await searchPlaces(q.slice(0, 60), near);
  if (r === "unavailable") throw new HttpError(503, "지금은 장소를 찾을 수 없어요. 잠시 뒤 다시 시도해 주세요.");
  return Response.json(r);
});
