import { api, requireVerified, HttpError } from "@/lib/session";
import { reverseGeocode } from "@/lib/geo";

/** 지도 가운데 핀의 주소. GET ?lat=&lng= — 위치 변경에서 지도를 끌 때. */
export const GET = api(async (req) => {
  await requireVerified();
  const p = new URL(req.url).searchParams;
  const lat = Number(p.get("lat")), lng = Number(p.get("lng"));
  if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) throw new HttpError(400, "좌표가 올바르지 않아요.");
  const a = await reverseGeocode(lat, lng);
  if (a === "unavailable") throw new HttpError(503, "지금은 주소를 찾을 수 없어요.");
  return Response.json({ address: a });
});
