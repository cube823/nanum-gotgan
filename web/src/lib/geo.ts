/** 주소 → 좌표 (카카오 로컬 API). 새 기관 등록 때 한 번 부르고 organizations.lat/lng에 저장한다 —
 *  화면을 볼 때마다 부르지 않는다. 시드 기관은 web/scripts/geocode-orgs.mjs로 미리 채워 뒀다.
 *
 *  KAKAO_REST_KEY가 없으면 "unavailable" — 호출한 쪽이 좌표 없이 저장한다 (storage.ts가 Blob 토큰 유무로 갈리는 것과 같다).
 *  카카오가 죽어도 가입은 막지 않는다. 막는 건 "주소를 못 찾았다"가 확실할 때뿐이다. */
export type Geo = { lat: number; lng: number; address: string };

/** "서울특별시 강동구 올림픽로 610 효성해링턴타워 B동 2층" → "서울특별시 강동구 올림픽로 610" */
const roadOnly = (a: string) => a.match(/^.*?(?:로|길)\s*\d+(?:-\d+)?/)?.[0] ?? null;

async function search(query: string, key: string): Promise<Geo | null> {
  const r = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`kakao ${r.status}`);
  const d = (await r.json()).documents?.[0];
  return d ? { lat: Number(d.y), lng: Number(d.x), address: d.road_address?.address_name ?? d.address_name } : null;
}

export async function geocode(address: string): Promise<Geo | "not_found" | "unavailable"> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return "unavailable";
  try {
    const hit = (await search(address, key)) ?? (roadOnly(address) ? await search(roadOnly(address)!, key) : null);
    return hit ?? "not_found";
  } catch {
    return "unavailable";
  }
}
