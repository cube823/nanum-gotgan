# 로그인 · 소속 · 승인

**무엇**: 담당자가 로그인하고, 기관을 고르거나 만들고, 승인을 받아 등록·신청 권한을 얻는다.
**기획서**: 01 로그인 프로세스, Figma "회원가입 프로세스 정의서"(2026.09.10). 승인 대기·승인 관리 화면(3·4)은 기획서에 없다 — 자기신고+승인으로 정하면서 생겼다 (`decisions/0001`).

## 흐름

```
/login ─OAuth 또는 dev─▶ users upsert (auth.ts signIn)
  → org 없음 → /onboarding
       1단계 기관: 자동완성 검색 → 기존 기관 합류(member) 또는 신규 생성(manager)
       2단계 관심 자원: 🔴 뺀 9개 중 4개 이상 (Figma STEP 3)
  → org_status = pending → /pending (5초 폴링)
  → 운영자(첫 담당자) 또는 같은 기관 verified manager가 승인 → verified
  → session.update() → /swipe
```

pending은 조회는 된다 — 가둬두지 않는다. 등록·신청만 403.

## 파일

| | |
|---|---|
| 인증 | `web/src/auth.ts` — 프로바이더, `signIn`(upsert), `jwt`(org 필드 싣기, `trigger==="update"`에 DB 재조회) |
| 게이트 | `web/src/proxy.ts` |
| 화면 | `web/src/app/login/page.tsx`, `onboarding/page.tsx`, `pending/page.tsx`, `admin/approvals/page.tsx` |
| API | `api/me`, `api/orgs/search` (자동완성), `api/orgs` (합류/생성), `api/me/interests` (관심 자원 GET/PUT), `api/admin/approvals` (GET 목록 / PATCH 승인·반려) |
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

## 기획서와 다른 것

Figma STEP 2는 **기관명 + 사업자등록번호 자동 인증**("인증하기" → 매칭 확인)이다. 구현은 기관명 + 운영 형태만
받고 사람이 승인한다 — 기관 명단을 시딩하지 않기로 했으므로(`decisions/0001`) 대조할 원본이 없다.
Figma는 이 결정 이후 문서인데도 인증 흐름을 그리고 있다. **기획팀 확인 필요.**

STEP 1의 이름·전화번호 수집도 없다. OAuth 프로필의 닉네임을 쓴다.
