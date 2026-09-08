# 나눔곳간 — web

Next.js 16 (App Router) + PostgreSQL. 설계는 상위 폴더의 `MVP.md`, `DB-SCHEMA.md`.

## 처음 한 번

```bash
# 1. DB
createdb nanum_gotgan
psql -d nanum_gotgan -f ../db/schema.sql
psql -d nanum_gotgan -f ../db/seed.sql        # 카테고리 10개

# 2. 환경
cp .env.example .env.local                     # DATABASE_URL, AUTH_SECRET 채우기
#   ADMIN_EMAILS 에 운영자 이메일을 넣으면 그 이메일로 로그인 시 승인 권한이 생긴다

# 3. 실행
pnpm install
pnpm dev                                       # http://localhost:3000
```

개발 중엔 OAuth 클라이언트 ID 없이 **개발용 로그인**(이메일만 입력)으로 전체 흐름을 돌릴 수 있다.
프로덕션 빌드에선 이 로그인이 사라지고 구글/카카오만 남는다 — `AUTH_GOOGLE_ID`, `AUTH_KAKAO_ID`가 필요하다.

## 확인

```bash
bash scripts/smoke.sh          # dev 서버 떠 있을 때. 계정 3개로 한 바퀴 (51건)
pnpm exec tsc --noEmit
pnpm exec eslint src
pnpm build
```

## 구조

```
src/
  auth.ts               Auth.js 설정. 구글·카카오·(개발용) 로그인, JWT에 소속 상태
  proxy.ts              게이트 — 리다이렉트만. 진짜 판정은 API (MVP §3)
  lib/
    db.ts               postgres.js 클라이언트 (camelCase 변환)
    session.ts          requireUser / requireVerified — DB를 본다, 토큰 아님
    items.ts            스와이프·목록·상세·내 물품 쿼리
    storage.ts          사진 저장 — 로컬 public/uploads. Blob/S3로 바꾸려면 이 파일만
  app/
    login, onboarding, pending, admin/approvals     소속 확인 흐름
    (tabs)/swipe, items, new, messages, me          4탭 + 목록
    api/**                                          route handlers
scripts/smoke.sh        curl 한 바퀴
```

## 아직 사람이 해야 하는 것

- 구글/카카오 OAuth 앱 만들고 클라이언트 ID 받기 (카카오는 이메일 항목이 선택 동의 — 비즈 앱 전환 전엔 이메일이 비어 올 수 있다)
- 프로덕션 사진 저장소 (`lib/storage.ts` 교체)
- 배포 (Vercel이면 Postgres 연결 문자열만 env로)
