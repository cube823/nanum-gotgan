# 로그인 · 소속 · 승인

**무엇**: 담당자가 로그인하고, 기관을 고르거나 만들고, 승인을 받아 등록·신청 권한을 얻는다.
**기획서**: 01 로그인 프로세스, Figma "회원가입 프로세스 정의서"(2026.09.10). 승인 대기·승인 관리 화면(3·4)은 기획서에 없다 — 자기신고+승인으로 정하면서 생겼다 (`decisions/0001`).

## 흐름

```
/login ─OAuth 또는 dev─▶ users upsert (auth.ts signIn)
  → org 없음 → /onboarding (Figma "회원가입 프로세스 정의서" 4단계)
       STEP 1 개인정보: 실명·휴대폰 (users.real_name/phone)
       STEP 2 기관정보: 자동완성 검색 → 합류(member) 또는 신규 생성(manager) + 사업자등록번호
       STEP 3 관심 자원: 🔴 뺀 9개 중 4개 이상
       STEP 4 가입 완료: "○○○님이 필요한 자원을 찾고 있어요" → 시작하기
  → org_status = verified (바로) → /swipe
```

**승인 단계는 없다** (`decisions/0008`). 기획 정의서에 없고, 기관 목록이 서울시 청년센터
명단으로 시딩돼 있어(`db/orgs.sql`, 37곳) 대부분 자동완성에서 고른다.
`/pending`과 `/admin/approvals`는 반려용으로 남겨 뒀다 — 되돌릴 때 코드를 다시 쓰지 않아도 된다.

## 파일

| | |
|---|---|
| 인증 | `web/src/auth.ts` — 프로바이더, `signIn`(upsert), `jwt`(org 필드 싣기, `trigger==="update"`에 DB 재조회) |
| 게이트 | `web/src/proxy.ts` |
| 화면 | `web/src/app/login/page.tsx`, `onboarding/page.tsx`, `pending/page.tsx`, `admin/approvals/page.tsx` |
| API | `api/me`, `api/me/profile` (실명·전화 PUT), `api/orgs/search` (자동완성), `api/orgs` (합류/생성+사업자번호), `api/me/interests` (관심 자원 GET/PUT), `api/admin/approvals` (GET 목록 / PATCH 승인·반려) |
| 사업자번호 | `web/src/lib/bizno.ts` — 체크디지트 + 국세청 상태조회 |
| 정규화 | `web/src/lib/org.ts` `normalizeOrgName` — 띄어쓰기·기호까지만. 글자 다른 건 자동완성이 막는다 |

## 규칙

- 정체성은 `(auth_provider, auth_subject)`. 이메일 아님 — 카카오는 이메일이 비어 올 수 있다.
- 승인 범위(`scope()`): `is_admin` → 전체, `verified manager` → 우리 기관만, 그 외 403.
- 첫 승인이 곧 기관 확인 (`organizations.verified = true`).
- 승인 화면은 판단 근거를 보여준다: 이메일 도메인 뱃지(`@*.go.kr`, `@*.or.kr`), 새 기관 표시, 가입 시각. **자동 승인은 없다.**

## smoke

1 로그인 · 2 소속 · 3 승인 (권한 없음 403 → 승인 → verified → 재로그인으로 JWT 갱신)

## 열린 것

- **구글·카카오 실제 로그인은 한 번도 안 돌았다.** 클라이언트 ID 발급 필요. 카카오 이메일 항목은 선택 동의 — 비즈 앱 전환 전엔 NULL.
- 운영자 계정을 팀 몇 명이 가질지 (`ADMIN_EMAILS`).
- `org_type = 모름`인 기관은 🔴 승인 흐름을 못 태운다. 9월 인터뷰에서 빈도 확인.
- 기관명 사칭은 승인이 유일한 방어선이다.
- **온보딩에서 JWT 갱신은 `/api/auth/session`을 직접 POST한다.** `useSession().update()`는
  클라이언트가 들고 있는 세션 객체를 기준으로 도는데, 기관을 만든 뒤 관심 화면에 머무는 동안
  그게 stale해져 조용히 실패한다 — JWT의 `org_id`가 null로 남고 proxy가 `/onboarding`으로
  되돌려 화면이 그대로 멈춘다. DB에는 다 저장돼 있어 더 헷갈린다.
  smoke(curl)는 이걸 못 잡는다. JWT 갱신을 거치지 않고 API만 치기 때문이다 — 브라우저로 확인한다.

## 기획서와 다른 것

Figma STEP 2는 "인증하기" → **"기관 정보가 확인되었어요"** 로 끝난다. 구현은 그 문구를 쓰지 않는다.

국세청 API는 두 종류인데 둘 다 그 화면을 만들어 주지 못한다:

- **진위확인**(`/validate`)은 번호 + 개업일자 + 대표자성명을 대조한다. 상호(기관명)는 공식 문서에
  "참고용, 검증 대상 아님"으로 명시돼 있어, 상호가 틀려도 나머지가 맞으면 일치로 응답한다.
  게다가 센터 담당자가 자기 기관 개업일자·대표자명을 알 가능성이 낮아 가입이 막힌다.
- **상태조회**(`/status`)는 번호 하나로 실재 여부와 휴·폐업만 본다. ← 이것만 쓴다.

그래서 화면 문구도 "확인되었어요"가 아니라 **"실재하는 번호인지만 확인해요. 소속은 운영자가 승인해요"** 다.
기관 사칭 방어선은 여전히 승인이다 (`decisions/0001` — 기관 명단을 시딩하지 않는다).

`NTS_API_KEY`가 없으면 체크디지트 검사까지만 하고 통과시킨다. 국세청이 죽거나 타임아웃이어도
가입은 막지 않는다 — 승인이 뒤에 있으므로 여기서 문을 잠글 이유가 없다.
