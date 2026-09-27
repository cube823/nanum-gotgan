// 기관 주소 → 좌표 (카카오 로컬 API). 지도 설계 P1.
// 시드는 한 번만 돌려 결과 UPDATE문을 db/orgs.sql 끝에 붙인다 — 런타임엔 카카오를 부르지 않는다.
//
//   pnpm --filter @nanum/web exec node --env-file=.env.local scripts/geocode-orgs.mjs > /tmp/geo.sql
//
// 필요: DATABASE_URL, KAKAO_REST_KEY (카카오 개발자 콘솔에서 앱의 "카카오맵" 사용 설정이 켜져 있어야 한다)
// 주소 검색이 실패하면 "…로 12" 까지로 자른 주소, 그다음 기관명 키워드 검색 순으로 시도한다.
// 못 찾은 기관은 stderr로 알린다 — 조용히 건너뛰지 않는다.
import postgres from "postgres";

const key = process.env.KAKAO_REST_KEY;
if (!key) { console.error("KAKAO_REST_KEY가 없어요"); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL);

async function kakao(path, query) {
  const r = await fetch(`https://dapi.kakao.com/v2/local/search/${path}.json?query=${encodeURIComponent(query)}`,
    { headers: { Authorization: `KakaoAK ${key}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${j.message ?? JSON.stringify(j)}`);   // 서비스 꺼짐 등은 바로 멈춘다
  const d = j.documents?.[0];
  return d ? { lng: Number(d.x), lat: Number(d.y) } : null;
}

/** "서울특별시 강동구 올림픽로 610 효성해링턴타워 B동 2층" → "서울특별시 강동구 올림픽로 610" */
const roadOnly = (a) => a.match(/^.*?(?:로|길)\s*\d+(?:-\d+)?/)?.[0] ?? null;

const orgs = await sql`SELECT name, name_norm, address FROM organizations WHERE address IS NOT NULL ORDER BY name`;
const miss = [];
console.log(`-- 좌표 (카카오 로컬 API, ${new Date().toISOString().slice(0, 10)}) — web/scripts/geocode-orgs.mjs가 만든다`);
for (const o of orgs) {
  const hit = (await kakao("address", o.address))
    ?? (roadOnly(o.address) && await kakao("address", roadOnly(o.address)))
    ?? (await kakao("keyword", o.name));
  if (!hit) { miss.push(o.name); continue; }
  console.log(`UPDATE organizations SET lat = ${hit.lat.toFixed(6)}, lng = ${hit.lng.toFixed(6)} WHERE name_norm = '${o.name_norm.replace(/'/g, "''")}';`);
}
await sql.end();
console.error(`좌표 ${orgs.length - miss.length}/${orgs.length}${miss.length ? ` · 못 찾음: ${miss.join(", ")}` : ""}`);
