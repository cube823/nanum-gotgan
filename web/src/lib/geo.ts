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

export type Place = { name: string; address: string; lat: number; lng: number };

async function kakao(path: string, params: Record<string, string>, key: string) {
  const r = await fetch(`https://dapi.kakao.com/v2/local/${path}.json?${new URLSearchParams(params)}`, {
    headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`kakao ${r.status}`);
  return (await r.json()).documents ?? [];
}

/** 거래 희망 장소 검색 — 사람들은 도로명 주소를 모른다. "합정역", "용산 청년지음"처럼 아는 이름으로 찾게 한다.
 *  키워드(장소명) 검색 + 주소 검색을 합친다. near가 있으면 그 근처 결과가 앞에 온다. */
export async function searchPlaces(q: string, near?: { lat: number; lng: number }): Promise<Place[] | "unavailable"> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return "unavailable";
  try {
    const bias: Record<string, string> = near ? { x: String(near.lng), y: String(near.lat), sort: "accuracy" } : {};
    const [kw, addr] = await Promise.all([
      kakao("search/keyword", { query: q, size: "8", ...bias }, key),
      kakao("search/address", { query: q, size: "3" }, key),
    ]);
    const out: Place[] = [
      ...addr.map((d: { address_name: string; road_address?: { address_name: string; building_name?: string }; x: string; y: string }) => ({
        name: d.road_address?.building_name || d.road_address?.address_name || d.address_name,
        address: d.road_address?.address_name ?? d.address_name, lat: Number(d.y), lng: Number(d.x),
      })),
      ...kw.map((d: { place_name: string; road_address_name: string; address_name: string; x: string; y: string }) => ({
        name: d.place_name, address: d.road_address_name || d.address_name, lat: Number(d.y), lng: Number(d.x),
      })),
    ];
    const seen = new Set<string>();    // 같은 장소가 두 검색에 다 걸리면 하나만
    return out.filter((p) => { const k = `${p.name}|${p.address}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 10);
  } catch {
    return "unavailable";
  }
}

/** 지도 가운데 핀 → 주소. 지도를 끌어 위치를 고칠 때. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null | "unavailable"> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return "unavailable";
  try {
    const [d] = await kakao("geo/coord2address", { x: String(lng), y: String(lat) }, key);
    return d ? (d.road_address?.address_name ?? d.address?.address_name ?? null) : null;
  } catch {
    return "unavailable";
  }
}
