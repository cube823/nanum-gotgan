/** 사업자등록번호. 회원가입 STEP 2 (기획 정의서).
 *
 *  국세청 API는 두 가지가 있는데 우리는 '상태조회'만 쓴다:
 *   - 진위확인(validate): 번호 + 개업일자 + 대표자성명을 대조한다. 상호(기관명)는
 *     문서에 "참고용, 검증 대상 아님"이라 적혀 있어 소속 판정에 못 쓴다. 게다가
 *     센터 담당자가 자기 기관 개업일자·대표자명을 알 가능성이 낮아 가입이 막힌다.
 *   - 상태조회(status): 번호 하나로 실재 여부와 휴·폐업을 본다. ← 이것만 쓴다.
 *
 *  그래서 이 검사를 통과해도 "그 기관 소속"은 증명되지 않는다. 소속은 승인이 정한다.
 */

/** '-' 제거하고 숫자만. */
export function normalizeBizNo(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** 국세청 체크디지트. 키가 없어도 도는 1차 방어선 — 아무 10자리나 막는다. */
export function isValidBizNoFormat(raw: string): boolean {
  const n = normalizeBizNo(raw);
  if (!/^\d{10}$/.test(n)) return false;

  if (/^(\d)\1{9}$/.test(n)) return false;   // 0000000000은 체크디지트를 통과한다

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(n[i]) * weights[i];
  sum += Math.floor((Number(n[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(n[9]);
}

export type BizStatus =
  | { ok: true; checked: boolean; state?: string }   // checked=false면 형식만 봤다
  | { ok: false; reason: string };

/** 국세청 상태조회. NTS_API_KEY가 없으면 형식 검사까지만 하고 통과시킨다
 *  (storage.ts가 Blob 토큰 유무로 분기하는 것과 같은 방식 — 키 없이도 개발이 된다). */
export async function checkBizNo(raw: string): Promise<BizStatus> {
  if (!isValidBizNoFormat(raw)) {
    return { ok: false, reason: "사업자등록번호 형식이 올바르지 않아요." };
  }

  const key = process.env.NTS_API_KEY;
  if (!key) return { ok: true, checked: false };

  try {
    const r = await fetch(
      `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ b_no: [normalizeBizNo(raw)] }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok) return { ok: true, checked: false };   // 국세청이 죽어도 가입은 막지 않는다

    const j = await r.json();
    const d = j?.data?.[0];
    if (!d) return { ok: true, checked: false };

    // b_stt_cd — 01:계속사업자 02:휴업자 03:폐업자. 빈 값이면 등록되지 않은 번호.
    if (!d.b_stt_cd) return { ok: false, reason: "국세청에 등록되지 않은 번호예요." };
    if (d.b_stt_cd === "03") return { ok: false, reason: "폐업 상태로 조회돼요." };
    return { ok: true, checked: true, state: d.b_stt || undefined };
  } catch {
    return { ok: true, checked: false };              // 타임아웃·네트워크 실패도 마찬가지
  }
}

/** 기관에 대조할 번호. 기관에 번호가 저장돼 있으면(직접 등록된 기관) 같아야 한다.
 *  시드된 청년센터(db/orgs.sql)는 번호가 없어 상태조회만 본다 — matched=false. */
export async function checkBizNoFor(
  raw: string, expected: string | null,
): Promise<{ ok: true; matched: boolean } | { ok: false; reason: string }> {
  const r = await checkBizNo(raw);
  if (!r.ok) return r;
  if (!expected) return { ok: true, matched: false };
  if (normalizeBizNo(raw) !== expected) return { ok: false, reason: "기관에 등록된 사업자등록번호와 달라요." };
  return { ok: true, matched: true };
}
